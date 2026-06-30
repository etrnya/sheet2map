# Sheet2Map 專案需求與規劃規格書 (UIMP RPD v1.6)

最後更新時間：2026-06-30
文件狀態：需求規劃書 (RPD) - 已核准 (Accepted)
對照字典檔：[GLOSSARY.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/GLOSSARY.md)

---

## 1. 產品定位與品牌定義 (Product & Brand Identity)

為了確保專案在開發與未來品牌化過程中保持一致，正式定義以下品牌與專案名稱：

*   **產品名稱 (Product Name)**：`Sheet2Map`
*   **架構名稱 (Architecture Name)**：`Universal Interactive Map Platform` (簡稱 `UIMP`)
*   **GitHub 儲存庫 (GitHub Repository)**：[etrnya/sheet2map](https://github.com/etrnya/sheet2map)
*   **產品口號 (Slogan)**：
    > **"Turn Any Spreadsheet, OpenData, or Ranking into a Mobile Interactive Map."**
    > **「任何試算表、OpenData 或排行榜，都能一鍵轉成手機版互動地圖。」**

---

## 2. 產品定位與運作模式 (Product Positioning & Modes)

本平台分為兩種主要應用模式，由同一個核心地圖引擎進行渲染，並依據 `site_mode` 進行動態切換：

### 2.1 對外政策宣導模式 (Public Campaign Map)
*   **定位**：單一主題、單一獨立網站，面向一般社會大眾，用於政府合規宣導或特定社群行銷。
*   **應用場景**：戒菸門診地圖、無菸場所地圖、AED 地圖、500碗美食地圖。
*   **產品特性**：單一目標（Single Purpose）、高資訊透明度（標明資料來源與發布時間）。

### 2.2 個人地圖中心模式 (Personal Map Hub)
*   **定位**：多地圖整合平台，提供管理者自己或親友、內部團隊協作與查詢使用。
*   **應用場景**：個人美食地圖、YouBike 即時站點、公共圖書館、特色公園分佈。
*   **產品特性**：多地圖切換（Map Directory）、個人收藏（LocalStorage）、支援跨地圖搜尋。

---

## 3. 系統技術架構 (Architecture Decision)

為實現極簡維護與快速產生新地圖的目標，系統採用「**One Codebase + Many Google Spreadsheets + One Universal Map Engine**」架構。

```mermaid
graph TD
    A[資料來源: OpenData/CSV/HTML] -->|AI Pipeline / Geocoding| B[Google Spreadsheet]
    B -->|儲存三個分頁: METADATA, POINTS, CACHE| B
    B -->|Apps Script Web App API| C[JSON API 代理]
    C -->|動態路由: /[mapId]| D[Next.js Frontend]
    D -->|地圖渲染與互動| E[Leaflet Engine]
    D -->|靜態匯出 / 雲端部署| F[Vercel]
```

### 3.1 技術選型 (Tech Stack)
*   **資料儲存與維護層**：Google Spreadsheets (每個地圖對應一個獨立試算表)。
*   **API 橋接層**：Google Apps Script (GAS) 部署為 Web App，作為 JSON 資料代理伺服器。
*   **前端展示層**：Next.js + Leaflet / React-Leaflet + Tailwind CSS。
*   **部署環境**：Vercel。

### 3.2 路由設計與運作模式切換 (Dynamic Routing)
*   **動態路由**：`/[mapId]` 用於載入特定地圖。
*   **運作模式控制**：由地圖的獨立配置檔決定前端渲染成 Public 模式或 Hub 模式。

### 3.3 快取與限流保護機制 (Caching Strategy)
*   **Next.js 增量靜態生成 (ISR)**：地圖頁面在伺服器端採用 ISR 機制（如設定 `revalidate: 3600`，每小時重新整理一次），大幅降低對 GAS 的直接請求次數。
*   **前端客戶端快取**：基於 TanStack Query，將地圖點位資料快取在瀏覽器端，避免重複對後端發送 HTTP 請求。

---

## 4. 資料庫結構設計 (Google Sheets Schema)

每張地圖（一個 Spreadsheet）內部必須包含以下三個工作表（Sheets）：

### 4.1 `MAP_METADATA` (地圖元數據表)
儲存該張地圖的屬性與來源聲明，僅有一行資料。

| 欄位名 (Key) | 資料型態 | 說明 |
| :--- | :--- | :--- |
| `map_id` | `string` | 網址路由變數名稱，如 `quit-smoking` |
| `title` | `string` | 地圖名稱，如 `臺南市戒菸門診地圖` |
| `description`| `string` | 地圖的副標題或詳細功能介紹說明 |
| `category` | `string` | e.g. `Government`, `Food`, `Culture`, `Tourism` |
| `source_type`| `string` | 資料來源類型，如 `opendata`, `googlesheet` |
| `source_name`| `string` | 資料來源單位名稱，如 `臺南市政府衛生局` |
| `source_url` | `string` | 原始資料下載或參考連結 |
| `license_type`|`string` | 授權條款，如 `Government OpenData`, `Reference Only` |
| `source_date`| `string` | 資料時間/版次，如 `2026-06` |
| `imported_at`| `string` | 匯入更新時間，如 `2026-06-28` |
| `automation_level`|`string`| 評定為 `full-auto` 或 `human-review` |
| `maintainer` | `string` | 維護者標示，如 `etrnya` |

### 4.2 `POINTS` (地標資料表)
儲存所有要在地圖上渲染的標記點。

| 欄位名 (Key) | 資料型態 | 必填/選填 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 必填 | 唯一識別碼 |
| `name` | `string` | 必填 | 地點名稱，如 `成功大學附設醫院` |
| `lat` | `number` | 必填 | 緯度座標 (WGS84) |
| `lng` | `number` | 必填 | 經度座標 (WGS84) |
| `category` | `string` | 必填 | 地圖內次分類（如：醫院/診所/藥局） |
| `address` | `string` | 選填 | 完整地址 |
| `district` | `string` | 選填 | 鄉鎮市區，如 `東區` |
| `phone` | `string` | 選填 | 聯絡電話 |
| `website` | `string` | 選填 | 官方網站連結 |
| `description`| `string` | 選填 | 地標詳細備註或特色介紹 |
| `image` | `string` | 選填 | 照片 URL，供彈出視窗呈現 |
| `opening_hours`|`string`| 選填 | 開放或營業時間 |
| `tags` | `string` | 選填 | 以半形逗號分隔之標籤組合，如 `公立,教學醫院` |
| `custom_xxx` | `any` | 選填 | 自訂額外欄位，如 `custom_population` |

> [!IMPORTANT]
> **GeoJSON 空間資料支援範圍**：
> *   **MVP (Point Only)**：僅支援點位資料（Point），經緯度記錄於 `lat` 與 `lng`。
> *   **V2 階段 (Shape Support)**：未來將擴充支援多邊形（Polygon，如行政區邊界）、線段（LineString，如步道、自行車道路線）與多重多邊形（MultiPolygon，如公園綠地範疇）。於 V2 時將 POINTS 擴充或拆分出空間座標欄位。

### 4.3 `ADDRESS_CACHE` (地址經緯度快取表)
儲存已轉譯地址經緯度的對照表，以避免重複呼叫付費 API。

| 欄位名 (Key) | 資料型態 | 說明 |
| :--- | :--- | :--- |
| `address` | `string` | 完整地址字串 (鍵值) |
| `lat` | `number` | 緯度 |
| `lng` | `number` | 經度 |
| `updated_at` | `string` | 快取建立時間 |

---

## 5. 地圖總表註冊目錄 (Map Catalog Sheet)

系統維護一個全域的 `Map Catalog` 試算表，記錄整個平台所有啟用的地圖資源：

| 欄位名 (Key) | 資料型態 | 說明 |
| :--- | :--- | :--- |
| `map_id` | `string` | 地圖代碼，對應路由與 `MAP_METADATA` |
| `title` | `string` | 地圖名稱 |
| `group` | `string` | 目錄展示分組，如 `health`, `food`, `culture`, `tourism` |
| `visibility` | `string` | 可見度模式：`public`、`hub`、`private` |
| `spreadsheet_id`|`string`| Google 試算表唯一 ID |
| `status` | `string` | `active` (啟用)、`inactive` (停用) |
| `icon` | `string` | **(新版)** Hub 卡片上顯示之 emoji 或圖示名稱，如 `🍜`、`❤️`、`📚` |
| `theme_color` | `string` | **(新版)** 主題顏色設定，如 `orange`、`red`、`blue` |

---

## 6. 資料匯入管道與 AI 信心分數 (Import Pipeline & AI Mapping)

資料匯入工作流旨在將凌亂的原始資料，經過格式校準與座標轉換後，寫入目標試算表中。

```
Raw Data (Excel/CSV/JSON/HTML/PDF)
      ↓
AI Mapping (LLM 欄位對齊與轉換，生成 Confidence Score)
      ↓
Confidence Check (信心分數查驗：任一關鍵欄位 < 80% 則轉為 Human Review Required)
      ↓
Geocoding (經緯度轉換：優先順序與快取查驗)
      ↓
Import Validation (品質核對、合理座標區間校驗、重複項提示)
      ↓
Write to Spreadsheet (更新 MAP_METADATA & POINTS)
```

### 6.1 AI 欄位對齊與信心分數 (Mapping Confidence)
1.  **AI Mapping**: 利用 LLM 將非標準欄位映射至通用架構，自訂欄位自動包裝為 `custom_xxx`。
2.  **信心分數 (Mapping Confidence)**:
    AI 對齊引擎必須為每個映射的欄位輸出一個信心分數（例如 `name: 99%`、`address: 95%`、`custom_population: 60%`）。
3.  **人工審查閾值 (Human Review Required)**：
    *   若**任一關鍵必要欄位**（如 `name`, `address` / `lat`, `lng`）之對齊信心分數**低於 80%**，該批次資料將被自動標示為 `automation_level: human-review`。
    *   系統會將其寫入待審核草稿區，發出通知由維護人員人工檢查後方可發行。

### 6.2 品質校驗機制 (Import Validation)
在寫入 Google 試算表前，匯入程序必須執行以下品質驗證：
*   **必要欄位檢查**：確保 `name`、`category` 存在，且在經緯度轉換後必備 `lat` 與 `lng`。
*   **座標合理範圍驗證**：若地圖指定在臺南地區，則 `lat` 應在 `22.8 ~ 23.4`，`lng` 應在 `120.0 ~ 120.6` 之間。若超出此範圍需發出警示。
*   **重複數據檢測**：若發現名稱與地址完全一致的點位，需於匯入日誌標示為「重複項」並進行合併或提示使用者。
*   **生成匯入報告**：每次匯入結束後生成報告寫入 `IMPORT_LOG`（如：成功 98 筆，失敗 2 筆，重複 1 筆）。

---

## 7. 地理編碼策略與備援方案 (Geocoding & Failover Strategy)

為確保地理編碼的成功率，並避免因 Google Maps API 額度耗盡或網路問題導致服務中斷，制定了備援機制：

1.  **現成經緯度優先**：若原始資料已包含 `lat`、`lng` 欄位，直接使用，不進行任何 API 查詢。
2.  **地址快取查驗 (Address Cache)**：比對 `ADDRESS_CACHE` 工作表。若命中，直接讀取快取座標。
3.  **主要編碼器 (Primary Geocoder)**：呼叫 **Google Maps Geocoding API** 進行轉換，並將結果回寫至 `ADDRESS_CACHE`。
4.  **備援編碼器 (Fallback Geocoder)**：若 Google API 呼叫失敗、回應 429 (超出限額) 或 403 (憑證失效)，系統會自動切換至 **OpenStreetMap Nominatim API** 作為備援，確保匯入管線不中斷。

---

## 8. 資料智慧與授權治理 (License Governance)

為確保平台合法合規運行，資料來源區分為兩大治理策略：

### 8.1 完全支援與重製 (Full Support)
*   **適用類型**：政府 Open Data (採用政府資料開放授權條款)、CC0、CC-BY 授權資料、自行維護之 Excel/CSV 名單。
*   **處理方式**：可直接於試算表中完整儲存點位名稱、電話、地址與自訂細節，並允許使用者打包下載。

### 8.2 引用與防禦性參考 (Reference Only)
*   **適用類型**：非公開授權之商業排行榜（如 500碗美食、米其林名單）、版權受限之旅遊部落格整理。
*   **處理原則**：
    *   **僅提供指標性資訊**：儲存店名、分類與基本座標，以利地圖定位呈現。
    *   **不大量重製正文內容**：禁止重製詳細評論、專利圖片或食記內文。
    *   **引導官方連結**：詳細欄位與食記正文以官方連結 (Source URL) 的方式提供，引導使用者點擊回到原創網站，保障版權。

---

## 9. 前端 UI/UX 展示標準 (Frontend Requirements)

地圖前端應滿足 Mobile-first 觸控友善與流暢動畫體驗：

### 9.1 公開宣導地圖 (Public Mode)
*   **地圖主體**：全螢幕 Leaflet 地圖，並整合 `leaflet.markercluster` 處理密集點位。
*   **定位與搜尋**：
    *   **GPS 追蹤**：一鍵定位使用者當前座標，並在畫面上顯示個人藍點。
    *   **即時搜尋**：輸入關鍵字，即時過濾地圖上的地標名稱與地址。
    *   **分類篩選**：頂部水平滾動列或側邊抽屜，按 `category` 快速開關顯示。
*   **地標詳情抽屜 (Detail Drawer)**：
    *   點擊 Marker 時，手機版由下方升起 Drawer，桌機版於側邊呈現 Panel。
    *   呈現詳細聯絡資訊、照片、自訂欄位，並提供「**Google 地圖導航**」與「**分享此地點**」連結。
*   **資料透明度頁尾 (Footer)**：
    *   地圖底部必須顯示：資料來源單位、資料發布時間、最後匯入時間與原始來源網址。

### 9.2 個人整合中心 (Hub Mode)
*   **入口目錄**：提供美觀的卡片式地圖清單，依據 `Map Catalog` 中設定的 `icon` 與 `theme_color` 自動生成漂亮卡片。
*   **個人收藏夾**：使用者可標記特定點位為收藏，資料儲存於瀏覽器 LocalStorage 中。
*   **跨地圖切換**：頂部導覽列允許快速切換至其他已啟用之地圖。

---

## 10. 排除範疇 (Out of Scope for MVP)

為避免功能爆炸（Feature Creep），以下功能在 **MVP 階段明確不予實作**：

*   ❌ **使用者帳號系統 (User Account System)**：無須註冊、登入。
*   ❌ **線上地圖編輯功能 (User Editable Maps)**：一般使用者無法直接在網頁端新增或編輯地標點。
*   ❌ **即時協作機制 (Real-time Collaboration)**：不支援多人在網頁上同時編輯。
*   ❌ **AI 智慧推薦引擎 (AI Recommendation Engine)**：不實作基於使用者喜好的 AI 地點推薦。
*   ❌ **即時 GPS 軌跡追蹤 (Real-time GPS Tracking)**：僅提供單次定位，不記錄移動軌跡。
*   ❌ **社群功能 (Social Features)**：不提供按讚、留言、好友分享清單功能。
*   ❌ **原生行動 App (Native Mobile Apps)**：不開發 iOS/Android 原生應用程式（以 Mobile RWD 網頁代替）。

---

## 11. 地圖配置標準規範 (Map Configuration Standard)

為實現「不修改程式碼即可產生不同地圖」之目標，每張地圖均支援一套獨立的 `Map Config` 配置：

```json
{
  "map_id": "quit-smoking",
  "site_mode": "public",
  "theme_color": "green",
  "icon": "🚭",
  "default_zoom": 13,
  "show_directory": false,
  "enable_gps": true,
  "enable_share": true,
  "enable_favorites": false,
  "enable_cross_search": false
}
```

這些參數將儲存在 Next.js 的本地 JSON 配置或動態由 GAS API 讀取，以在載入該 `mapId` 時動態控制地圖的行為與樣式。

---

## 12. 架構決策紀錄索引 (ADR Index)

本專案之重大技術決策均記錄於 `docs/ADR/` 中，以確保開發方向一致：

*   **[ADR-001](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/docs/ADR/001-architecture.md)**: 採用 One Codebase + Many Google Spreadsheets 架構以實現零成本維護與極簡發行。
*   **[ADR-002](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/docs/ADR/002-data-isolation.md)**: 每張地圖獨立使用一個 Google Spreadsheet (包含 METADATA 與 POINTS) 以達實體隔離。
*   **[ADR-003](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/docs/ADR/003-geocoding-resilience.md)**: 採用 Google Geocoding API 作為主編碼器，並以 Address Cache 配合 OSM Nominatim API 作為備援，以降低成本並確保系統韌性。
*   **[ADR-004](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/docs/ADR/004-licensing-defense.md)**: 實施「完全重製 (Full Support)」與「防禦性參考 (Reference Only)」授權分級治理。
*   **[ADR-005](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/docs/ADR/005-site-mode.md)**: 以統一的核心地圖引擎支援 Public 模式（對外單一宣導）與 Hub 模式（個人中心門戶）。

---

## 13. 開發里程碑與 MVP 範疇 (Roadmap)

### 13.1 MVP 階段 (Phase 1) - 核心地圖與 GAS 串接
*   [ ] 建立 `Map Catalog` 目錄試算表。
*   [ ] 撰寫 Google Apps Script (GAS) API 代理 Web App。
*   [ ] 完成 Next.js + Leaflet 前端動態路由地圖引擎（支援 GPS、搜尋、分類、詳情抽屜與 Config 讀取）。
*   [ ] 實作 `ADDRESS_CACHE` 試算表讀寫機制。

### 13.2 智慧匯入階段 (Phase 2) - AI 自動化 Pipeline
*   [ ] 開發匯入 CLI 工具。
*   [ ] 整合 LLM 實作 AI Mapping 與信心分數計算。
*   [ ] 實作主要（Google）與備援（OSM）Geocoding 失敗轉移邏輯。
*   [ ] 實作品質校驗（臺南座標合理區間校驗、重複檢測、錯誤標記）。

### 13.3 平台完善階段 (Phase 3) - Hub 整合
*   [ ] 建立 Personal Map Hub 首頁卡片列表。
*   *   [ ] 實作 LocalStorage 收藏夾與跨地圖點位全局搜尋。
