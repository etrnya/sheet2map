import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error
import time
import re
from google import genai
from google.oauth2 import service_account

# 💡 手動讀取 .env 檔案並寫入環境變數 (避免 CP950 編碼錯誤，指定 UTF-8)
def load_env():
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, val = line.strip().split("=", 1)
                    os.environ[key.strip()] = val.strip()

# 💡 初始化 Gemini 用戶端 (優先使用 Vertex AI 服務帳號金鑰，其次為標準 API 金鑰)
def get_gemini_client():
    key_path = "gcp-key.json"
    if os.path.exists(key_path):
        try:
            with open(key_path, "r", encoding="utf-8") as f:
                key_data = json.load(f)
                project_id = key_data.get("project_id")
            
            credentials = service_account.Credentials.from_service_account_file(
                key_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            client = genai.Client(
                vertexai=True,
                project=project_id,
                credentials=credentials
            )
            print("[INFO] 成功使用 GCP 服務帳戶 (Vertex AI) 初始化 Gemini 用戶端。")
            return client
        except Exception as e:
            print(f"[WARN] 嘗試初始化 Vertex AI 失敗 ({e})，將退回標準 API 金鑰。")
    
    # 退回使用系統環境變數中的 GEMINI_API_KEY
    if "GEMINI_API_KEY" not in os.environ:
        print("[ERROR] 找不到 GEMINI_API_KEY 環境變數，且無有效之 gcp-key.json 金鑰檔案。")
        sys.exit(1)
        
    client = genai.Client()
    print("[INFO] 成功使用標準 API Key 初始化 Gemini 用戶端。")
    return client

# 🧭 內部底層查詢 Nominatim
def _query_nominatim(address):
    try:
        # Nominatim 規定：限制每秒最多 1 次請求
        time.sleep(1.0)
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(address)}&limit=1"
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Sheet2Map AI Importer Pipeline (etrnya@gmail.com)'}
        )
        # 💡 加入 timeout=5 防止連線卡死
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and len(data) > 0:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception:
        pass
    return None, None

# 🧭 本地地理編碼 (OSM Nominatim API + 台灣門牌退回至路名機制)
def geocode_address(address):
    # 第一階段：嘗試完整地址
    lat, lng = _query_nominatim(address)
    if lat and lng:
        return lat, lng
        
    # 第二階段退回機制：若是台灣地址，因 Nominatim 缺乏門牌資料，退回到路/街/巷/弄
    cleaned = address
    match = re.search(r'(.+?[路街巷弄])', address)
    if match:
        cleaned = match.group(1)
        
    if cleaned != address:
        print(f"    [Geocode] 完整地址解析失敗，退回搜尋路名: '{cleaned}'")
        lat, lng = _query_nominatim(cleaned)
        if lat and lng:
            return lat, lng
            
    return None, None

# 📡 呼叫 Apps Script Web App API 匯入資料 (支援 HTTP POST 重新導向處理)
def post_to_gas(url, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        # Google Apps Script 會返回 302 Redirect，urllib 會自動跟隨，設定 timeout=90
        with urllib.request.urlopen(req, timeout=90) as response:
            response_text = response.read().decode('utf-8')
            # 💡 若重導向結果為網頁 HTML，可能代表 Google 權限出錯
            if response_text.strip().startswith("<!DOCTYPE html>"):
                return {
                    "success": False, 
                    "error": "Google Web App 返回了 HTML 頁面而非 JSON，請確認部署權限是否設為 Anyone 且完成授權確認。"
                }
            return json.loads(response_text)
    except urllib.error.HTTPError as e:
        return {"success": False, "error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# 📊 讀取 Excel (.xlsx) 檔案
def read_xlsx(file_path):
    try:
        import openpyxl
    except ImportError:
        print("[ERROR] 請先安裝 openpyxl 套件：pip install openpyxl")
        sys.exit(1)
        
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    
    # 提取表頭
    headers = [str(cell).strip() if cell is not None else f"Column_{idx}" for idx, cell in enumerate(rows[0])]
    
    # 提取資料列
    data_rows = []
    for r in rows[1:]:
        # 跳過空白列
        if not any(cell is not None for cell in r):
            continue
        row_dict = {}
        for col_idx, cell in enumerate(r):
            if col_idx < len(headers):
                row_dict[headers[col_idx]] = str(cell).strip() if cell is not None else ""
        data_rows.append(row_dict)
        
    return data_rows

# 🤖 呼叫 Gemini 解析單批資料
def call_gemini_for_chunk(client, chunk_str):
    prompt = f"""
    你是一個專業的地理資訊與資料清洗 AI 專家。
    你的任務是解析以下原始 JSON 資料，並精準對齊為我們定義的 Sheet2Map 標準地標 JSON 格式。
    
    【目標 Schema 規範】
    地標點位 (points) 的標準屬性：
    - id: 字串，地標唯一標識。若原始資料中沒有，請自動按順序生成如 "pt-1", "pt-2" 等。
    - name: 字串，地標名稱 (必要，對齊如機構名稱、門市名稱、站點名稱等)
    - lat: 浮點數，緯度 (若原始資料無座標，請填 0.0)
    - lng: 浮點數，經度 (若原始資料無座標，請填 0.0)
    - category: 字串，地標分類 (例如 "戒菸門診", "AED設備", "美食小吃"。請根據地標特徵與性質進行推測分類)
    - address: 字串，完整地址 (若無座標則非常重要，必須盡可能提取完整地址，包含縣市、區、路街、號)
    - district: 字串，地標所在行政區 (例如：中西區、東區。請從地址或名稱中提取)
    - phone: 字串，聯絡電話
    - website: 字串，官方網站 (若無請留空)
    - description: 字串，特色簡介
    - image: 字串，照片網址 (若無請留空)
    - opening_hours: 字串，開放或營業時間 (若無請留空)
    - tags: 字串陣列，例如 ["免費諮詢", "門診", "公立"] (請根據地標特徵自動打上 1-3 個標籤)
    - custom_fields: 物件，若資料中有其他極為重要的自訂欄位，請將其鍵名冠以 "custom_"，並放入此物件中。例如原始欄位為「院長姓名」，請對應為 {{"custom_director": "院長名字"}}
    
    【輸出 JSON 根節點格式】
    {{
      "metadata": {{
        "title": "地圖標題 (例如：臺南市戒菸門診地圖)",
        "description": "地圖簡介與用途聲明",
        "category": "地圖主分類 (例如：健康醫療)",
        "source_name": "資料提供單位",
        "source_url": "",
        "source_date": "2026-06"
      }},
      "points": [
        // 標準點位陣列...
      ],
      "confidence": {{
        "overall_score": 0.95
      }}
    }}
    
    【輸出限制】
    - 請直接回傳符合上述結構的 JSON 字串。
    - 嚴禁回傳任何 markdown 包裝外框 (例如不要有 ```json 或是 ``` 等符號)。
    
    【原始輸入資料】
    {chunk_str}
    """
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    output_text = response.text.strip()
    
    if output_text.startswith("```json"):
        output_text = output_text[7:]
    if output_text.endswith("```"):
        output_text = output_text[:-3]
    output_text = output_text.strip()
    
    parsed_data = json.loads(output_text)
    return parsed_data

def main():
    load_env()
    
    parser = argparse.ArgumentParser(description="Sheet2Map AI 自動化對齊與點位匯入 CLI 工具 (TDD v2.1)")
    parser.add_argument("-f", "--file", required=True, help="要匯入的原始文字檔、CSV 或 Excel (.xlsx) 檔案路徑")
    parser.add_argument("-m", "--map-id", required=True, help="目標地圖識別碼 (例如: quit-smoking)")
    parser.add_argument("-t", "--threshold", type=float, default=0.8, help="AI 對齊整體信心分數最低閾值 (預設: 0.8)")
    parser.add_argument("-g", "--geocode", action="store_true", default=True, help="是否針對座標空白的點位執行本地地理編碼")
    parser.add_argument("-b", "--batch-size", type=int, default=30, help="Excel 分批處理的每批數量 (預設: 30)")
    
    args = parser.parse_args()
    
    # 讀取檔案
    if not os.path.exists(args.file):
        print(f"[ERROR] 找不到檔案: {args.file}")
        sys.exit(1)
        
    is_xlsx = args.file.endswith(".xlsx") or args.file.endswith(".xls")
    
    data_rows = []
    raw_content = ""
    
    if is_xlsx:
        print(f"[INFO] 檢測到 Excel 檔案，正在使用 openpyxl 解析...")
        data_rows = read_xlsx(args.file)
        print(f"[INFO] 成功載入 {len(data_rows)} 筆 Excel 資料列。")
    else:
        print(f"[INFO] 正在讀取文字/CSV 檔案 {args.file}...")
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                raw_content = f.read()
        except UnicodeDecodeError:
            try:
                with open(args.file, "r", encoding="cp950") as f:
                    raw_content = f.read()
            except Exception as e:
                print(f"[ERROR] 檔案讀取失敗，不支援的編碼格式: {e}")
                sys.exit(1)

    # 初始化 Gemini
    client = get_gemini_client()
    
    all_points = []
    metadata = {}
    
    if is_xlsx:
        # 分批處理
        batch_size = args.batch_size
        print(f"[INFO] 開始執行分批處理，每批數量: {batch_size} 筆...")
        
        for i in range(0, len(data_rows), batch_size):
            chunk = data_rows[i : i + batch_size]
            print(f"  -> 正在處理第 {i // batch_size + 1} 批資料 ({i + 1} ~ {min(i + batch_size, len(data_rows))})...")
            
            chunk_str = json.dumps(chunk, ensure_ascii=False)
            try:
                parsed_chunk = call_gemini_for_chunk(client, chunk_str)
                points = parsed_chunk.get("points", [])
                
                # 給予點位一個基於總體順序的唯一 ID
                for idx, p in enumerate(points):
                    if not p.get("id") or p.get("id").startswith("pt-"):
                        p["id"] = f"pt-{len(all_points) + idx + 1}"
                        
                all_points.extend(points)
                
                # 拿第一批的 metadata 作為地圖 metadata
                if not metadata and parsed_chunk.get("metadata"):
                    metadata = parsed_chunk.get("metadata")
            except Exception as e:
                print(f"  [ERROR] 第 {i // batch_size + 1} 批資料 AI 解析失敗: {e}")
    else:
        # 單一文字/CSV 檔整批處理
        print("[INFO] 正在呼叫 Gemini 模型進行 AI Schema 對齊與映射...")
        try:
            parsed_data = call_gemini_for_chunk(client, raw_content)
            all_points = parsed_data.get("points", [])
            metadata = parsed_data.get("metadata", {})
        except Exception as e:
            print(f"[ERROR] Gemini 解析或 JSON 轉換失敗: {e}")
            sys.exit(1)
            
    print(f"\n[AI 對齊完成] 共成功提取了 {len(all_points)} 筆地標點位。")
    if metadata:
        print(f"  - 地圖標題: {metadata.get('title')}")
        print(f"  - 主分類: {metadata.get('category')}")
        print(f"  - 資料來源: {metadata.get('source_name')}")

    # 品質校驗：重複檢查與去重
    valid_points = []
    seen_names = set()
    for p in all_points:
        name = p.get("name", "").strip()
        if not name:
            continue
        if name in seen_names:
            continue
        seen_names.add(name)
        valid_points.append(p)
        
    points = valid_points
    print(f"[INFO] 經過去重處理，有效點位共 {len(points)} 筆。")

    # 🧭 本地地理編碼 (OSM Nominatim API 備援)
    # 💡 效能與安全性保護：若需要定位的點位數大於 15 筆，為防 Nominatim 封鎖 IP，自動略過本地編碼，引導至雲端處理！
    if args.geocode:
        empty_coords_count = sum(1 for p in points if not p.get("lat") or not p.get("lng") or float(p.get("lat")) == 0.0 or float(p.get("lng")) == 0.0)
        
        if empty_coords_count > 15:
            print(f"\n[INFO] 檢測到有 {empty_coords_count} 筆空座標點位。由於數量過多，為避免被 OSM Nominatim 阻斷服務 (Rate-limited)，本機將略過本地編碼。")
            print("  [Hint] 請在資料匯入成功後，於試算表點選選單「Sheet2Map -> Geocode」進行高速雲端地理定位！")
        else:
            print("\n[INFO] 正在對經緯度空白的地址執行本地地理編碼...")
            for p in points:
                lat = p.get("lat")
                lng = p.get("lng")
                address = p.get("address", "").strip()
                
                # 若 lat, lng 為空或為 0.0，且地址不為空，進行解析
                if address and (not lat or not lng or float(lat) == 0.0 or float(lng) == 0.0):
                    print(f"  - 正在解析地址: {address} ({p.get('name')})")
                    new_lat, new_lng = geocode_address(address)
                    if new_lat and new_lng:
                        p["lat"] = new_lat
                        p["lng"] = new_lng
                        print(f"    -> 成功解析座標: {new_lat}, {new_lng}")
                    else:
                        print(f"    -> 解析失敗，將寫入空白座標由使用者於試算表補正。")
                    
    # 📡 匯入至 Google Sheets API Web App
    gas_api_url = os.environ.get("GAS_API_URL")
    if not gas_api_url:
        print("[ERROR] 本地 .env 中未配置 GAS_API_URL，無法寫入雲端試算表。")
        sys.exit(1)
        
    import_payload = {
        "action": "import",
        "map_id": args.map_id,
        "metadata": metadata,
        "points": points
    }
    
    print(f"\n[INFO] 正在連線至 Apps Script API 寫入試算表 (Map ID: {args.map_id})...")
    result = post_to_gas(gas_api_url, import_payload)
    
    if result and result.get("success"):
        print(f"\n[SUCCESS] 匯入成功！{result.get('message')}")
    else:
        error_msg = result.get("error") if result else "無回應或連線超時"
        print(f"\n[ERROR] 匯入試算表失敗: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
