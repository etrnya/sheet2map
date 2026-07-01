/**
 * Sheet2Map (UIMP) - Google Apps Script Web App API Gateway
 * 
 * 部署說明：
 * 1. 在 Google Drive 中建立一個全域 Catalog 試算表，命名為 "Sheet2Map Catalog"。
 * 2. 建立工作表 "MAP_LIST"，並設定以下欄位（首行）：
 *    map_id | title | group | visibility | spreadsheet_id | status | icon | theme_color | default_zoom | enable_gps | enable_share | enable_favorites | enable_cross_search
 * 3. 點擊「擴充功能」->「Apps Script」，將本檔案內容貼入 `Code.js` 中。
 * 4. 修改下方 `GLOBAL_CATALOG_SPREADSHEET_ID` 為您 Catalog 試算表的實際 ID。
 * 5. 點擊右上方「部署」->「新增部署」，選取「Web 應用程式」。
 *    - 執行身分：我 (Me)
 *    - 誰有權限存取：所有人 (Anyone)
 * 6. 部署後取得 Web App URL，將其設定至前端 Next.js 中。
 */

// ⚠️ 已綁定您建立的 Sheet2Map Catalog 試算表 ID
const GLOBAL_CATALOG_SPREADSHEET_ID = "1bK8pgDTkSr50_8w6Vko_zVmiRU71k0QjtCgUy6mVIrk";

/**
 * 處理 HTTP POST 請求的進入點 (用於 AI 匯入管道寫入資料)
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const mapId = postData.map_id;
    const points = postData.points; // 標準點位陣列
    const metadata = postData.metadata; // 地圖詮釋資料
    
    if (action === "import") {
      if (!mapId) {
        return createJsonResponse({ success: false, error: "未指定地圖識別碼 (map_id)。" }, 400);
      }
      
      // 1. 讀取 Catalog 總表，確認地圖是否啟用與獲取 Spreadsheet ID
      const catalogSpreadsheet = SpreadsheetApp.openById(GLOBAL_CATALOG_SPREADSHEET_ID);
      const catalogSheet = catalogSpreadsheet.getSheetByName("MAP_LIST");
      if (!catalogSheet) {
        return createJsonResponse({ success: false, error: "在 Catalog 中找不到 MAP_LIST 工作表。" }, 500);
      }
      
      const catalogRows = getSheetRows(catalogSheet);
      const mapConfig = catalogRows.find(row => row.map_id === mapId && String(row.status).toLowerCase() === "active");
      
      if (!mapConfig) {
        return createJsonResponse({ success: false, error: `地圖 '${mapId}' 未註冊或已被停用。` }, 404);
      }
      
      const targetSpreadsheetId = mapConfig.spreadsheet_id;
      if (!targetSpreadsheetId) {
        return createJsonResponse({ success: false, error: `地圖 '${mapId}' 的試算表 ID 為空。` }, 500);
      }
      
      const targetSpreadsheet = SpreadsheetApp.openById(targetSpreadsheetId);
      
      // 2. 寫入或更新 MAP_METADATA
      if (metadata) {
        let metadataSheet = targetSpreadsheet.getSheetByName("MAP_METADATA");
        if (!metadataSheet) {
          metadataSheet = targetSpreadsheet.insertSheet("MAP_METADATA");
        }
        metadataSheet.clear();
        const metaHeaders = ["title", "description", "category", "source_name", "source_url", "source_date", "imported_at"];
        metadataSheet.getRange(1, 1, 1, metaHeaders.length).setValues([metaHeaders]);
        const metaRow = [
          metadata.title || mapConfig.title || "",
          metadata.description || "",
          metadata.category || "",
          metadata.source_name || "",
          metadata.source_url || "",
          metadata.source_date || "",
          new Date().toISOString()
        ];
        metadataSheet.getRange(2, 1, 1, metaRow.length).setValues([metaRow]);
      }
      
      // 3. 寫入 POINTS 工作表
      if (points && points.length > 0) {
        let pointsSheet = targetSpreadsheet.getSheetByName("POINTS");
        if (!pointsSheet) {
          pointsSheet = targetSpreadsheet.insertSheet("POINTS");
        }
        pointsSheet.clear();
        
        // 收集所有自訂 custom_ 欄位屬性名稱
        const customKeysSet = new Set();
        points.forEach(p => {
          if (p.custom_fields) {
            Object.keys(p.custom_fields).forEach(k => customKeysSet.add(k));
          }
        });
        const customKeys = Array.from(customKeysSet);
        
        const standardHeaders = [
          "id", "name", "lat", "lng", "category", "address", 
          "district", "phone", "website", "description", 
          "image", "opening_hours", "tags"
        ];
        const allHeaders = standardHeaders.concat(customKeys);
        pointsSheet.getRange(1, 1, 1, allHeaders.length).setValues([allHeaders]);
        
        // 填入點位值
        const rowsToValues = points.map((p, idx) => {
          const row = [];
          row.push(p.id || `pt-${idx + 1}`);
          row.push(p.name || "");
          row.push(p.lat || "");
          row.push(p.lng || "");
          row.push(p.category || "");
          row.push(p.address || "");
          row.push(p.district || "");
          row.push(p.phone || "");
          row.push(p.website || "");
          row.push(p.description || "");
          row.push(p.image || "");
          row.push(p.opening_hours || "");
          row.push(p.tags ? p.tags.join(",") : "");
          
          customKeys.forEach(k => {
            row.push(p.custom_fields && p.custom_fields[k] !== undefined ? p.custom_fields[k] : "");
          });
          return row;
        });
        
        pointsSheet.getRange(2, 1, rowsToValues.length, allHeaders.length).setValues(rowsToValues);
      }
      
      return createJsonResponse({
        success: true,
        message: `成功匯入地圖 '${mapId}' 的 ${points ? points.length : 0} 筆點位與詮釋資料！`
      }, 200);
    }
    
    return createJsonResponse({ success: false, error: "未知的 Action 動作類型。" }, 400);
  } catch (err) {
    return createJsonResponse({ success: false, error: `處理 POST 匯入失敗: ${err.message}` }, 500);
  }
}

/**
 * 處理 HTTP GET 請求的進入點
 */
function doGet(e) {
  try {
    const mapId = e.parameter.map_id;
    const action = e.parameter.action;

    if (!GLOBAL_CATALOG_SPREADSHEET_ID || GLOBAL_CATALOG_SPREADSHEET_ID === "YOUR_GLOBAL_CATALOG_SPREADSHEET_ID") {
      return createJsonResponse({
        success: false,
        error: "尚未配置全域 Catalog 試算表 ID。請在 Apps Script 中填入 GLOBAL_CATALOG_SPREADSHEET_ID。"
      }, 500);
    }

    // ==========================================
    // 功能 C：初始化 Catalog 試算表欄位與範例 (action=setup)
    // ==========================================
    if (action === "setup") {
      const catalogSpreadsheet = SpreadsheetApp.openById(GLOBAL_CATALOG_SPREADSHEET_ID);
      
      // 1. 初始化 MAP_LIST (地圖清冊)
      let catalogSheet = catalogSpreadsheet.getSheetByName("MAP_LIST");
      if (!catalogSheet) {
        catalogSheet = catalogSpreadsheet.insertSheet("MAP_LIST");
      }
      catalogSheet.clear();
      const listHeaders = [
        "map_id", "title", "group", "visibility", "spreadsheet_id", "status", 
        "icon", "theme_color", "default_zoom", "enable_gps", "enable_share", 
        "enable_favorites", "enable_cross_search"
      ];
      catalogSheet.getRange(1, 1, 1, listHeaders.length).setValues([listHeaders]);
      const sample1 = [
        "quit-smoking", "臺南市戒菸門診地圖", "health", "public", GLOBAL_CATALOG_SPREADSHEET_ID, "active",
        "🚭", "green", "13", "TRUE", "TRUE", "FALSE", "FALSE"
      ];
      const sample2 = [
        "aed", "AED地圖", "public", "hub", GLOBAL_CATALOG_SPREADSHEET_ID, "active",
        "❤️", "red", "14", "TRUE", "TRUE", "TRUE", "FALSE"
      ];
      catalogSheet.getRange(2, 1, 1, sample1.length).setValues([sample1]);
      catalogSheet.getRange(3, 1, 1, sample2.length).setValues([sample2]);
      
      // 2. 初始化 MAP_METADATA (地圖詮釋資料)
      let metadataSheet = catalogSpreadsheet.getSheetByName("MAP_METADATA");
      if (!metadataSheet) {
        metadataSheet = catalogSpreadsheet.insertSheet("MAP_METADATA");
      }
      metadataSheet.clear();
      const metadataHeaders = [
        "title", "description", "category", "source_name", "source_url", "source_date", "imported_at"
      ];
      metadataSheet.getRange(1, 1, 1, metadataHeaders.length).setValues([metadataHeaders]);
      const metadataRow = [
        "臺南市健康與安全整合地圖",
        "提供臺南市內優質戒菸診所與 AED 急救設備點位查詢。",
        "健康醫療",
        "政府開放資料網",
        "https://data.gov.tw",
        "2026-06",
        "2026-06-30"
      ];
      metadataSheet.getRange(2, 1, 1, metadataRow.length).setValues([metadataRow]);

      // 3. 初始化 POINTS (地標點位資料)
      let pointsSheet = catalogSpreadsheet.getSheetByName("POINTS");
      if (!pointsSheet) {
        pointsSheet = catalogSpreadsheet.insertSheet("POINTS");
      }
      pointsSheet.clear();
      const pointsHeaders = [
        "id", "name", "lat", "lng", "category", "address", 
        "district", "phone", "website", "description", 
        "image", "opening_hours", "tags"
      ];
      pointsSheet.getRange(1, 1, 1, pointsHeaders.length).setValues([pointsHeaders]);
      const point1 = [
        "clinic-1", "臺南市民健康戒菸診所", "22.997", "120.201", "戒菸門診", "臺南市中西區健康路一段100號", "中西區", "06-2151234", "https://health.tainan.gov.tw", "專業醫師諮詢與免費戒菸貼片提供。", "", "週一至週五 09:00-17:00", "免費諮詢,門診"
      ];
      const point2 = [
        "aed-1", "臺南火車站大廳 AED", "22.999", "120.212", "AED 設備", "臺南市東區北門路二段4號", "東區", "", "", "火車站旅客大廳柱子旁，緊急求救電話下。", "", "24小時開放", "火車站,急救"
      ];
      pointsSheet.getRange(2, 1, 1, point1.length).setValues([point1]);
      pointsSheet.getRange(3, 1, 1, point2.length).setValues([point2]);

      return createJsonResponse({
        success: true,
        message: "Sheet2Map Catalog 試算表欄位初始化成功！已填入 MAP_LIST、MAP_METADATA 與 POINTS 範例資料。"
      }, 200);
    }

    // ==========================================
    // 功能 D：跨地圖點位全域搜尋 (action=search)
    // ==========================================
    if (action === "search") {
      const q = e.parameter.q;
      if (!q) {
        return createJsonResponse({ success: false, error: "缺少搜尋關鍵字 (q)。" }, 400);
      }
      
      const catalogSpreadsheet = SpreadsheetApp.openById(GLOBAL_CATALOG_SPREADSHEET_ID);
      const catalogSheet = catalogSpreadsheet.getSheetByName("MAP_LIST");
      if (!catalogSheet) {
        return createJsonResponse({ success: false, error: "在 Catalog 試算表中找不到 'MAP_LIST' 工作表。" }, 500);
      }
      
      const catalogRows = getSheetRows(catalogSheet);
      const activeMaps = catalogRows.filter(row => String(row.status).toLowerCase() === "active");
      
      const results = [];
      const searchLower = q.toLowerCase().trim();
      
      activeMaps.forEach(mapConfig => {
        const targetSpreadsheetId = mapConfig.spreadsheet_id;
        if (!targetSpreadsheetId) return;
        
        try {
          const targetSpreadsheet = SpreadsheetApp.openById(targetSpreadsheetId);
          const pointsSheet = targetSpreadsheet.getSheetByName("POINTS");
          if (!pointsSheet) return;
          
          const pointsRaw = getSheetRows(pointsSheet);
          pointsRaw.forEach(p => {
            const name = String(p.name || "");
            const address = String(p.address || "");
            const tags = String(p.tags || "");
            
            if (name.toLowerCase().includes(searchLower) || 
                address.toLowerCase().includes(searchLower) || 
                tags.toLowerCase().includes(searchLower)) {
              results.push({
                map_id: mapConfig.map_id,
                map_title: mapConfig.title,
                point: {
                  id: p.id ? String(p.id) : "",
                  name: name,
                  lat: p.lat ? parseFloat(p.lat) : 0,
                  lng: p.lng ? parseFloat(p.lng) : 0,
                  category: p.category ? String(p.category) : "未分類",
                  address: address,
                  district: p.district ? String(p.district) : "",
                  phone: p.phone ? String(p.phone) : "",
                  website: p.website ? String(p.website) : "",
                  description: p.description ? String(p.description) : "",
                  tags: tags ? tags.split(",").map(t => t.trim()) : []
                }
              });
            }
          });
        } catch (err) {
          Logger.log("搜尋地圖 '" + mapConfig.map_id + "' 發生錯誤: " + err.message);
        }
      });
      
      return createJsonResponse({
        success: true,
        query: q,
        results: results
      }, 200);
    }

    // 1. 開啟全域 Catalog 試算表並讀取 MAP_LIST
    const catalogSpreadsheet = SpreadsheetApp.openById(GLOBAL_CATALOG_SPREADSHEET_ID);
    const catalogSheet = catalogSpreadsheet.getSheetByName("MAP_LIST");
    if (!catalogSheet) {
      return createJsonResponse({
        success: false,
        error: "在 Catalog 試算表中找不到名稱為 'MAP_LIST' 的工作表。"
      }, 500);
    }

    const catalogRows = getSheetRows(catalogSheet);

    // ==========================================
    // 功能 A：回傳註冊的地圖列表 (用於 Hub 首頁目錄)
    // ==========================================
    if (action === "list" || (!mapId && action !== "get")) {
      const mapsList = catalogRows
        .filter(row => String(row.status).toLowerCase() === "active" && ["public", "hub"].includes(String(row.visibility).toLowerCase()))
        .map(row => ({
          map_id: String(row.map_id),
          title: String(row.title),
          group: String(row.group),
          visibility: String(row.visibility),
          icon: row.icon ? String(row.icon) : "📍",
          theme_color: row.theme_color ? String(row.theme_color) : "blue",
          default_zoom: parseInt(row.default_zoom) || 13
        }));

      return createJsonResponse({
        success: true,
        maps: mapsList
      }, 200);
    }

    // ==========================================
    // 功能 B：回傳特定地圖的點位資料與 Config
    // ==========================================
    
    // 2. 尋找與 mapId 匹配且 status 為 active 的地圖配置
    const mapConfig = catalogRows.find(row => row.map_id === mapId && String(row.status).toLowerCase() === "active");
    if (!mapConfig) {
      return createJsonResponse({
        success: false,
        error: `地圖 '${mapId}' 未註冊或已被停用。`
      }, 404);
    }

    const targetSpreadsheetId = mapConfig.spreadsheet_id;
    if (!targetSpreadsheetId) {
      return createJsonResponse({
        success: false,
        error: `地圖 '${mapId}' 的試算表 ID (spreadsheet_id) 設定為空。`
      }, 500);
    }

    // 3. 開啟目標地標試算表
    let targetSpreadsheet;
    try {
      targetSpreadsheet = SpreadsheetApp.openById(targetSpreadsheetId);
    } catch (err) {
      return createJsonResponse({
        success: false,
        error: `無法讀取目標試算表。請確認 Apps Script 擁有該試算表 (ID: ${targetSpreadsheetId}) 的存取權限。錯誤: ${err.message}`
      }, 500);
    }

    // 4. 讀取 MAP_METADATA 與 POINTS 工作表
    const metadataSheet = targetSpreadsheet.getSheetByName("MAP_METADATA");
    const pointsSheet = targetSpreadsheet.getSheetByName("POINTS");

    if (!metadataSheet || !pointsSheet) {
      return createJsonResponse({
        success: false,
        error: "目標試算表格式不正確。必須包含 'MAP_METADATA' 與 'POINTS' 兩個工作表。"
      }, 500);
    }

    const metadataRows = getSheetRows(metadataSheet);
    const pointsRaw = getSheetRows(pointsSheet);

    const metadata = metadataRows[0] || {};

    // 5. 解析並標準化地標點位 (POINTS)
    const standardKeys = [
      "id", "name", "lat", "lng", "category", "address", 
      "district", "phone", "website", "description", 
      "image", "opening_hours", "tags"
    ];

    const points = pointsRaw.map(p => {
      const custom_fields = {};
      
      // 自動擷取以 custom_ 開頭的自訂欄位
      Object.keys(p).forEach(key => {
        if (!standardKeys.includes(key) && key.startsWith("custom_")) {
          custom_fields[key] = p[key];
        }
      });

      // 解析 tags 陣列 (支援半形逗號分隔)
      let tagsArray = [];
      if (p.tags) {
        tagsArray = String(p.tags)
          .split(",")
          .map(t => t.trim())
          .filter(t => t.length > 0);
      }

      return {
        id: p.id ? String(p.id) : "",
        name: p.name ? String(p.name) : "",
        lat: p.lat ? parseFloat(p.lat) : 0,
        lng: p.lng ? parseFloat(p.lng) : 0,
        category: p.category ? String(p.category) : "未分類",
        address: p.address ? String(p.address) : "",
        district: p.district ? String(p.district) : "",
        phone: p.phone ? String(p.phone) : "",
        website: p.website ? String(p.website) : "",
        description: p.description ? String(p.description) : "",
        image: p.image ? String(p.image) : "",
        opening_hours: p.opening_hours ? String(p.opening_hours) : "",
        tags: tagsArray,
        custom_fields: Object.keys(custom_fields).length > 0 ? custom_fields : undefined
      };
    }).filter(p => p.name && p.lat && p.lng); // 過濾掉經緯度或名稱為空的不合格點位

    // 6. 包裝 API 回傳結果
    const responsePayload = {
      success: true,
      config: {
        map_id: mapConfig.map_id,
        site_mode: mapConfig.visibility === "public" ? "public" : "hub",
        theme_color: mapConfig.theme_color || "blue",
        icon: mapConfig.icon || "📍",
        default_zoom: parseInt(mapConfig.default_zoom) || 13,
        show_directory: mapConfig.visibility !== "public",
        enable_gps: mapConfig.enable_gps !== "FALSE" && mapConfig.enable_gps !== false,
        enable_share: mapConfig.enable_share !== "FALSE" && mapConfig.enable_share !== false,
        enable_favorites: mapConfig.enable_favorites === "TRUE" || mapConfig.enable_favorites === true,
        enable_cross_search: mapConfig.enable_cross_search === "TRUE" || mapConfig.enable_cross_search === true
      },
      metadata: {
        title: metadata.title || mapConfig.title || "未命名地圖",
        description: metadata.description || "",
        category: metadata.category || "",
        source_name: metadata.source_name || "",
        source_url: metadata.source_url || "",
        source_date: metadata.source_date || "",
        imported_at: metadata.imported_at || ""
      },
      points: points
    };

    return createJsonResponse(responsePayload, 200);

  } catch (err) {
    return createJsonResponse({
      success: false,
      error: `伺服器內部發生未預期錯誤: ${err.message}`
    }, 500);
  }
}

/**
 * 讀取工作表的資料並將其轉換為物件陣列（以首行為屬性鍵）
 */
function getSheetRows(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0].map(h => String(h).trim());
  const rows = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = values[i][j];
      row[headers[j]] = val;
      if (val !== "") {
        hasData = true;
      }
    }
    if (hasData) {
      rows.push(row);
    }
  }
  return rows;
}

/**
 * 生成標準的 HTTP JSON 回應，並啟用 CORS 跨網域存取
 */
function createJsonResponse(data, statusCode) {
  const JSONString = JSON.stringify(data);
  const output = ContentService.createTextOutput(JSONString);
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * 試算表開啟時的自動觸發器 (綁定自訂選單)
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📍 Sheet2Map')
      .addItem('⚙️ 初始化/修復所有工作表 (Setup)', 'setupCatalogSheetFromMenu')
      .addItem('🔍 地址地理編碼 (Geocode Addresses)', 'geocodePointsSheet')
      .addToUi();
  } catch (err) {
    Logger.log("無法在試算表 UI 中建立選單，可能不處於試算表容器環境中: " + err.message);
  }
}

/**
 * 從自訂選單觸發的初始化函數 (操作當前作用中的試算表)
 */
function setupCatalogSheetFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "準備進行初始化",
    "此操作將會清空當前試算表的 MAP_LIST、MAP_METADATA、POINTS 分頁並重建範例資料，您確定要繼續嗎？",
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    const catalogSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. MAP_LIST
    let catalogSheet = catalogSpreadsheet.getSheetByName("MAP_LIST");
    if (!catalogSheet) {
      catalogSheet = catalogSpreadsheet.insertSheet("MAP_LIST");
    }
    catalogSheet.clear();
    const listHeaders = [
      "map_id", "title", "group", "visibility", "spreadsheet_id", "status", 
      "icon", "theme_color", "default_zoom", "enable_gps", "enable_share", 
      "enable_favorites", "enable_cross_search"
    ];
    catalogSheet.getRange(1, 1, 1, listHeaders.length).setValues([listHeaders]);
    const sample1 = [
      "quit-smoking", "臺南市戒菸門診地圖", "health", "public", catalogSpreadsheet.getId(), "active",
      "🚭", "green", "13", "TRUE", "TRUE", "FALSE", "FALSE"
    ];
    const sample2 = [
      "aed", "AED地圖", "public", "hub", catalogSpreadsheet.getId(), "active",
      "❤️", "red", "14", "TRUE", "TRUE", "TRUE", "FALSE"
    ];
    catalogSheet.getRange(2, 1, 1, sample1.length).setValues([sample1]);
    catalogSheet.getRange(3, 1, 1, sample2.length).setValues([sample2]);
    
    // 2. MAP_METADATA
    let metadataSheet = catalogSpreadsheet.getSheetByName("MAP_METADATA");
    if (!metadataSheet) {
      metadataSheet = catalogSpreadsheet.insertSheet("MAP_METADATA");
    }
    metadataSheet.clear();
    const metadataHeaders = [
      "title", "description", "category", "source_name", "source_url", "source_date", "imported_at"
    ];
    metadataSheet.getRange(1, 1, 1, metadataHeaders.length).setValues([metadataHeaders]);
    const metadataRow = [
      "臺南市健康與安全整合地圖",
      "提供臺南市內優質戒菸診所與 AED 急救設備點位查詢。",
      "健康醫療",
      "政府開放資料網",
      "https://data.gov.tw",
      "2026-06",
      "2026-06-30"
    ];
    metadataSheet.getRange(2, 1, 1, metadataRow.length).setValues([metadataRow]);

    // 3. POINTS
    let pointsSheet = catalogSpreadsheet.getSheetByName("POINTS");
    if (!pointsSheet) {
      pointsSheet = catalogSpreadsheet.insertSheet("POINTS");
    }
    pointsSheet.clear();
    const pointsHeaders = [
      "id", "name", "lat", "lng", "category", "address", 
      "district", "phone", "website", "description", 
      "image", "opening_hours", "tags"
    ];
    pointsSheet.getRange(1, 1, 1, pointsHeaders.length).setValues([pointsHeaders]);
    const point1 = [
      "clinic-1", "臺南市民健康戒菸診所", "22.997", "120.201", "戒菸門診", "臺南市中西區健康路一段100號", "中西區", "06-2151234", "https://health.tainan.gov.tw", "專業醫師諮詢與免費戒菸貼片提供。", "", "週一至週五 09:00-17:00", "免費諮詢,門診"
    ];
    const point2 = [
      "aed-1", "臺南火車站大廳 AED", "", "", "AED 設備", "臺南市東區北門路二段4號", "東區", "", "", "火車站旅客大廳柱子旁，緊急求救電話下。", "", "24小時開放", "火車站,急救"
    ];
    // 💡 故意讓第二個點 (AED) 的經緯度空白，方便使用者測試地理編碼 (Geocoding)
    pointsSheet.getRange(2, 1, 1, point1.length).setValues([point1]);
    pointsSheet.getRange(3, 1, 1, point2.length).setValues([point2]);

    ui.alert("初始化成功！已填入 MAP_LIST、MAP_METADATA 與 POINTS 工作表。");
  } catch (err) {
    ui.alert("初始化失敗: " + err.message);
  }
}

/**
 * 針對 POINTS 工作表中有地址、無經緯度的點位執行地理編碼 (OSM Nominatim + 快取)
 */
function geocodePointsSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pointsSheet = ss.getSheetByName("POINTS");
  if (!pointsSheet) {
    ui.alert("找不到 'POINTS' 工作表。");
    return;
  }

  // 確保建立 ADDRESS_CACHE 暫存快取分頁，防範對 Nominatim API 重複請求
  let cacheSheet = ss.getSheetByName("ADDRESS_CACHE");
  if (!cacheSheet) {
    cacheSheet = ss.insertSheet("ADDRESS_CACHE");
    cacheSheet.getRange(1, 1, 1, 3).setValues([["address", "lat", "lng"]]);
    cacheSheet.setColumnWidth(1, 300);
  }

  // 讀取現有快取
  const cacheRows = getSheetRows(cacheSheet);
  const cacheMap = {};
  cacheRows.forEach(r => {
    if (r.address && r.lat && r.lng) {
      cacheMap[String(r.address).trim()] = {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng)
      };
    }
  });

  const range = pointsSheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) {
    ui.alert("POINTS 工作表中無點位資料。");
    return;
  }

  const headers = values[0].map(h => String(h).trim());
  const addressCol = headers.indexOf("address") + 1;
  const latCol = headers.indexOf("lat") + 1;
  const lngCol = headers.indexOf("lng") + 1;

  if (addressCol <= 0 || latCol <= 0 || lngCol <= 0) {
    ui.alert("POINTS 工作表必須包含 address、lat、lng 欄位。");
    return;
  }

  let geocodeCount = 0;
  let cacheHitCount = 0;
  let failedCount = 0;

  const newCacheEntries = [];
  let pointsSheetModified = false;

  for (let i = 1; i < values.length; i++) {
    const address = String(values[i][addressCol - 1]).trim();
    const latVal = values[i][latCol - 1];
    const lngVal = values[i][lngCol - 1];

    // 有地址且經緯度任一欄位為空時，啟動地理編碼
    if (address && (latVal === "" || lngVal === "")) {
      // 1. 先查找快取
      if (cacheMap[address]) {
        const coords = cacheMap[address];
        values[i][latCol - 1] = coords.lat;
        values[i][lngCol - 1] = coords.lng;
        pointsSheetModified = true;
        cacheHitCount++;
      } else {
        // 2. 使用 Google Apps Script 內建之 Google Maps Geocoder API
        try {
          Utilities.sleep(100); // 微調以防超頻 API QPS
          const geocoder = Maps.newGeocoder().setLanguage("zh-TW");
          const response = geocoder.geocode(address);
          
          if (response.status === "OK" && response.results && response.results.length > 0) {
            const lat = response.results[0].geometry.location.lat;
            const lng = response.results[0].geometry.location.lng;
            
            // 寫入點位表記憶體資料
            values[i][latCol - 1] = lat;
            values[i][lngCol - 1] = lng;
            pointsSheetModified = true;
            
            // 寫入快取記憶體資料，準備批次寫入
            newCacheEntries.push([address, lat, lng]);
            cacheMap[address] = { lat, lng };
            geocodeCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          Logger.log("Google 地理編碼出錯 (" + address + "): " + err.message);
          failedCount++;
        }
      }
    }
  }

  // 批次寫入 POINTS
  if (pointsSheetModified) {
    range.setValues(values);
  }

  // 批次寫入快取
  if (newCacheEntries.length > 0) {
    cacheSheet.getRange(cacheSheet.getLastRow() + 1, 1, newCacheEntries.length, 3).setValues(newCacheEntries);
  }

  ui.alert(
    "🧭 地理編碼作業完成！\n\n" +
    "✨ 成功從 API 解析: " + geocodeCount + " 筆\n" +
    "💾 快取直接命中: " + cacheHitCount + " 筆\n" +
    "⚠️ 解析失敗/無相符座標: " + failedCount + " 筆"
  );
}
