import urllib.request
import json
import os
from dotenv import load_dotenv
import sys

def main():
    load_dotenv()
    gas_url = os.environ.get("GAS_API_URL")
    url = f"{gas_url}?action=get&map_id=quit-smoking"
    print(f"Requesting URL: {url}")
    try:
        req = urllib.request.urlopen(url)
        res = json.loads(req.read().decode('utf-8'))
        metadata = res.get("metadata", {})
        print("=== API Response Metadata ===")
        sys.stdout.buffer.write(f"title: {metadata.get('title')}\n".encode('utf-8'))
        sys.stdout.buffer.write(f"source_name: {metadata.get('source_name')}\n".encode('utf-8'))
        sys.stdout.buffer.write(f"source_url: {metadata.get('source_url')}\n".encode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
