import os
import sys
import json
import re
import ssl
import csv
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
        with urllib.request.urlopen(req, context=context, timeout=25) as response:
            return response.read().decode('utf-8-sig') # 優先以 utf-8-sig 處理 BOM
    except Exception as e:
        print(f"  [WARN] 無法從 URL 下載防災資料: {e}")
        return None

def main():
    load_env()
    gas_api_url = os.environ.get("GAS_API_URL")
    if not gas_api_url:
        print("[ERROR] 本地 .env 中未配置 GAS_API_URL，無法寫入雲端試算表。")
        sys.exit(1)
        
    points = []
    
    # ==========================================
    # 處理「防災與避難收容處所」資料
    # ==========================================
    print("[INFO] 正在下載『全國防災避難收容處所』Open Data...")
    
    # 💡 內政部消防署全國避難收容處所開放 CSV 下載連結 (使用 NCDR 的固定下載網址或備用下載)
    shelter_url = "https://datahub.ncdr.nat.gov.tw/api/v1/dataset/178000000A-000030/resource/csv" 
    # 這是一個穩定的 NCDR API 下載連結
    
    shelter_csv = fetch_csv_ignore_ssl(shelter_url)
    
    # 備援：若下載失敗，嘗試讀取本地檔案
    local_shelter_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TainanShelter.csv")
    if not shelter_csv:
        if os.path.exists(local_shelter_path):
            print(f"  [INFO] 網路下載失敗，正從本地讀取: {local_shelter_path}...")
            with open(local_shelter_path, "r", encoding="utf-8-sig") as f:
                shelter_csv = f.read()
        else:
            print("  [ERROR] 無法獲取防災收容資料（網路下載失敗且無本地備援 TainanShelter.csv 檔案）。")
            sys.exit(1)
            
    # 解析避難收容處所 CSV
    try:
        f_io = shelter_csv.strip().splitlines()
        reader = csv.reader(f_io)
        headers = next(reader)
        
        # 尋找關鍵欄位索引 (NCDR / 消防署格式)
        city_idx = -1
        dist_idx = -1
        name_idx = -1
        addr_idx = -1
        lat_idx = -1
        lng_idx = -1
        capacity_idx = -1 # 可收容人數
        phone_idx = -1 # 聯絡電話
        
        for idx, h in enumerate(headers):
            h_clean = h.strip().replace("\"", "")
            if "縣市" in h_clean or "County" in h_clean: city_idx = idx
            elif "鄉鎮" in h_clean or "行政區" in h_clean or "Town" in h_clean: dist_idx = idx
            elif "名稱" in h_clean or "Name" in h_clean: name_idx = idx
            elif "地址" in h_clean or "Address" in h_clean: addr_idx = idx
            elif "緯度" in h_clean or "Latitude" in h_clean or "lat" in h_clean.lower(): lat_idx = idx
            elif "經度" in h_clean or "Longitude" in h_clean or "lng" in h_clean.lower(): lng_idx = idx
            elif "容量" in h_clean or "人數" in h_clean or "Capacity" in h_clean: capacity_idx = idx
            elif "電話" in h_clean or "Phone" in h_clean: phone_idx = idx
            
        # 若欄位沒配對齊，嘗試以位置預設 (通常消防署 CSV 格式)
        if name_idx == -1: name_idx = 1
        if city_idx == -1: city_idx = 2
        if dist_idx == -1: dist_idx = 3
        if addr_idx == -1: addr_idx = 4
        if lat_idx == -1: lat_idx = 5
        if lng_idx == -1: lng_idx = 6
        
        shelter_count = 0
        for r_idx, r in enumerate(reader):
            if len(r) < len(headers):
                continue
                
            city = r[city_idx].strip() if city_idx < len(r) else "臺南市"
            if "臺南" not in city and "台南" not in city:
                continue # 只篩選臺南市的避難處所
                
            name = r[name_idx].strip() if name_idx < len(r) else ""
            address = r[addr_idx].strip() if addr_idx < len(r) else ""
            lat_str = r[lat_idx].strip() if lat_idx < len(r) else ""
            lng_str = r[lng_idx].strip() if lng_idx < len(r) else ""
            
            if not name:
                continue
                
            lat = 0.0
            lng = 0.0
            try:
                if lat_str: lat = float(lat_str)
                if lng_str: lng = float(lng_str)
            except ValueError:
                pass
                
            district = r[dist_idx].strip() if dist_idx < len(r) else ""
            phone = r[phone_idx].strip() if (phone_idx != -1 and phone_idx < len(r)) else ""
            capacity = r[capacity_idx].strip() if (capacity_idx != -1 and capacity_idx < len(r)) else "未明"
            
            category = "防災避難所"
            tags = ["避難收容"]
            
            # 依容納人數打標籤
            try:
                cap_num = int(re.sub(r"\D", "", capacity))
                if cap_num >= 500:
                    tags.append("大型收容所")
                elif cap_num >= 100:
                    tags.append("中型收容所")
                else:
                    tags.append("小型收容所")
            except:
                tags.append("一般收容所")
                
            desc_parts = [
                f"【可收容人數】{capacity} 人",
                "【災害避難用途】提供地震、風災後臨時安置與物資發放"
            ]
            if phone:
                desc_parts.append(f"【聯絡電話】{phone}")
                
            # 建立點位
            point = {
                "id": f"shelter-{r_idx+1}",
                "name": fix_traditional_chinese_typos(name),
                "lat": lat,
                "lng": lng,
                "category": category,
                "address": fix_traditional_chinese_typos(address),
                "district": fix_traditional_chinese_typos(district),
                "phone": phone,
                "website": "",
                "description": "\n".join(desc_parts),
                "image": "",
                "opening_hours": "災時緊急開設",
                "tags": tags
            }
            points.append(point)
            shelter_count += 1
            
        print(f"  [SUCCESS] 成功篩選出 {shelter_count} 筆臺南市防災避難收容處所！")
    except Exception as e:
        print(f"  [ERROR] 解析避難收容處所 CSV 失敗: {e}")
        sys.exit(1)
        
    if len(points) == 0:
        print("[WARN] 沒有符合條件的點位，匯入取消。")
        sys.exit(0)
        
    # 建立地圖詮釋資料 (MAP_METADATA)
    metadata = {
        "title": "臺南市防災與避難收容地圖",
        "description": "提供臺南市各行政區防災避難收容處所（學校、活動中心）的地點、容納人數及緊急聯絡資訊。",
        "category": "防災安全",
        "source_name": "內政部消防署",
        "source_url": "https://data.gov.tw/",
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
        "notes": "Tainan Disaster Shelter Map Direct Import."
    }
    
    payload = {
        "action": "import",
        "map_id": "disaster-shelter",
        "metadata": metadata,
        "points": points,
        "import_log": import_log
    }
    
    print("[INFO] 正在連線至 Apps Script API 寫入試算表 (disaster-shelter)...")
    result = post_to_gas(gas_api_url, payload)
    
    if result and result.get("success"):
        print("\n[SUCCESS] 成功將防災避難所點位直裝寫入 Google Sheets POINTS 頁面！")
    else:
        error_msg = result.get("error") if result else "無回應或連線超時"
        print(f"\n[ERROR] 匯入失敗: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
