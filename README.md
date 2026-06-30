# Sheet2Map - 萬用雲端互動地圖平台 (Universal Interactive Map Platform)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-v8-blue.svg)](https://developers.google.com/apps-script)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-orange.svg)](https://deepmind.google/technologies/gemini)

[繁體中文](#繁體中文) | [English](#english) | [日本語](#日本語)

---

## 繁體中文

Sheet2Map 是一個基於 JAMstack 設計的**無伺服器 (Serverless) 互動地圖發佈平台**。它將 **Google Sheets（試算表）** 作為資料庫，並提供 **AI 智慧對齊與地理編碼管道**，讓任何人都能在幾分鐘內，將雜亂的文字列表轉換成精美、具備過濾與搜尋功能的動態地圖網站。

### 🌟 核心特色
*   **試算表即資料庫**：完全免伺服器，直接讀寫 Google 試算表，多人協作、即時同步。
*   **雙重 API 網關**：利用 Google Apps Script (GAS) 搭建 Web App API，隔離前端與原始試算表，安全且高效。
*   **AI 智慧導入管道**：整合 Gemini 2.5 進行 Schema 對齊與語意提取，自動解析電話、地址、營業時間等欄位。
*   **台灣門牌地理編碼退回機制**：自動呼叫 OpenStreetMap 定位，並在門牌號碼定位失敗時自動退回至「路/街/巷/弄」搜尋，確保定位成功率達 99%。
*   **極致前端美學**：基於 Next.js 16 與 Tailwind CSS 設計的玻璃擬態 (Glassmorphism) 行動優先地圖介面，整合 Leaflet 與 MarkerCluster 進行地標渲染。

---

## English

Sheet2Map is a **serverless interactive map publishing platform** based on the JAMstack architecture. It leverages **Google Sheets** as a cloud database and features an **AI-powered alignment & geocoding pipeline**. Anyone can turn messy text lists into gorgeous, filterable, and searchable interactive map websites in minutes.

### 🌟 Key Features
*   **Sheets as Database**: Zero database maintenance. Read and write Google Sheets directly with instant synchronization and collaboration.
*   **Secure API Gateway**: Uses Google Apps Script (GAS) to proxy data, hiding raw spreadsheet IDs and optimizing request limits.
*   **AI Data Pipeline**: Powered by Gemini 2.5 to map unstructured text into standardized JSON schemas (addresses, opening hours, phones, custom fields).
*   **Smart Geocoding Fallback**: Automatically locates coordinates via OSM Nominatim and falls back to road-level queries in Taiwan if exact house number searches fail.
*   **Modern Web UI**: A beautiful, mobile-first responsive UI built with Next.js 16, Tailwind CSS, Leaflet, and MarkerCluster.

---

## 日本語

Sheet2Map は、JAMstack 設計に基づいた **サーバーレス (Serverless) 双方向マップ公開プラットフォーム** です。**Google スプレッドシート** をデータベースとして利用し、**AI 自動アライメントおよびジオコーディング（位置情報変換）パイプライン** を提供することで、乱雑なテキストリストを数分でフィルター・検索機能付きの美しい地図ウェブサイトに変換します。

### 🌟 主な機能
*   **スプレッドシートをデータベースに**: データベースの構築・維持は不要。Google スプレッドシートから直接データを読み書きし、共同編集や即時同期が可能です。
*   **安全な API ゲートウェイ**: Google Apps Script (GAS) を用いた Web App API を構築し、スプレッドシートの生の ID を隠しつつ安全にアクセスします。
*   **AI データパイプライン**: Gemini 2.5 を活用し、非構造化テキストを標準化された JSON スキーマ（住所、電話番号、営業時間、カスタムフィールドなど）に自動整列します。
*   **スマートジオコーディングフォールバック**: OSM Nominatim を使用して緯度経度を自動取得。台湾の住所において正確な番地がデータベースにない場合、道路名レベルの検索に自動フォールバックします。
*   **美しいフロントエンド**: Next.js 16、Tailwind CSS、Leaflet、および MarkerCluster を採用した、グラスモフィズム（Glassmorphism）のモバイルファーストなデザイン。

---

## 🛠️ 開發與設定指引 (Development Setup)

### 1. 後端與資料庫設定 (Backend & Database)
1.  建立一個新的 Google 試算表作為 Catalog 總表。
2.  點擊「擴充功能」->「Apps Script」，將 [gas/Code.js](gas/Code.js) 的代碼貼入。
3.  在程式碼最上方，將 `GLOBAL_CATALOG_SPREADSHEET_ID` 修改為您的試算表 ID。
4.  點擊右上角「部署」->「新增部署」：
    *   類型：`Web 應用程式`
    *   執行身分：`我`
    *   誰有權限存取：`所有人`
5.  將部署後取得的 Web App URL 設定至本機 `.env` 檔案的 `GAS_API_URL` 中。
6.  在 Apps Script 專案中或瀏覽器呼叫 `URL?action=setup` 完成初始化。

### 2. 前端設定 (Frontend Next.js)
```bash
# 安裝依賴
npm install

# 複製環境變數設定
cp .env.example .env

# 啟動開發伺服器
npm run dev

# 靜態編譯與打包
npm run build
```

### 3. AI 匯入工具 (AI Importer Pipeline)
```bash
# 準備您的 GCP 服務帳戶憑證 (Vertex AI)，並命名為 gcp-key.json 放置於專案根目錄 (已被 git 忽略)
# 或是直接設定環境變數 GEMINI_API_KEY

# 執行 AI 結構化匯入 (以戒菸診所為例)
python scripts/ai_import.py --file scripts/sample_raw_clinics.txt --map-id quit-smoking
```

---

## 🔒 資安與防護說明 (Security & Protection)

*   **API 金鑰安全**：`.env` 與 `gcp-key.json` 已預設加入 `.gitignore` 檔案中，絕不提交至公開儲存庫。
*   **試算表 ID 保護**：Apps Script Web App 作為代理層，前端 Next.js 僅與 Apps Script 進行加密 API 連線，外部使用者無法直接得知您的 Google Sheets ID，有效防止惡意寫入與資料外洩。
*   **CORS 與來源驗證**：建議在 Apps Script 中添加來源 Origin 校驗，以限制 API 僅能被您部署的前端網域名稱呼叫。

---

## 📄 開源授權 (License)

本專案採用 **[MIT License](LICENSE)** 授權開源。
