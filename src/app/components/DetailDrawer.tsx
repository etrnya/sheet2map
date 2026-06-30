'use client';

import { MapConfig, MapPoint } from '@/types/map';

interface DetailDrawerProps {
  point: MapPoint | null;
  onClose: () => void;
  config: MapConfig;
}

export default function DetailDrawer({ point, onClose, config }: DetailDrawerProps) {
  if (!point) return null;

  // 建立 Google 地圖導航連結
  const getNavigationUrl = () => {
    if (point.lat && point.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.name)}`;
  };

  // 分享功能
  const handleShare = () => {
    if (!navigator.share) {
      // 降級方案：複製連結到剪貼簿
      const shareUrl = `${window.location.origin}${window.location.pathname}?point=${point.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('地點連結已成功複製至剪貼簿！');
      });
      return;
    }

    navigator.share({
      title: point.name,
      text: point.description || `為您分享位於 ${point.address} 的地點！`,
      url: `${window.location.origin}${window.location.pathname}?point=${point.id}`,
    }).catch(console.error);
  };

  return (
    /* 
      抽屜容器：
      - 手機版：位於螢幕底部，自底部彈起
      - 桌機版：位於螢幕左側，自左側滑出，高度覆蓋
    */
    <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:left-0 md:right-auto md:w-96 z-20 flex flex-col pointer-events-none">
      
      {/* 遮罩，僅在手機版點擊空白處關閉，地圖本身已經能處理 click。這裡主要用來排版 */}
      <div className="flex-1 pointer-events-none md:hidden" onClick={onClose}></div>

      {/* 詳情本體：毛玻璃質感，精緻圓角與陰影 */}
      <div className="w-full bg-white/95 backdrop-blur-lg border-t border-gray-200/80 md:border-t-0 md:border-r rounded-t-3xl md:rounded-t-none md:rounded-r-3xl shadow-2xl pointer-events-auto flex flex-col max-h-[70vh] md:max-h-full h-full transition-all duration-500 ease-out transform translate-y-0 md:translate-x-0">
        
        {/* 手機版頂部拖曳條視覺提示 */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-3 md:hidden"></div>

        {/* 頂部控制列 */}
        <div className="flex justify-between items-center px-6 pt-2 md:pt-6 pb-2">
          <span className="text-[12px] font-bold tracking-wider uppercase bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
            {point.category}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 滾動內容區 */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-5">
          {/* 照片預覽 (若有) */}
          {point.image && (
            <div className="relative w-full h-40 rounded-2xl overflow-hidden shadow-inner bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={point.image}
                alt={point.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* 地標名稱 */}
          <div>
            <h2 className="text-[22px] font-extrabold text-gray-900 leading-tight">
              {point.name}
            </h2>
            {point.district && (
              <p className="text-[13px] text-gray-400 font-semibold mt-1">
                行政區：{point.district}
              </p>
            )}
          </div>

          {/* 標籤群組 */}
          {point.tags && point.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {point.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-[12px] font-semibold bg-blue-50 text-blue-600 rounded-lg"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 地標描述 */}
          {point.description && (
            <p className="text-[14px] leading-relaxed text-gray-600 font-medium bg-gray-50 p-4 rounded-2xl border border-gray-100">
              {point.description}
            </p>
          )}

          {/* 聯絡資訊列表 */}
          <div className="space-y-3.5 pt-2">
            {/* 地址 */}
            {point.address && (
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="text-[14px] text-gray-700 font-semibold break-all leading-tight">
                  <p>{point.address}</p>
                </div>
              </div>
            )}

            {/* 電話 */}
            {point.phone && (
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a
                  href={`tel:${point.phone}`}
                  className="text-[14px] text-blue-600 font-semibold hover:underline"
                >
                  {point.phone}
                </a>
              </div>
            )}

            {/* 營業時間 */}
            {point.opening_hours && (
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[14px] text-gray-600 font-semibold">
                  {point.opening_hours}
                </span>
              </div>
            )}

            {/* 官方網站 */}
            {point.website && (
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <a
                  href={point.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-blue-600 font-semibold hover:underline truncate flex-1"
                >
                  瀏覽官方網站
                </a>
              </div>
            )}
          </div>

          {/* 渲染 custom_ 開頭的自訂欄位 */}
          {point.custom_fields && Object.keys(point.custom_fields).length > 0 && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-[12px] font-bold text-gray-400 tracking-wider uppercase">
                自訂欄位資訊
              </h3>
              <div className="grid grid-cols-2 gap-3 bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100">
                {Object.entries(point.custom_fields).map(([key, val]) => (
                  <div key={key} className="space-y-0.5">
                    <p className="text-[11px] text-gray-400 font-bold uppercase truncate">
                      {key.replace(/^custom_/, '').replace(/_/g, ' ')}
                    </p>
                    <p className="text-[13px] text-gray-800 font-bold">
                      {String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部功能按鈕列 */}
        <div className="p-6 border-t border-gray-200/80 flex gap-3 bg-gray-50/50 rounded-b-3xl md:rounded-b-none">
          {/* 導航按鈕：大面積主題底色 */}
          <a
            href={getNavigationUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[15px] rounded-2xl shadow-lg shadow-blue-100 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            導航路線
          </a>

          {/* 分享按鈕 (若啟用) */}
          {config.enable_share && (
            <button
              onClick={handleShare}
              className="flex items-center justify-center w-14 h-14 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-2xl shadow-md transition-all duration-300 active:scale-95"
              title="分享此地點"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l4.636-2.318M8.684 13.258l4.636 2.318m6.03-.496A3.5 3.5 0 1115.02 12a3.5 3.5 0 012.33 3.582zM4.516 12a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z" />
              </svg>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
