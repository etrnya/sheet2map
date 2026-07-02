'use client';

import Link from 'next/link';
import { MapConfig, MapMetadata } from '@/types/map';

interface MapCatalogHeaderProps {
  metadata: MapMetadata;
  config: MapConfig;
}

export default function MapCatalogHeader({ metadata, config }: MapCatalogHeaderProps) {
  return (
    <div className="relative w-full z-10">
      {/* 頂部導覽列：毛玻璃懸浮卡片 */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-xl px-5 py-4 flex items-center justify-between gap-4">
        
        {/* 左側：地圖標題與描述 */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* 圖示 */}
          <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl shadow-inner shrink-0">
            {config.icon || '📍'}
          </div>
          {/* 標題與簡述 */}
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold text-gray-900 leading-tight truncate">
              {metadata.title}
            </h1>
            {metadata.description && (
              <p className="text-[12px] text-gray-400 font-semibold truncate mt-0.5">
                {metadata.description}
              </p>
            )}
          </div>
        </div>

        {/* 右側：返回目錄或切換地圖按鈕 */}
        <Link
          href="/"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-[13px] rounded-xl transition-all duration-300 whitespace-nowrap active:scale-95 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          地圖目錄
        </Link>

      </div>
    </div>
  );
}
