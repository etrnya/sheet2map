import sys
import os
import json
import urllib.request
from dotenv import load_dotenv

def main():
    load_dotenv()
    gas_url = os.environ.get("GAS_API_URL")
    url = f"{gas_url}?action=get&map_id=quit-smoking"
    try:
        req = urllib.request.urlopen(url)
        res = json.loads(req.read().decode('utf-8'))
        points = res.get("points", [])
        
        # 尋找所有自訂欄位中任何一個 value 包含 "安" 的點位
        found = 0
        for p in points:
            custom = p.get("custom_fields", {})
            for k, v in custom.items():
                if "安" in str(v):
                    found += 1
                    msg = f"FOUND VALUE '安'! Point: {p.get('name')} | Key: {k} | Value: {v}\n"
                    sys.stdout.buffer.write(msg.encode('utf-8'))
        print(f"Total points with '安' value in custom fields: {found}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
