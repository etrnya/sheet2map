import os
import sys
import json
import re
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

# 行政區代碼對照表
CITY_DISTRICTS = {
    "67000010": "新營區", "67000020": "鹽水區", "67000030": "白河區", "67000040": "柳營區",
    "67000050": "後壁區", "67000060": "東山區", "67000070": "麻豆區", "67000080": "下營區",
    "67000090": "六甲區", "67000100": "官田區", "67000110": "大內區", "67000120": "佳里區",
    "67000130": "學甲區", "67000140": "西港區", "67000150": "七股區", "67000160": "將軍區",
    "67000170": "北門區", "67000180": "新化區", "67000190": "新市區", "67000200": "安南區",
    "67000210": "東區", "67000220": "南區", "67000230": "北區", "67000240": "中西區",
    "67000250": "安平區", "67000270": "仁德區", "67000280": "歸仁區", "67000290": "關廟區",
    "67000300": "龍崎區", "67000320": "永康區", "67000330": "玉井區", "67000340": "楠西區",
    "67000350": "南化區", "67000360": "左鎮區", "67000370": "山上區"
}

def main():
    load_env()
    gas_api_url = os.environ.get("GAS_API_URL")
    if not gas_api_url:
        print("[ERROR] 本地 .env 中未配置 GAS_API_URL，無法寫入雲端試算表。")
        sys.exit(1)
        
    points = []
    
    base_dir = os.path.dirname(os.path.dirname(__file__))
    
    # ==========================================
    # 1. 處理「建檔公廁明細-臺南市.csv」
    # ==========================================
    restroom_path = os.path.join(base_dir, "建檔公廁明細-臺南市.csv")
    print(f"[INFO] 正在處理公廁資料: {os.path.basename(restroom_path)}...")
    
    if not os.path.exists(restroom_path):
        print(f"[ERROR] 找不到公廁 CSV 檔案: {restroom_path}")
        sys.exit(1)
        
    restroom_count = 0
    try:
        with open(restroom_path, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            headers = next(reader)
            
            # 欄位索引對齊
            city_idx = headers.index("county") if "county" in headers else 0
            dist_idx = headers.index("areacode") if "areacode" in headers else 1
            village_idx = headers.index("village") if "village" in headers else 2
            name_idx = headers.index("name") if "name" in headers else 4
            addr_idx = headers.index("address") if "address" in headers else 5
            lat_idx = headers.index("latitude") if "latitude" in headers else 7
            lng_idx = headers.index("longitude") if "longitude" in headers else 8
            grade_idx = headers.index("grade") if "grade" in headers else 9
            type_idx = headers.index("type") if "type" in headers else 11
            diaper_idx = headers.index("diaper") if "diaper" in headers else 13
            
            for r_idx, r in enumerate(reader):
                if len(r) < len(headers):
                    continue
                name = r[name_idx].strip()
                address = r[addr_idx].strip()
                
                if not name:
                    continue
                    
                lat = 0.0
                lng = 0.0
                try:
                    if r[lat_idx].strip(): lat = float(r[lat_idx].strip())
                    if r[lng_idx].strip(): lng = float(r[lng_idx].strip())
                except ValueError:
                    pass
                    
                category = "公共廁所"
                
                # 從 areacode 取得行政區
                code = r[dist_idx].strip()
                district = CITY_DISTRICTS.get(code, "")
                if not district:
                    # 嘗試從地址前段截取區
                    match = re.search(r'([^\s]+?區)', address)
                    district = match.group(1) if match else ""
                
                p_level = r[grade_idx].strip()
                p_type = r[type_idx].strip()
                diaper = r[diaper_idx].strip()
                
                tags = [p_type, p_level]
                desc_parts = [f"【公廁等級】{p_level}", f"【公廁類型】{p_type}"]
                
                if diaper == "1" or "是" in diaper or diaper == "y" or diaper == "Y":
                    tags.append("尿布檯")
                    desc_parts.append("👶 提供嬰幼兒尿布檯")
                    
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
        print(f"  [SUCCESS] 成功匯入 {restroom_count} 筆公共公廁點位！")
    except Exception as e:
        print(f"  [ERROR] 解析公廁 CSV 失敗: {e}")
        sys.exit(1)

    # ==========================================
    # 2. 處理「臺南市法定設置哺集乳室-1141122更新.csv」
    # ==========================================
    legal_path = os.path.join(base_dir, "臺南市法定設置哺集乳室-1141122更新.csv")
    print(f"\n[INFO] 正在處理法定哺集乳室: {os.path.basename(legal_path)}...")
    
    legal_count = 0
    if os.path.exists(legal_path):
        try:
            with open(legal_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                headers = next(reader)
                
                name_idx = headers.index("場所名稱")
                phone_idx = headers.index("市話")
                code_idx = headers.index("地址-行政區域代碼")
                village_idx = headers.index("地址-村里")
                street_idx = headers.index("地址-街路門牌")
                hours_idx = headers.index("開放時間")
                lat_idx = headers.index("緯度") if "緯度" in headers else -1
                lng_idx = headers.index("經度") if "經度" in headers else -1
                
                for r_idx, r in enumerate(reader):
                    if len(r) < len(headers):
                        continue
                    name = r[name_idx].strip()
                    if not name:
                        continue
                        
                    code = r[code_idx].strip()
                    district = CITY_DISTRICTS.get(code, "")
                    village = r[village_idx].strip()
                    street = r[street_idx].strip()
                    
                    # 拼接完整地址
                    address = f"臺南市{district}{village}{street}"
                    
                    lat = ""
                    lng = ""
                    if lat_idx != -1 and lng_idx != -1:
                        lat_str = r[lat_idx].strip()
                        lng_str = r[lng_idx].strip()
                        try:
                            if lat_str: lat = float(lat_str)
                            if lng_str: lng = float(lng_str)
                        except ValueError:
                            pass
                            
                    phone = r[phone_idx].strip()
                    hours = r[hours_idx].strip() if r[hours_idx].strip() else "依機構開放時間"
                    
                    point = {
                        "id": f"ns-legal-{r_idx+1}",
                        "name": fix_traditional_chinese_typos(name),
                        "lat": lat,
                        "lng": lng,
                        "category": "哺集乳室",
                        "address": fix_traditional_chinese_typos(address),
                        "district": fix_traditional_chinese_typos(district),
                        "phone": phone,
                        "website": "",
                        "description": "【設置類型】法定設置哺(集)乳室，提供溫馨、隱密與安全的親子育兒環境。",
                        "image": "",
                        "opening_hours": hours,
                        "tags": ["哺集乳室", "法定設置", "親子友善"]
                    }
                    points.append(point)
                    legal_count += 1
            print(f"  [SUCCESS] 成功匯入 {legal_count} 筆法定哺集乳室點位！")
        except Exception as e:
            print(f"  [ERROR] 解析法定哺集乳室 CSV 失敗: {e}")
    else:
        print(f"  [WARN] 找不到法定哺集乳室檔案: {legal_path}")

    # ==========================================
    # 3. 處理「臺南市自願設置哺集乳室-1141127更新.csv」
    # ==========================================
    voluntary_path = os.path.join(base_dir, "臺南市自願設置哺集乳室-1141127更新.csv")
    print(f"\n[INFO] 正在處理自願設置哺集乳室: {os.path.basename(voluntary_path)}...")
    
    voluntary_count = 0
    if os.path.exists(voluntary_path):
        try:
            with open(voluntary_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                headers = next(reader)
                
                name_idx = headers.index("場所名稱")
                phone_idx = headers.index("電話")
                code_idx = headers.index("地址-行政區域代碼")
                village_idx = headers.index("地址-村里")
                street_idx = headers.index("地址-街路門牌")
                hours_idx = headers.index("開放時間")
                
                for r_idx, r in enumerate(reader):
                    if len(r) < len(headers):
                        continue
                    name = r[name_idx].strip()
                    if not name:
                        continue
                        
                    code = r[code_idx].strip()
                    district = CITY_DISTRICTS.get(code, "")
                    village = r[village_idx].strip()
                    street = r[street_idx].strip()
                    
                    # 拼接完整地址
                    address = f"臺南市{district}{village}{street}"
                    phone = r[phone_idx].strip()
                    hours = r[hours_idx].strip() if r[hours_idx].strip() else "依機構開放時間"
                    
                    # 自願設置哺集乳室無自帶經緯度，填為空，待 GAS geocoding 定位！
                    point = {
                        "id": f"ns-vol-{r_idx+1}",
                        "name": fix_traditional_chinese_typos(name),
                        "lat": "",
                        "lng": "",
                        "category": "哺集乳室",
                        "address": fix_traditional_chinese_typos(address),
                        "district": fix_traditional_chinese_typos(district),
                        "phone": phone,
                        "website": "",
                        "description": "【設置類型】自願設置哺(集)乳室，提供便利且友善的親子哺乳空間。",
                        "image": "",
                        "opening_hours": hours,
                        "tags": ["哺集乳室", "自願設置", "親子友善"]
                    }
                    points.append(point)
                    voluntary_count += 1
            print(f"  [SUCCESS] 成功匯入 {voluntary_count} 筆自願哺集乳室點位！")
        except Exception as e:
            print(f"  [ERROR] 解析自願哺集乳室 CSV 失敗: {e}")
    else:
        print(f"  [WARN] 找不到自願哺集乳室檔案: {voluntary_path}")

    print(f"\n[INFO] 整合完成，共整理出 {len(points)} 筆標準點位。")
    
    # 建立地圖詮釋資料 (MAP_METADATA)
    metadata = {
        "title": "臺南市友善公廁與哺集乳室地圖",
        "description": "提供臺南市內公共廁所、無障礙廁所、親子尿布檯及法定與自願設置之溫馨哺(集)乳室據點查詢。",
        "category": "生活應急",
        "source_name": "環境部環境管理署、臺南市政府衛生局",
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
        "notes": f"Local CSV Import. Restroom: {restroom_count}, Legal Nursing: {legal_count}, Voluntary Nursing: {voluntary_count}."
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
        print("[HINT] 💡 部分自願設置哺集乳室無座標，請開啟對應試算表並點選：")
        print("       [Sheet2Map] -> [地址地理編碼 (Geocode Addresses)]，補齊經緯度！")
    else:
        error_msg = result.get("error") if result else "無回應或連線超時"
        print(f"\n[ERROR] 匯入失敗: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
