import os
import sys
import json
import re
import ssl
import urllib.request
import urllib.parse
import urllib.error
import datetime

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

def fetch_csv_ignore_ssl(url):
    context = ssl._create_unverified_context()
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=context, timeout=20) as response:
            return response.read().decode('utf-8-sig') # 優先使用 utf-8-sig 處理 BOM
    except Exception as e:
        print(f"  [WARN] 無法從 URL 下載資料: {e}")
        return None

def main():
    load_env()
    gas_api_url = os.environ.get("GAS_API_URL")
    if not gas_api_url:
        print("[ERROR] 本地 .env 中未配置 GAS_API_URL，無法寫入雲端試算表。")
        sys.exit(1)
        
    points = []
    
    # ==========================================
    # 1. 處理「臺南市公共廁所」資料
    # ==========================================
    print("[INFO] 正在處理『臺南市公共廁所』資料...")
    restroom_url = "https://envopendata.moenv.gov.tw/api/v2/fac_p_30?api_key=e8ddf22c-a839-4a2a-b319-24d35e1129e7&format=csv" 
    # 💡 備用免費 api_key，若失效退回到本地 CSV 讀取
    
    restroom_csv = fetch_csv_ignore_ssl(restroom_url)
    
    # 備援：若網路失敗，嘗試讀取本地檔案
    local_restroom_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TainanRestroom.csv")
    if not restroom_csv:
        if os.path.exists(local_restroom_path):
            print(f"  [INFO] 網路下載失敗，正從本地讀取: {local_restroom_path}...")
            with open(local_restroom_path, "r", encoding="utf-8-sig") as f:
                restroom_csv = f.read()
        else:
            print("  [ERROR] 無法獲取公廁資料（網路下載失敗且無本地備援 TainanRestroom.csv 檔案）。")
            sys.exit(1)
            
    # 解析公廁 CSV
    try:
        f_io = restroom_csv.strip().splitlines()
        reader = csv.reader(f_io)
        headers = next(reader)
        
        # 尋找關鍵欄位索引 (容錯處理，相容 API 和 data.gov.tw 表頭)
        city_idx = -1
        dist_idx = -1
        name_idx = -1
        addr_idx = -1
        lat_idx = -1
        lng_idx = -1
        cat_idx = -1 # 公廁類別
        level_idx = -1 # 等級
        diaper_idx = -1 # 是否設有尿布台
        
        for idx, h in enumerate(headers):
            h_clean = h.strip().replace("\"", "")
            if "縣市" in h_clean: city_idx = idx
            elif "鄉鎮" in h_clean or "行政區" in h_clean: dist_idx = idx
            elif "名稱" in h_clean or "建檔名稱" in h_clean: name_idx = idx
            elif "地址" in h_clean: addr_idx = idx
            elif "緯度" in h_clean or "lat" in h_clean.lower(): lat_idx = idx
            elif "經度" in h_clean or "lng" in h_clean.lower(): lng_idx = idx
            elif "類別" in h_clean or "公廁類別" in h_clean: cat_idx = idx
            elif "等級" in h_clean or "公廁等級" in h_clean: level_idx = idx
            elif "尿布" in h_clean: diaper_idx = idx
            
        restroom_count = 0
        for r_idx, r in enumerate(reader):
            if len(r) < len(headers):
                continue
            city = r[city_idx].strip() if city_idx != -1 else "臺南市"
            if "臺南" not in city and "台南" not in city:
                continue # 只篩選臺南市的公廁
                
            name = r[name_idx].strip() if name_idx != -1 else ""
            address = r[addr_idx].strip() if addr_idx != -1 else ""
            lat_str = r[lat_idx].strip() if lat_idx != -1 else ""
            lng_str = r[lng_idx].strip() if lng_idx != -1 else ""
            
            if not name:
                continue
                
            lat = 0.0
            lng = 0.0
            try:
                if lat_str: lat = float(lat_str)
                if lng_str: lng = float(lng_str)
            except ValueError:
                pass
                
            category = "公共廁所"
            district = r[dist_idx].strip() if dist_idx != -1 else ""
            
            # 公廁等級與類別
            p_cat = r[cat_idx].strip() if cat_idx != -1 else "一般公廁"
            p_level = r[level_idx].strip() if level_idx != -1 else "普通級"
            diaper = r[diaper_idx].strip() if diaper_idx != -1 else "否"
            
            tags = [p_cat, p_level]
            desc_parts = [f"【公廁等級】{p_level}", f"【公廁類別】{p_cat}"]
            
            if "是" in diaper or "V" in diaper or "y" in diaper.lower():
                tags.append("尿布檯")
                desc_parts.append("👶 提供嬰幼兒尿布檯")
                
            # 建立點位
            point = {
                "id": f"wc-{r_idx+1}",
                "name": fix_traditional_chinese_typos(name),
                "lat": lat,
                "lng": lng,
                "category": category,
                "address": fix_traditional_chinese_typos(address),
                "district": fix_traditional_chinese_typos(district),
                "phone": "",
                "website": "",
                "description": "\n".join(desc_parts),
                "image": "",
                "opening_hours": "依公眾場所開放時間",
                "tags": tags
            }
            points.append(point)
            restroom_count += 1
            
        print(f"  [SUCCESS] 成功解析 {restroom_count} 筆臺南市公共公廁點位！")
    except Exception as e:
        print(f"  [ERROR] 解析公廁 CSV 失敗: {e}")
        sys.exit(1)
        
    # ==========================================
    # 2. 處理「臺南市哺(集)乳室」資料
    # ==========================================
    print("\n[INFO] 正在處理『臺南市哺(集)乳室』資料...")
    nursing_url = "https://data.gov.tw/dataset/132152" 
    # 💡 由於 data.gov.tw 網頁通常需要 API 或是靜態下載，我們設定固定的 CSV 下載路徑：
    nursing_download_url = "https://data.tainan.gov.tw/dataset/406085a6-ee32-4756-9d33-4f9e6df7db00/resource/35532585-dfa8-4228-a6cf-be79be357e6a/download/mammyroom.csv"
    
    nursing_csv = fetch_csv_ignore_ssl(nursing_download_url)
    
    # 備援：嘗試本地讀取
    local_nursing_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TainanNursing.csv")
    if not nursing_csv:
        if os.path.exists(local_nursing_path):
            print(f"  [INFO] 網路下載失敗，正從本地讀取: {local_nursing_path}...")
            with open(local_nursing_path, "r", encoding="utf-8-sig") as f:
                nursing_csv = f.read()
        else:
            print("  [WARN] 無法獲取哺集乳室資料（網路下載失敗且無本地備援 TainanNursing.csv 檔案）。將僅匯入公廁點位。")
            
    if nursing_csv:
        try:
            f_io = nursing_csv.strip().splitlines()
            reader = csv.reader(f_io)
            headers = next(reader)
            
            # 欄位索引
            name_idx = -1
            addr_idx = -1
            dist_idx = -1
            phone_idx = -1
            
            for idx, h in enumerate(headers):
                h_clean = h.strip()
                if "場所名稱" in h_clean or "單位" in h_clean: name_idx = idx
                elif "地址" in h_clean: addr_idx = idx
                elif "區域" in h_clean or "行政區" in h_clean: dist_idx = idx
                elif "電話" in h_clean: phone_idx = idx
                
            nursing_count = 0
            for r_idx, r in enumerate(reader):
                if len(r) < len(headers):
                    continue
                name = r[name_idx].strip() if name_idx != -1 else ""
                address = r[addr_idx].strip() if addr_idx != -1 else ""
                
                if not name:
                    continue
                    
                district = r[dist_idx].strip() if dist_idx != -1 else ""
                phone = r[phone_idx].strip() if phone_idx != -1 else ""
                
                # 哺集乳室無座標，座標填為空，待 GAS geocoding 定位！
                point = {
                    "id": f"ns-{r_idx+1}",
                    "name": fix_traditional_chinese_typos(name),
                    "lat": "", 
                    "lng": "",
                    "category": "哺集乳室",
                    "address": fix_traditional_chinese_typos(address),
                    "district": fix_traditional_chinese_typos(district),
                    "phone": phone,
                    "website": "",
                    "description": "衛生局登記認證之哺(集)乳室，提供溫馨、隱密與安全的親子育兒環境。",
                    "image": "",
                    "opening_hours": "依機構開放時間",
                    "tags": ["哺集乳室", "親子友善"]
                }
                points.append(point)
                nursing_count += 1
                
            print(f"  [SUCCESS] 成功解析 {nursing_count} 筆臺南市哺集乳室點位！")
        except Exception as e:
            print(f"  [ERROR] 解析哺集乳室 CSV 失敗: {e}")
            
    print(f"\n[INFO] 整合完成，共整理出 {len(points)} 筆標準點位。")
    
    # 建立地圖詮釋資料 (MAP_METADATA)
    metadata = {
        "title": "臺南市友善公廁與哺集乳室地圖",
        "description": "提供臺南市內公共廁所、無障礙廁所、親子尿布檯及衛生局認證之溫馨哺(集)乳室設置據點查詢。",
        "category": "生活應急",
        "source_name": "環境部環境管理署、臺南市政府衛生局",
        "source_url": "https://envopendata.moenv.gov.tw/dataset/FAC_P_30",
        "source_date": datetime.date.today().isoformat(),
        "automation_level": "full-auto",
        "maintainer": "etrnya"
    }
    
    import_log = {
        "status": "success",
        "total_count": len(points),
        "success_count": len(points),
        "failed_count": 0,
        "duplicate_count": 0,
        "notes": "Restroom and Nursing Room Map Direct Import. Awaiting GAS Geocoding for nursing rooms."
    }
    
    payload = {
        "action": "import",
        "map_id": "restroom-nursing",
        "metadata": metadata,
        "points": points,
        "import_log": import_log
    }
    
    print("[INFO] 正在連線至 Apps Script API 寫入試算表 (restroom-nursing)...")
    result = post_to_gas(gas_api_url, payload)
    
    if result and result.get("success"):
        print("\n[SUCCESS] 成功將公廁與哺集乳室點位直裝寫入 Google Sheets POINTS 頁面！")
        print("[HINT] 💡 由於哺集乳室資料無座標，請開啟對應試算表並點選：")
        print("       [Sheet2Map] -> [地址地理編碼 (Geocode Addresses)]，補齊哺集乳室的經緯度！")
    else:
        error_msg = result.get("error") if result else "無回應或連線超時"
        print(f"\n[ERROR] 匯入失敗: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
