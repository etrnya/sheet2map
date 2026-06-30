'use server';

import { fetchMapDataFromGAS, fetchMapsListFromGAS, CatalogMapSummary } from '@/utils/gas';
import { MapDataPayload } from '@/types/map';

/**
 * 應用層 (Application Layer - Server Action)
 * 負責處理地圖與目錄資料存取，供 Presentation 層呼叫。
 */

// 1. 取得指定地圖點位資料
export async function getMapDataAction(mapId: string): Promise<{ success: boolean; data?: MapDataPayload; error?: string }> {
  try {
    if (!mapId || typeof mapId !== 'string') {
      return { success: false, error: '地圖識別碼 (mapId) 無效或為空。' };
    }

    const payload = await fetchMapDataFromGAS(mapId);
    return { success: true, data: payload };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg || '無法取得地圖資料，請稍後再試。' };
  }
}

// 2. 取得全域地圖註冊清單 (Catalog)
export async function getMapsListAction(): Promise<{ success: boolean; maps?: CatalogMapSummary[]; error?: string }> {
  try {
    const list = await fetchMapsListFromGAS();
    return { success: true, maps: list };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg || '無法取得地圖清單，請稍後再試。' };
  }
}
