# Sheet2Map 專案術語字典 (GLOSSARY.md)

本文件定義 Sheet2Map 專案（架構名稱為萬用互動地圖平台, UIMP）之核心術語與變數命名標準。所有後續系統設計、資料庫 Schema、Apps Script 及 Next.js 程式碼必須嚴格對齊本字典定義。

---

## 1. 核心系統術語 (Core System Terms)

| 中文名稱 | 英文名稱 | 代碼變數名 / 欄位名 | 定義與說明 |
| :--- | :--- | :--- | :--- |
| **萬用互動地圖平台** | Universal Interactive Map Platform | `UIMP` | 專案技術架構名稱。核心願景為「任何 Excel、Open Data 或 Google Sheet，都能一鍵轉成手機版互動地圖」。 |
| **地圖渲染引擎** | Universal Map Engine | `map_engine` | 用於在前端渲染地圖、地標與處理交互（如 Leaflet/React-Leaflet）的通用組件。 |
| **網站模式** | Site Mode | `site_mode` | 決定平台運行模式。可為 `public`（單一主題宣導地圖）或 `hub`（個人地圖入口中心）。 |
| **對外宣導模式** | Public Mode | `public_mode` | 用於單一政策宣導地圖。此模式下 `site_mode` 設為 `public` 且隱藏目錄。 |
| **個人地圖中心模式** | Hub Mode | `hub_mode` | 用於整合多種地圖資料的入口網。此模式下 `site_mode` 設為 `hub` 且顯示目錄。 |
| **地圖目錄** | Map Catalog | `map_catalog` | 記錄平台上所有地圖註冊狀態與對應試算表 ID 的總表，由特定的 Google Sheet 維護。 |
| **地標 (標記點)** | Map Point | `point` | 地圖上的單一座標點，包含經緯度、名稱、分類及聯絡資訊。 |
| **通用地標架構** | Universal Schema | `universal_schema` | 所有地標匯入與儲存時必須遵循的標準資料欄位結構。 |
| **自訂欄位** | Custom Field | `custom_xxx` | 用於擴充通用架構以外的特定欄位，前綴必須為 `custom_`。 |
| **地理編碼** | Geocoding | `geocoding` | 將中文/英文地址文字轉換為經緯度（Latitude/Longitude）座標的過程。 |
| **地址快取** | Address Cache | `address_cache` | 儲存已轉譯地址經緯度的對照表，儲存於 Sheet 中以避免重複調用 Google Geocoding API。 |
| **AI 欄位對齊** | AI Mapping | `ai_mapping` | 利用大語言模型 (LLM) 自動識別原始資料的欄位，對齊至通用地標架構的過程。 |
| **對齊信心分數** | Mapping Confidence | `mapping_confidence` | AI 對齊引擎為每個映射欄位輸出之百分比評分，若關鍵必要欄位信心低於 80% 則強制轉為人工審核。 |
| **地圖配置標準** | Map Config Standard | `map_config` | 針對每張地圖定義的獨立設定 JSON 檔案，以動態調整地圖的主題色、預設縮放值與元件開關。 |

---

## 2. 地圖元數據欄位 (Map Metadata Fields)
儲存於各試算表中的 `MAP_METADATA` 工作表，用於定義單一地圖的屬性。

| 中文名稱 | 英文名稱 | 代碼變數名 | 資料型態 | 範例與說明 |
| :--- | :--- | :--- | :--- | :--- |
| **地圖識別碼** | Map ID | `map_id` | `string` | e.g. `quit-smoking` (網址動態路由變數) |
| **地圖標題** | Title | `title` | `string` | e.g. `臺南市戒菸門診地圖` |
| **地圖描述** | Description | `description` | `string` | 地圖的副標題或詳細功能介紹說明。 |
| **地圖類別** | Category | `category` | `string` | e.g. `Government`, `Food`, `Culture`, `Tourism` |
| **資料來源類型** | Source Type | `source_type` | `string` | e.g. `opendata`, `googlesheet`, `news`, `html` |
| **資料來源名稱** | Source Name | `source_name` | `string` | 提供原始資料的單位名稱。e.g. `臺南市政府衛生局` |
| **資料來源網址** | Source URL | `source_url` | `string` | 原始資料的下載或參考網頁連結。 |
| **授權條款類型** | License Type | `license_type` | `string` | e.g. `Government OpenData`, `CC-BY`, `CC0`, `Reference Only` |
| **資料時間** | Source Date | `source_date` | `string` | 原始資料發布的年月或版次。e.g. `2026-06` |
| **最後匯入時間** | Imported At | `imported_at` | `string` (ISO) | 系統執行更新匯入的具體時間。e.g. `2026-06-28` |
| **自動化等級** | Automation Level | `automation_level`| `string` | e.g. `full-auto` (自動更新), `human-review` (需人工審查) |
| **地圖維護者** | Maintainer | `maintainer` | `string` | 負責該地圖資料更新的開發者代號。e.g. `etrnya` |

---

## 3. 地標欄位定義 (POINTS Schema)
儲存於各試算表中的 `POINTS` 工作表，定義單個地標的資料結構。

| 中文名稱 | 英文名稱 | 代碼變數名 | 屬性限制 | 資料型態 & 說明 |
| :--- | :--- | :--- | :--- | :--- |
| **地標唯一識別碼** | Point ID | `id` | 必填 | `string` (通常為英數字或流水號) |
| **地標名稱** | Point Name | `name` | 必填 | `string` e.g. `成功大學附設醫院` |
| **緯度** | Latitude | `lat` | 必填 | `number` (雙精度浮點數，如 22.9975) |
| **經度** | Longitude | `lng` | 必填 | `number` (雙精度浮點數，如 120.2197) |
| **主要分類** | Category | `category` | 必填 | `string` (該地圖內部的次分類，如門診/醫院/衛生所) |
| **地址** | Address | `address` | 選填 | `string` e.g. `臺南市東區大學路1號` |
| **行政區** | District | `district` | 選填 | `string` e.g. `東區` |
| **聯絡電話** | Phone | `phone` | 選填 | `string` e.g. `06-2353535` |
| **官方網站** | Website | `website` | 選填 | `string` (完整網址連結) |
| **地標描述** | Description | `description` | 選填 | `string` (地標的詳細備註或介紹文字) |
| **地標照片連結** | Image | `image` | 選填 | `string` (圖片 URL，用於地圖彈出視窗預覽) |
| **營業/開放時間** | Opening Hours | `opening_hours` | 選填 | `string` e.g. `週一至週五 08:00-17:00` |
| **標籤組** | Tags | `tags` | 選填 | `string` (以半形逗號分隔的標籤，e.g. `公立,教學醫院`) |

---

## 4. 地圖總表目錄欄位 (Map Catalog Sheet)
儲存於全域 `Map Catalog` 試算表中，用於管理整體系統可用的地圖列表。

| 中文名稱 | 英文名稱 | 代碼變數名 | 說明 |
| :--- | :--- | :--- | :--- |
| **地圖識別碼** | Map ID | `map_id` | 唯一代碼，需與 `MAP_METADATA` 中的 `map_id` 完全一致。 |
| **地圖標題** | Title | `title` | 地圖名稱。 |
| **地圖分組** | Group | `group` | 目錄中的展示分組。e.g. `health`, `food`, `culture`, `tourism` |
| **可見度模式** | Visibility | `visibility` | 設為 `public`（公開）、`hub`（個人中心可見）、`private`（僅管理者）。 |
| **試算表 ID** | Spreadsheet ID | `spreadsheet_id` | 對應 Google Sheet 的唯一識別字串（URL 中 `d/` 後方部分）。 |
| **啟用狀態** | Status | `status` | 設為 `active` 或 `inactive`，用以臨時關閉或開啟該地圖。 |
| **地圖圖示** | Map Icon | `icon` | 於 Hub 卡片上顯示之 emoji 或圖示名稱，如 `🍜`。 |
| **主題色** | Theme Color | `theme_color` | 地圖網頁與 Marker 之配色識別色碼或顏色名稱，如 `orange`。 |
