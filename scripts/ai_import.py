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
        with urllib.request.urlopen(req) as response:
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
        # Google Apps Script 會返回 302 Redirect，urllib 會自動跟隨
        with urllib.request.urlopen(req) as response:
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

def main():
    load_env()
    
    parser = argparse.ArgumentParser(description="Sheet2Map AI 自動化對齊與點位匯入 CLI 工具 (TDD v1.0)")
    parser.add_argument("-f", "--file", required=True, help="要匯入的原始文字檔或 CSV 檔案路徑")
    parser.add_argument("-m", "--map-id", required=True, help="目標地圖識別碼 (例如: quit-smoking)")
    parser.add_argument("-t", "--threshold", type=float, default=0.8, help="AI 對齊整體信心分數最低閾值 (預設: 0.8)")
    parser.add_argument("-g", "--geocode", action="store_true", default=True, help="是否針對座標空白的點位執行本地地理編碼")
    
    args = parser.parse_args()
    
    # 讀取檔案
    if not os.path.exists(args.file):
        print(f"[ERROR] 找不到檔案: {args.file}")
        sys.exit(1)
        
    print(f"[INFO] 正在讀取檔案 {args.file}...")
    try:
        with open(args.file, "r", encoding="utf-8") as f:
            raw_content = f.read()
    except UnicodeDecodeError:
        # 備援 ANSI/CP950 讀取
        try:
            with open(args.file, "r", encoding="cp950") as f:
                raw_content = f.read()
        except Exception as e:
            print(f"[ERROR] 檔案讀取失敗，不支援的編碼格式: {e}")
            sys.exit(1)

    # 初始化 Gemini
    client = get_gemini_client()
    
    # 建立系統 Prompt
    prompt = f"""
    你是一個專業的地理資訊與資料清洗 AI 專家。
    你的任務是解析以下原始文字或 CSV 資料，並精準對齊為我們定義的 Sheet2Map 標準地標 JSON 格式。
    
    【目標 Schema 規範】
    地標點位 (points) 的標準屬性：
    - id: 字串，地標唯一標識。若原始資料中沒有，請自動按順序生成如 "pt-1", "pt-2" 等。
    - name: 字串，地標名稱 (必要)
    - lat: 浮點數，緯度 (若原始資料無座標，請留空或填 0.0)
    - lng: 浮點數，經度 (若原始資料無座標，請留空或填 0.0)
    - category: 字串，地標分類 (若原始資料沒有，請根據地標屬性或名稱推測，例如 "戒菸門診", "AED設備", "美食小吃")
    - address: 字串，完整地址 (若無座標則非常重要，必須盡可能提取完整地址，包含縣市、區、路街、號)
    - district: 字串，地標所在行政區 (例如：中西區、東區。請從地址或名稱中提取)
    - phone: 字串，聯絡電話
    - website: 字串，官方網站
    - description: 字串，特色簡介
    - image: 字串，照片網址 (若無請留空)
    - opening_hours: 字串，開放或營業時間 (若無請留空)
    - tags: 字串陣列，例如 ["免費諮詢", "門診", "24小時"] (請根據地標特徵自動打上 1-3 個標籤)
    - custom_fields: 物件，若資料中有其他極為重要的自訂欄位，請將其鍵名冠以 "custom_"，並放入此物件中。例如原始欄位為「院長姓名」，請對應為 {{"custom_director": "院長名字"}}
    
    【輸出 JSON 根節點格式】
    {{
      "metadata": {{
        "title": "地圖標題 (例如：臺南市戒菸門診地圖)",
        "description": "地圖簡介與用途聲明",
        "category": "地圖主分類 (例如：健康醫療)",
        "source_name": "資料提供單位",
        "source_url": "資料來源網址",
        "source_date": "資料發布或更新日期 (格式範例: 2026-06)"
      }},
      "points": [
        // 標準點位陣列...
      ],
      "confidence": {{
        "name_mapping_score": 0.95, // 欄位映射與名稱對齊信心分數 (0.0 ~ 1.0)
        "address_quality_score": 0.90, // 地址品質與提取精確度評分 (0.0 ~ 1.0)
        "overall_score": 0.93 // 整體信心分數 (0.0 ~ 1.0)
      }}
    }}
    
    【輸出限制】
    - 請直接回傳符合上述結構的 JSON 字串。
    - 嚴禁回傳任何 markdown 包裝外框 (例如不要有 ```json 或是 ``` 等符號)。
    
    【原始輸入資料】
    {raw_content}
    """
    
    print("[INFO] 正在呼叫 Gemini 模型進行 AI Schema 對齊與映射...")
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        output_text = response.text.strip()
        
        # 預防 LLM 加上 markdown 外框
        if output_text.startswith("```json"):
            output_text = output_text[7:]
        if output_text.endswith("```"):
            output_text = output_text[:-3]
        output_text = output_text.strip()
        
        parsed_data = json.loads(output_text)
    except Exception as e:
        print(f"[ERROR] Gemini 解析或 JSON 轉換失敗: {e}")
        if 'response' in locals() and response.text:
            print("--- 原始模型回傳結果 ---")
            print(response.text)
        sys.exit(1)
        
    # 品質校驗 1：信心分數閾值過濾
    confidence = parsed_data.get("confidence", {})
    overall_score = confidence.get("overall_score", 0.0)
    print(f"\n[AI 對齊完成] 信心評分報告:")
    print(f"  - 欄位映射信心: {confidence.get('name_mapping_score', 0.0)}")
    print(f"  - 地址提取品質: {confidence.get('address_quality_score', 0.0)}")
    print(f"  - 整體綜合信心: {overall_score}")
    
    if overall_score < args.threshold:
        print(f"[WARN] 警告：整體綜合信心分數 ({overall_score}) 低於設定閾值 ({args.threshold})！")
        confirm = input("是否仍要繼續匯入？(y/N): ").strip().lower()
        if confirm != 'y':
            print("[INFO] 使用者取消匯入。")
            sys.exit(0)
            
    points = parsed_data.get("points", [])
    metadata = parsed_data.get("metadata", {})
    print(f"\n[SUCCESS] AI 成功提取了 {len(points)} 筆地標點位，以及地圖 metadata:")
    print(f"  - 地圖標題: {metadata.get('title')}")
    print(f"  - 主分類: {metadata.get('category')}")
    print(f"  - 資料來源: {metadata.get('source_name')}")

    # 品質校驗 2：合理經緯度區間與重複檢查
    valid_points = []
    seen_names = set()
    for p in points:
        name = p.get("name", "").strip()
        if not name:
            continue
        if name in seen_names:
            print(f"  [Deduplicate] 過濾重複的地標點: {name}")
            continue
        seen_names.add(name)
        valid_points.append(p)
        
    points = valid_points

    # 🧭 本地地理編碼 (OSM Nominatim API 備援)
    if args.geocode:
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
                    print(f"    -> 解析失敗，請後續於試算表中手動校對。")
                    
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
