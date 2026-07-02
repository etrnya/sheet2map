import sys
import os
import json
import urllib.request
from dotenv import load_dotenv

def main():
    load_dotenv()
    gas_url = os.environ.get("GAS_API_URL")
    url = f"{gas_url}?action=list"
    print(f"Fetching from: {url}")
    try:
        req = urllib.request.urlopen(url)
        res = json.loads(req.read().decode('utf-8'))
        maps = res.get("maps", [])
        for m in maps:
            if m.get("map_id") == "quit-smoking":
                sys.stdout.buffer.write(f"Map list data: {m}\n".encode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
