'use client';

import { MapMetadata } from '@/types/map';

interface MapDataFooterProps {
  metadata: MapMetadata;
}

// 💡 格式化 ISO 日期字串為易讀的在地化格式 (例如 YYYY-MM-DD HH:mm)
const formatDate = (dateString?: string, showTime: boolean = false): string => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString; // 若解析失敗退回原始字串
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    
    if (showTime) {
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return dateString;
  }
};

export default function MapDataFooter({ metadata }: MapDataFooterProps) {
  // 若沒有最基本的資料來源資訊，則不顯示
  if (!metadata.source_name) return null;

  return (
    <div className="relative w-full z-10">
      {/* 資訊卡：懸浮玻璃卡片，不干擾地圖操作，字體小巧精緻 */}
      <div className="bg-white/90 backdrop-blur-md border border-gray-100 rounded-xl shadow-lg p-3 text-[11px] font-bold text-gray-500 flex flex-wrap gap-x-4 gap-y-1.5 justify-center md:justify-start items-center">
        
        {/* 資料來源 */}
        <div className="flex items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
          <span>資料來源：</span>
          {metadata.source_url ? (
            <a
              href={metadata.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-extrabold flex items-center gap-0.5"
            >
              {metadata.source_name}
              <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="font-extrabold text-gray-700">{metadata.source_name}</span>
          )}
        </div>

        {/* 資料發布時間 */}
        {metadata.source_date && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5"></span>
            <span>資料時間：<strong className="text-gray-700 font-extrabold">{formatDate(metadata.source_date, false)}</strong></span>
          </div>
        )}

        {/* 系統最後匯入時間 */}
        {metadata.imported_at && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
            <span>最後匯入：<strong className="text-gray-700 font-extrabold">{formatDate(metadata.imported_at, true)}</strong></span>
          </div>
        )}

      </div>
    </div>
  );
}
