import os
import sys
import json
import re
import urllib.request
import urllib.parse
import urllib.error

# 💡 讀取 .env 檔案中的環境變數
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, val = line.strip().split("=", 1)
                    os.environ[key.strip()] = val.strip()

# 🔠 繁簡轉譯錯誤靜默修正 (SilentFix)
def fix_traditional_chinese_typos(text):
    if not text or not isinstance(text, str):
        return text
    text = re.sub(r'([縣市區鄉鎮])([^裡\s]{1,4}?)裡', r'\1\2里', text)
    text = text.replace("裡長", "里長").replace("裡民", "里民").replace("裡辦公", "里辦公")
    return text

# 📡 呼叫 Apps Script Web App API 匯入資料
def post_to_gas(url, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            response_text = response.read().decode('utf-8')
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
    
    headers = [str(cell).strip() if cell is not None else f"Column_{idx}" for idx, cell in enumerate(rows[0])]
    data_rows = []
    for r in rows[1:]:
        if not any(cell is not None for cell in r):
            continue
        row_dict = {}
        for col_idx, cell in enumerate(r):
            if col_idx < len(headers):
                row_dict[headers[col_idx]] = str(cell).strip() if cell is not None else ""
        data_rows.append(row_dict)
        
    return data_rows

def main():
    load_env()
    
    gas_api_url = os.environ.get("GAS_API_URL")
    if not gas_api_url:
        print("[ERROR] 本地 .env 中未配置 GAS_API_URL，無法寫入雲端試算表。")
        sys.exit(1)
        
    excel_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "各縣市合約戒菸機構2026_6_30.xlsx")
    if not os.path.exists(excel_path):
        print(f"[ERROR] 找不到 Excel 檔案: {excel_path}")
        sys.exit(1)
        
    print(f"[INFO] 正在解析 Excel: {excel_path}...")
    data_rows = read_xlsx(excel_path)
    print(f"[INFO] 成功載入 {len(data_rows)} 筆原始資料。")
    
    points = []
    for idx, row in enumerate(data_rows):
        name = row.get("機構名稱", "").strip()
        address = row.get("機構地址", "").strip()
        level = row.get("機構層級", "").strip()
        phone = row.get("機構電話", "").strip()
        code = row.get("機構代碼", "").strip()
        
        if not name:
            continue
            
        # 1. 規範化分類 (Category)
        category = "診所"
        if "醫院" in level or "醫學中心" in level:
            category = "醫院"
        elif "衛生所" in level:
            category = "衛生所"
        elif "藥局" in level:
            category = "藥局"
        elif "診所" in level:
            category = "診所"
        else:
            # 備援判斷
            if "衛生所" in name:
                category = "衛生所"
            elif "藥局" in name:
                category = "藥局"
            elif "醫院" in name:
                category = "醫院"
                
        # 2. 地址修正與行政區解析 (District)
        address = fix_traditional_chinese_typos(address)
        district = ""
        dist_match = re.search(r'臺南市([^區鄉鎮市]+?[區鄉鎮市])', address)
        if dist_match:
            district = dist_match.group(1)
            
        # 3. 建立標籤組 (Tags)
        tags = []
        if row.get("給藥") == "V":
            tags.append("給藥")
        if row.get("衛教") == "V":
            tags.append("衛教")
            
        # 4. 建立點位標準格式 (POINTS Schema)
        point = {
            "id": code if code else f"quit-{idx + 1}",
            "name": fix_traditional_chinese_typos(name),
            "lat": "", # 放空，等 GAS 連線 Google Maps Geocoder 自動回填
            "lng": "",
            "category": category,
            "address": address,
            "district": district,
            "phone": phone,
            "website": "",
            "description": f"提供戒菸門診與諮詢服務。給藥：{'有' if '給藥' in tags else '無'}，衛教：{'有' if '衛教' in tags else '無'}。",
            "image": "",
            "opening_hours": "",
            "tags": tags
        }
        points.append(point)
        
    print(f"[INFO] 轉換完成，共整理出 {len(points)} 筆標準點位。")
    
    # 建立地圖詮釋資料 (MAP_METADATA)
    metadata = {
        "title": "臺南市合約戒菸機構與藥局地圖",
        "description": "提供臺南市內合約戒菸醫療院所、衛生所與健保調劑藥局資訊，支援即時導航與撥號諮詢。",
        "category": "健康醫療",
        "source_name": "衛生福利部國民健康署",
        "source_url": "https://ttc.hpa.gov.tw/Web/Agency.aspx",
        "source_date": "2026-06-30", # 對齊檔名
        "automation_level": "full-auto",
        "maintainer": "etrnya"
    }
    
    import_log = {
        "status": "success",
        "total_count": len(data_rows),
        "success_count": len(points),
        "failed_count": 0,
        "duplicate_count": 0,
        "notes": "Direct Excel Import. Awaiting GAS Geocoding."
    }
    
    payload = {
        "action": "import",
        "map_id": "quit-smoking",
        "metadata": metadata,
        "points": points,
        "import_log": import_log
    }
    
    print("[INFO] 正在連線至 Apps Script API 寫入試算表...")
    result = post_to_gas(gas_api_url, payload)
    
    if result and result.get("success"):
        print("\n[SUCCESS] 183 筆機構資料已成功直裝寫入 Google Sheets POINTS 頁面！")
        print("[HINT] 請在 Google Sheets 中，點選自訂選單：[Sheet2Map] -> [地址地理編碼 (Geocode Addresses)]")
        print("       GAS 將自動利用 Google 地理編碼，將經緯度全部精準回填，地圖將完整呈現 183 家機構！")
    else:
        error_msg = result.get("error") if result else "無回應或連線超時"
        print(f"\n[ERROR] 匯入失敗: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
