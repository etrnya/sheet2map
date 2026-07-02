import os
import sys
import json
import csv
import re
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

def main():
    load_env()
    
    import argparse
    parser = argparse.ArgumentParser(description="Sheet2Map AED Open Data 匯入工具")
    parser.add_argument("-c", "--city", default="", help="篩選特定縣市 (例如：臺南市)。如果不帶此參數則匯入全台灣資料。")
    args = parser.parse_args()
    
    gas_api_url = os.environ.get("GAS_API_URL")
    if not gas_api_url:
        print("[ERROR] 本地 .env 中未配置 GAS_API_URL，無法寫入雲端試算表。")
        sys.exit(1)
        
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "AED20260702.csv")
    if not os.path.exists(csv_path):
        print(f"[ERROR] 找不到 CSV 檔案: {csv_path}")
        sys.exit(1)
        
    print(f"[INFO] 正在解析 AED CSV: {csv_path}...")
    
    # 用 utf-8-sig 讀取 CSV
    points = []
    total_rows = 0
    skipped_coords = 0
    
    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            headers = next(reader)
            
            # 獲取欄位索引
            place_id_idx = headers.index("場所ID") if "場所ID" in headers else 0
            name_idx = headers.index("場所名稱") if "場所名稱" in headers else 1
            city_idx = headers.index("場所縣市") if "場所縣市" in headers else 2
            dist_idx = headers.index("場所區域") if "場所區域" in headers else 3
            addr_idx = headers.index("場所地址") if "場所地址" in headers else 4
            cat_idx = headers.index("場所分類") if "場所分類" in headers else 5
            type_idx = headers.index("場所類型") if "場所類型" in headers else 6
            desc_idx = headers.index("場所描述") if "場所描述" in headers else 7
            aed_place_idx = headers.index("AED放置地點") if "AED放置地點" in headers else 9
            aed_desc_idx = headers.index("AED地點描述") if "AED地點描述" in headers else 10
            lat_idx = headers.index("地點LAT") if "地點LAT" in headers else 11
            lng_idx = headers.index("地點LNG") if "地點LNG" in headers else 12
            phone_idx = headers.index("開放時間緊急連絡電話") if "開放時間緊急連絡電話" in headers else 20
            
            for idx, r in enumerate(reader):
                total_rows += 1
                if len(r) < len(headers):
                    continue
                    
                city = r[city_idx].strip()
                address = r[addr_idx].strip()
                
                # 如果指定了篩選縣市
                if args.city:
                    # 支援「台南」與「臺南」的容錯
                    target_city = args.city.replace("台", "臺")
                    current_city = city.replace("台", "臺")
                    current_address = address.replace("台", "臺")
                    if target_city not in current_city and target_city not in current_address:
                        continue
                        
                name = r[name_idx].strip()
                lat_str = r[lat_idx].strip()
                lng_str = r[lng_idx].strip()
                
                if not name:
                    continue
                    
                # 檢查經緯度是否為空
                lat = 0.0
                lng = 0.0
                try:
                    if lat_str:
                        lat = float(lat_str)
                    if lng_str:
                        lng = float(lng_str)
                except ValueError:
                    pass
                    
                if lat == 0.0 or lng == 0.0:
                    skipped_coords += 1
                    continue
                    
                category = r[cat_idx].strip()
                if not category or category == "其他":
                    category = "公共場所"
                    
                district = r[dist_idx].strip()
                phone = r[phone_idx].strip()
                
                # 組合詳細介紹
                desc_parts = []
                aed_place = r[aed_place_idx].strip()
                aed_desc = r[aed_desc_idx].strip()
                place_desc = r[desc_idx].strip()
                
                if aed_place:
                    desc_parts.append(f"【放置位置】{aed_place}")
                if aed_desc:
                    desc_parts.append(aed_desc)
                if place_desc:
                    desc_parts.append(place_desc)
                    
                description = "\n".join(desc_parts)
                
                # 標籤
                tags = []
                place_type = r[type_idx].strip()
                if place_type and place_type != "其他場所":
                    tags.append(place_type)
                else:
                    tags.append("AED據點")
                    
                point = {
                    "id": f"aed-{r[place_id_idx]}" if r[place_id_idx] else f"aed-{idx+1}",
                    "name": fix_traditional_chinese_typos(name),
                    "lat": lat,
                    "lng": lng,
                    "category": category,
                    "address": fix_traditional_chinese_typos(address),
                    "district": fix_traditional_chinese_typos(district),
                    "phone": phone,
                    "website": "",
                    "description": fix_traditional_chinese_typos(description),
                    "image": "",
                    "opening_hours": "詳見場所說明",
                    "tags": tags
                }
                points.append(point)
    except Exception as e:
        print(f"[ERROR] 讀取 CSV 時出錯: {e}")
        sys.exit(1)
        
    print(f"[INFO] 總處理行數: {total_rows} 筆。")
    print(f"[INFO] 過濾無經緯度點位: {skipped_coords} 筆。")
    print(f"[INFO] 符合篩選條件的標準點位數: {len(points)} 筆。")
    
    if len(points) == 0:
        print("[WARN] 沒有符合條件的點位，匯入取消。")
        sys.exit(0)
        
    # 設定地圖名稱與描述
    city_title = args.city if args.city else "全國"
    metadata = {
        "title": f"{city_title}公共場所 AED 地圖",
        "description": f"提供{city_title}公共場所自動體外心臟電擊去顫器 (AED) 的設置地點與緊急聯絡電話。",
        "category": "醫療急救",
        "source_name": "衛生福利部醫事司",
        "source_url": "https://tw-aed.mohw.gov.tw/",
        "source_date": datetime.date.today().isoformat(),
        "automation_level": "full-auto",
        "maintainer": "etrnya"
    }
    
    import_log = {
        "status": "success",
        "total_count": total_rows,
        "success_count": len(points),
        "failed_count": skipped_coords,
        "duplicate_count": 0,
        "notes": f"Imported {city_title} AED. Source date: {metadata['source_date']}."
    }
    
    payload = {
        "action": "import",
        "map_id": "aed",
        "metadata": metadata,
        "points": points,
        "import_log": import_log
    }
    
    print("[INFO] 正在連線至 Apps Script API 寫入試算表...")
    result = post_to_gas(gas_api_url, payload)
    
    if result and result.get("success"):
        print(f"\n[SUCCESS] 成功將 {len(points)} 筆 {city_title} AED 點位寫入 Google Sheets POINTS 頁面！")
    else:
        error_msg = result.get("error") if result else "無回應或連線超時"
        print(f"\n[ERROR] 匯入失敗: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
