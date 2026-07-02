import os
import sys
import json
import re
import ssl
import io
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

def main():
    load_env()
    
    gas_api_url = os.environ.get("GAS_API_URL")
    if not gas_api_url:
        print("[ERROR] 本地 .env 中未配置 GAS_API_URL，無法寫入雲端試算表。")
        sys.exit(1)
        
    url = "https://ttc.hpa.gov.tw/Web/Agency.aspx"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
    }
    
    context = ssl._create_unverified_context()
    
    # 1. 第一階段：取得網頁初始狀態以解析 VIEWSTATE 與 臺南市的 Option Value
    print("[INFO] 正在連接國健署合約機構查詢網頁...")
    req_get = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req_get, context=context, timeout=20) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"[ERROR] 連接國健署官網失敗: {e}")
        sys.exit(1)
        
    # 提取 ASP.NET 必要欄位
    def find_hidden(name, text):
        match = re.search(r'id="' + name + r'"\s+value="([^"]*)"', text)
        if not match:
            # 備援 regex
            match = re.search(r'name="' + name + r'"[^>]*value="([^"]*)"', text)
        return match.group(1) if match else ""
        
    viewstate = find_hidden("__VIEWSTATE", html)
    eventval = find_hidden("__EVENTVALIDATION", html)
    generator = find_hidden("__VIEWSTATEGENERATOR", html)
    
    if not viewstate:
        print("[ERROR] 無法取得網頁狀態 (__VIEWSTATE)，國健署網站結構可能已改變。")
        sys.exit(1)
        
    # 動態尋找「臺南市」對應的選項 value
    # 例如：<option value="15">臺南市</option>
    city_match = re.search(r'<option[^>]*value="([^"]*)"[^>]*>[^<]*臺南市[^<]*</option>', html)
    if not city_match:
        print("[WARN] 無法在下拉選單中找到『臺南市』選項，預設使用代碼 '14' (台南市常見代碼)")
        city_code = "14"
    else:
        city_code = city_match.group(1)
        print(f"[INFO] 成功解析『臺南市』之選項代碼: '{city_code}'")
        
    # 2. 第二階段：發送 POST 請求模擬點擊「匯出Excel」
    print("[INFO] 正在發送查詢並請求導出 Excel 檔案...")
    
    post_fields = {
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "__VIEWSTATE": viewstate,
        "__VIEWSTATEGENERATOR": generator,
        "__EVENTVALIDATION": eventval,
        "ctl00$ContentPlaceHolder1$ddl_AreaCodeA": city_code,
        "ctl00$ContentPlaceHolder1$ddl_AreaCodeB": "", # 全部鄉鎮區
        "ctl00$ContentPlaceHolder1$btn_Export": "匯出Excel" # 觸發匯出 Excel
    }
    
    post_data = urllib.parse.urlencode(post_fields).encode('utf-8')
    req_post = urllib.request.Request(
        url,
        data=post_data,
        headers=headers,
        method='POST'
    )
    
    # 加上 Content-Type 表單頭部
    req_post.add_header('Content-Type', 'application/x-www-form-urlencoded')
    
    try:
        with urllib.request.urlopen(req_post, context=context, timeout=30) as response:
            content_type = response.headers.get('Content-Type', '')
            excel_bytes = response.read()
    except Exception as e:
        print(f"[ERROR] 請求導出 Excel 失敗: {e}")
        sys.exit(1)
        
    if "html" in content_type.lower() or len(excel_bytes) < 1000:
        print("[ERROR] 國健署網站未返回正確的 Excel 二進位檔，可能查詢失敗或被防火牆阻擋。")
        sys.exit(1)
        
    print(f"[INFO] 成功獲取 Excel 數據流 (大小: {len(excel_bytes)} bytes)。")
    
    # 3. 第三階段：使用 openpyxl 解析記憶體中的 Excel
    try:
        import openpyxl
    except ImportError:
        print("[ERROR] 請先安裝 openpyxl 套件：pip install openpyxl")
        sys.exit(1)
        
    try:
        wb = openpyxl.load_workbook(io.BytesIO(excel_bytes), data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
    except Exception as e:
        print(f"[ERROR] 無法解析下載的 Excel 檔案: {e}")
        sys.exit(1)
        
    if not rows:
        print("[ERROR] Excel 檔案內容為空。")
        sys.exit(1)
        
    headers_excel = [str(cell).strip() if cell is not None else f"Column_{idx}" for idx, cell in enumerate(rows[0])]
    data_rows = []
    for r in rows[1:]:
        if not any(cell is not None for cell in r):
            continue
        row_dict = {}
        for col_idx, cell in enumerate(r):
            if col_idx < len(headers_excel):
                row_dict[headers_excel[col_idx]] = str(cell).strip() if cell is not None else ""
        data_rows.append(row_dict)
        
    print(f"[INFO] 成功解析最新數據，共載入 {len(data_rows)} 筆合約據點資料。")
    
    # 4. 第四階段：標準化對齊 POINTS Schema
    points = []
    for idx, row in enumerate(data_rows):
        name = row.get("機構名稱", "").strip()
        address = row.get("機構地址", "").strip()
        level = row.get("機構層級", "").strip()
        phone = row.get("機構電話", "").strip()
        code = row.get("機構代碼", "").strip()
        
        if not name:
            continue
            
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
            if "衛生所" in name:
                category = "衛生所"
            elif "藥局" in name:
                category = "藥局"
            elif "醫院" in name:
                category = "醫院"
                
        address = fix_traditional_chinese_typos(address)
        district = ""
        dist_match = re.search(r'臺南市([^區鄉鎮市]+?[區鄉鎮市])', address)
        if dist_match:
            district = dist_match.group(1)
            
        tags = []
        if row.get("給藥") == "V":
            tags.append("給藥")
        if row.get("衛教") == "V":
            tags.append("衛教")
            
        point = {
            "id": code if code else f"quit-{idx + 1}",
            "name": fix_traditional_chinese_typos(name),
            "lat": "", 
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
        
    print(f"[INFO] 對齊完成，共整理出 {len(points)} 筆最新標準點位。")
    
    # 5. 第五階段：匯入 GAS 試算表
    metadata = {
        "title": "臺南市合約戒菸機構與藥局地圖",
        "description": "提供臺南市內合約戒菸醫療院所、衛生所與健保調劑藥局資訊，支援即時導航與撥號諮詢。",
        "category": "健康醫療",
        "source_name": "衛生福利部國民健康署",
        "source_url": "https://ttc.hpa.gov.tw/Web/Agency.aspx",
        "source_date": "2026-06-30", # 可改為今日，但為了跟檔案對齊使用 2026-06-30 或動態今日
        "automation_level": "full-auto",
        "maintainer": "etrnya"
    }
    
    # 動態獲取今天日期
    import datetime
    today_str = datetime.date.today().isoformat()
    metadata["source_date"] = today_str # 將來源日期設為今天 (即最新下載時間！)
    
    import_log = {
        "status": "success",
        "total_count": len(data_rows),
        "success_count": len(points),
        "failed_count": 0,
        "duplicate_count": 0,
        "notes": f"Auto Crawled & Sync from HPA Website on {today_str}. Awaiting GAS Geocoding."
    }
    
    payload = {
        "action": "import",
        "map_id": "quit-smoking",
        "metadata": metadata,
        "points": points,
        "import_log": import_log
    }
    
    print("[INFO] 正在連線至 Apps Script API 寫入最新數據...")
    result = post_to_gas(gas_api_url, payload)
    
    if result and result.get("success"):
        print(f"\n[SUCCESS] 成功從國健署網站同步了 {len(points)} 筆最新臺南市戒菸機構資料！")
        print("[HINT] 請於 Google Sheets 點選選單：[Sheet2Map] -> [地址地理編碼 (Geocode Addresses)]")
        print("       GAS 將自動調用 Google 地理編碼，補齊最新機構的經緯度座標。")
    else:
        error_msg = result.get("error") if result else "無回應或連線超時"
        print(f"\n[ERROR] 匯入失敗: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
