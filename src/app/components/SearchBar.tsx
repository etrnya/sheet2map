'use client';

import { useState, useEffect } from 'react';
import { MapConfig } from '@/types/map';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  config: MapConfig;
  onTriggerGPS: () => void;
  gpsStatus: 'idle' | 'locating' | 'success' | 'error';
}

export default function SearchBar({
  value,
  onChange,
  config,
  onTriggerGPS,
  gpsStatus,
}: SearchBarProps) {
  const [localVal, setLocalVal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // 💡 React 18/19 建議之 Render 階段同步 Prop 狀態模式，避免使用 useEffect 觸發二次渲染 (避免 ESLint 錯誤)
  if (value !== prevValue) {
    setLocalVal(value);
    setPrevValue(value);
  }

  // 防抖處理 (Debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localVal);
    }, 300);
    return () => clearTimeout(timer);
  }, [localVal, onChange]);

  return (
    <div className="relative w-full z-10 flex gap-2 items-center">
      {/* 搜尋輸入框外層：現代毛玻璃質感 (Glassmorphism) */}
      <div className="flex-1 flex items-center bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-xl px-4 py-3.5 transition-all duration-300 focus-within:border-blue-400 focus-within:shadow-blue-100/50">
        {/* 搜尋圖示 */}
        <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          placeholder="搜尋名稱、地址或區域..."
          className="w-full bg-transparent border-none outline-none text-gray-800 placeholder-gray-400 text-[15px] font-medium"
        />
        {localVal && (
          <button
            onClick={() => setLocalVal('')}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* GPS 定位按鈕 (若地圖設定啟用) */}
      {config.enable_gps && (
        <button
          onClick={onTriggerGPS}
          disabled={gpsStatus === 'locating'}
          className={`flex items-center justify-center w-12 h-12 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-xl transition-all duration-300 active:scale-95 ${
            gpsStatus === 'locating'
              ? 'animate-pulse'
              : gpsStatus === 'success'
              ? 'text-blue-500 hover:bg-blue-50'
              : gpsStatus === 'error'
              ? 'text-red-500 hover:bg-red-50'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          title="GPS 定位目前位置"
        >
          {gpsStatus === 'locating' ? (
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25gC4.5 6.358 7.858 3 12 3c4.142 0 7.5 3.358 7.5 7.5z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
