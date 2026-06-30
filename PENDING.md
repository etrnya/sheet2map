# Sheet2Map (UIMP) 專案待辦清單 (PENDING.md)

本文件追蹤 Sheet2Map 專案（架構名稱為萬用互動地圖平台, UIMP）的開發進度。任務狀態會定期彙整回寫至全域待辦清單。

---

## 📌 活躍待辦清單

### 1. 立即執行 (Immediate)
- [x] **[準備工作]** 初始化 `sheet2map` 子專案的獨立 Git 倉庫 (避免巢狀 Git 衝突)
- [x] **[準備工作]** 在根目錄的 `.gitignore` 中註冊排除 `sheet2map` 資料夾 (已由根目錄 `/*/` 規則自動忽略)
- [x] **[架構文件]** 完成 TDD v1.0 技術設計文件 (Technical Design Document)
- [x] **[環境建立]** 初始化 Next.js 專案 (React 18 + TS 5) 於 `sheet2map` 目錄
- [x] **[GAS 串接]** 撰寫並測試 Google Apps Script (GAS) Web App 代理程式，可讀取 `MAP_METADATA` 與 `POINTS` 並以 JSON 輸出

### 2. 本週目標 (This Week)
- [x] **[前端地圖]** 於 Next.js 整合 Leaflet 引擎，完成 `/[mapId]` 動態路由渲染，並支援 `Map Config` 載入
- [x] **[前端 UI]** 實作 GPS 使用者定位、關鍵字搜尋與 `category` 次分類過濾功能
- [x] **[前端 UI]** 實作地標詳情抽屜 (Detail Drawer / Sheet)，並整合 Google 導航與分享功能
- [x] **[地理編碼]** 設計 `ADDRESS_CACHE` 工作表讀寫機制與 OSM Nominatim 備援機制

### 3. 未來規劃 (Later)
- [ ] **[AI 匯入管道]** 開發自動化匯入 CLI 工具，串接大語言模型進行 AI Mapping (欄位映射與 `custom_xxx` 轉換，支持信心分數閾值)
- [ ] **[品質校驗]** 實作匯入品質校驗機制 (合理座標區間、重複偵測、匯入日誌寫入)
- [x] **[入口中心]** 建立 Personal Map Hub 卡片式首頁，依照 icon 與 theme_color 自動渲染卡片
- [ ] **[功能擴充]** 實作瀏覽器 LocalStorage 點位收藏與跨地圖搜尋功能
- [ ] **[空間資料支援]** V2 階段擴充支援 GeoJSON 多邊形 (Polygon) 與線段 (LineString)

---

## 📈 歷史提交紀錄 (Archived)
- [x] **[需求定義]** 釐清並完成 [UIMP_RPD_v1.6.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/UIMP_RPD_v1.6.md) 需求規劃規格書，新增排除範疇、Map Config 與 ADR 索引。
- [x] **[術語定義]** 完成專案 [GLOSSARY.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/sheet2map/GLOSSARY.md) 術語字典。
