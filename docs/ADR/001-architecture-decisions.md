# Sheet2Map 架構決策紀錄 (Architecture Decision Records)

本目錄記錄 Sheet2Map 專案的關鍵技術架構決策。

---

## ADR-001: 採用 One Codebase + 多試算表架構

*   **狀態 (Status)**：已通過 (Accepted)
*   **日期 (Date)**：2026-06-30
*   **上下文 (Context)**：
    平台需要支援多種類型地圖（如：戒菸門診、美食、避難所），且必須提供非技術人員極簡的維護手段。若為每個地圖單獨建立程式庫或資料庫，將導致維護成本急劇攀升，且無法快速擴展。
*   **決定 (Decision)**：
    採用一個 Next.js 程式庫作為核心地圖引擎（One Codebase），後端資料則由獨立的 Google 試算表（Spreadsheets）提供。全域維護一個 `Map Catalog` 清單，前端透過動態路由 `/[mapId]` 從 Catalog 匹配對應的試算表 ID 並動態請求資料。
*   **影響 (Consequences)**：
    *   **優點**：新增地圖完全免改程式碼，只需在 `Map Catalog` 中新增一行註冊。
    *   **優點**：非技術人員可以直接透過熟悉且權限易控的 Google 試算表維護地標。
    *   **缺點**：高度依賴 Google Apps Script API 的穩定性，需加上 Next.js ISR 快取機制降低請求次數。

---

## ADR-002: 一張地圖使用一個獨立試算表 (Data Isolation)

*   **狀態 (Status)**：已通過 (Accepted)
*   **日期 (Date)**：2026-06-30
*   **上下文 (Context)**：
    不同地圖（如政府 AED 地圖與個人美食地圖）在性質、隱私安全、更新頻率與權責單位上完全不同。如果將所有地圖點位都存放在同一個 Excel 表中，容易導致欄位衝突、檔案膨脹以及敏感資料外洩。
*   **決定 (Decision)**：
    堅持「一個地圖對應一個獨立 Spreadsheet」原則。每張地表（Spreadsheet）內部各自擁有 `MAP_METADATA`、`POINTS` 與 `ADDRESS_CACHE` 分頁，實現資料的實體隔離。
*   **影響 (Consequences)**：
    *   **優點**：每張地圖可各自授予不同維護人員（例如衛生局承辦人僅有戒菸門診表的寫入權限，無權存取美食地圖）。
    *   **優點**：單一檔案損壞或格式出錯不會波及其他地圖。

---

## ADR-003: 主要 Google Maps Geocoding API + Fallback OSM Nominatim

*   **狀態 (Status)**：已通過 (Accepted)
*   **日期 (Date)**：2026-06-30
*   **上下文 (Context)**：
    大量 Open Data 與手動整理的清冊僅包含地址，缺乏 GPS 經緯度。地理編碼為必備功能，但 Google Maps Geocoding API 為付費服務，若大量或重複查詢，會累積龐大帳單。
*   **決定 (Decision)**：
    1. 實作試算表層級的 `ADDRESS_CACHE` 快取，查詢前必先比對快取，防重複查詢。
    2. 主要查詢器採用 **Google Maps Geocoding API** (以求高精度與中文地址解析力)。
    3. 設定自動 Failover 備援，若 Google 額度超出或超時失敗，自動切換至免費的 **OpenStreetMap Nominatim API** 進行編碼。
*   **影響 (Consequences)**：
    *   **優點**：兼顧解析精度（Google）與系統韌性與免付費備援（OSM）。
    *   **優點**：配合 `ADDRESS_CACHE`，API 呼叫次數會隨著資料沉澱快速趨近於零。

---

## ADR-004: 資料智慧與分級授權治理 (Reference Only License)

*   **狀態 (Status)**：已通過 (Accepted)
*   **日期 (Date)**：2026-06-30
*   **上下文 (Context)**：
    地圖資料常來源於有版權保護的商業網站（如 500碗美食、米其林排行榜、旅遊部落格），若未授權即完整重製其評論內文與圖片，會引發版權侵權糾紛。
*   **決定 (Decision)**：
    實施分級授權機制：
    1.  **完全重製 (Full Support)**：政府 OpenData、CC0、CC-BY 等授權資料，於 POINTS 中儲存完整細節。
    2.  **引用參考 (Reference Only)**：商業排行榜資料，在 POINTS 中僅儲存名稱與定位座標，禁止重製評論與圖片；詳情與正文一律透過 Source URL 提供官方連結引導點擊回歸，防禦智慧財產權風險。

---

## ADR-005: 統一地圖引擎支援 Public 與 Hub 雙模式

*   **狀態 (Status)**：已通過 (Accepted)
*   **日期 (Date)**：2026-06-30
*   **上下文 (Context)**：
    產品同時具備對外政策宣導（Single Purpose）與個人整合門戶（Multi-map Hub）的需求。若開發兩套前端，會造成重複造輪子與維護冗餘。
*   **決定 (Decision)**：
    採用統一的前端地圖引擎（Next.js Component），在載入地圖時，由 Map Config 的 `site_mode` 欄位（`public` 或 `hub`）動態控制 UI 元件的顯示或隱藏。
    *   `public`：隱藏地圖目錄首頁、關閉跨圖搜尋，直接展示單一地圖，滿足宣導定位。
    *   `hub`：啟用 Map Catalog 卡片導覽頁、收藏夾與多地圖切換功能，滿足入口中心定位。
