import { MapDataPayload, MapPoint } from '../types/map';

const GAS_API_URL = process.env.GAS_API_URL || process.env.NEXT_PUBLIC_GAS_API_URL;
const isDev = process.env.NODE_ENV === 'development';

export interface CatalogMapSummary {
  map_id: string;
  title: string;
  group: string;
  visibility: string;
  icon: string;
  theme_color: string;
  default_zoom: number;
}

/**
 * 基礎設施層 (Infrastructure Layer)
 * 負責串接外部 Google Apps Script Web App API
 */

// 1. 取得指定地圖的點位與 Config
export async function fetchMapDataFromGAS(mapId: string): Promise<MapDataPayload> {
  if (!GAS_API_URL) {
    throw new Error('未設定環境變數 GAS_API_URL 或 NEXT_PUBLIC_GAS_API_URL。');
  }

  // 💡 加上 _cb 參數（Cache Buster）來強制刷掉 Vercel 舊有的持久快取，同時維持一小時的快取機制
  const url = `${GAS_API_URL}?map_id=${encodeURIComponent(mapId)}&_cb=v2`;
  
  try {
    const response = await fetch(url, {
      // 💡 開發模式下不啟用快取 (revalidate: 0) 以利即時偵錯；生產環境快取一小時 (ISR)
      next: { revalidate: isDev ? 0 : 3600 },
    });

    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }

    const data: MapDataPayload = await response.json();
    if (!data.success) {
      const errMsg = (data as unknown as { error?: string }).error || '讀取地圖資料失敗';
      throw new Error(errMsg);
    }

    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [Infrastructure] fetchMapDataFromGAS 失敗 (mapId: ${mapId}):`, msg);
    throw err;
  }
}

// 2. 取得所有啟用的地圖註冊清單 (Catalog)
export async function fetchMapsListFromGAS(): Promise<CatalogMapSummary[]> {
  if (!GAS_API_URL) {
    throw new Error('未設定環境變數 GAS_API_URL 或 NEXT_PUBLIC_GAS_API_URL。');
  }

  const url = `${GAS_API_URL}?action=list`;
  
  try {
    const response = await fetch(url, {
      // 💡 開發模式下不啟用快取 (revalidate: 0)；生產環境快取 30 分鐘
      next: { revalidate: isDev ? 0 : 1800 },
    });

    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error((data as { error?: string }).error || '讀取地圖清單失敗');
    }

    return (data as { maps: CatalogMapSummary[] }).maps || [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ [Infrastructure] fetchMapsListFromGAS 失敗:', msg);
    throw err;
  }
}

export interface CrossSearchPoint {
  map_id: string;
  map_title: string;
  point: MapPoint;
}

// 3. 跨地圖全域搜尋
export async function fetchSearchAllMapsFromGAS(q: string): Promise<CrossSearchPoint[]> {
  if (!GAS_API_URL) {
    throw new Error('未設定環境變數 GAS_API_URL 或 NEXT_PUBLIC_GAS_API_URL。');
  }

  const url = `${GAS_API_URL}?action=search&q=${encodeURIComponent(q)}`;
  
  try {
    const response = await fetch(url, {
      next: { revalidate: 300 }, // 跨地圖搜尋快取 5 分鐘
    });

    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '跨地圖搜尋失敗');
    }

    return (data.results as CrossSearchPoint[]) || [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [Infrastructure] fetchSearchAllMapsFromGAS 失敗 (q: ${q}):`, msg);
    throw err;
  }
}
