'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapConfig, MapMetadata, MapPoint } from '@/types/map';
import SearchBar from './SearchBar';
import CategoryFilter from './CategoryFilter';
import DetailDrawer from './DetailDrawer';
import MapDataFooter from './MapDataFooter';
import MapCatalogHeader from './MapCatalogHeader';

// ⏳ 動態載入 LeafletMap (禁用 SSR)，防止 Next.js 在伺服器端渲染時發生 "window is not defined" 錯誤
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50/50 gap-3">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[14px] text-gray-400 font-bold">正在載入地圖模組...</p>
    </div>
  ),
});

interface MapContainerProps {
  points: MapPoint[];
  config: MapConfig;
  metadata: MapMetadata;
}

export default function MapContainer({ points, config, metadata }: MapContainerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  
  // GPS 位置與狀態
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');

  // 1. 動態分析出所有點位擁有的分類列表 (去除重複)
  const categories = useMemo(() => {
    const cats = points.map((p) => p.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [points]);

  // 2. 進行前端點位篩選 (搜尋關鍵字 + 分類篩選)
  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      // 分類過濾
      if (selectedCategory && p.category !== selectedCategory) {
        return false;
      }
      // 關鍵字搜尋 (過濾名稱、地址、行政區)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.name?.toLowerCase().includes(query);
        const addressMatch = p.address?.toLowerCase().includes(query);
        const districtMatch = p.district?.toLowerCase().includes(query);
        const tagMatch = p.tags?.some(t => t.toLowerCase().includes(query));
        return nameMatch || addressMatch || districtMatch || tagMatch;
      }
      return true;
    });
  }, [points, selectedCategory, searchQuery]);

  // 3. 處理 URL 參數傳入指定地標點 (Deep Link 聚焦)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const pointId = urlParams.get('point');
    if (pointId) {
      const match = points.find((p) => p.id === pointId);
      if (match) {
        // 💡 使用 setTimeout 將狀態變更排入下一個事件循環，避免同步 setState 造成級聯渲染警告
        setTimeout(() => {
          setSelectedPoint(match);
        }, 0);
      }
    }
  }, [points]);

  // 4. GPS 使用者定位觸發邏輯
  const handleTriggerGPS = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      alert('您的瀏覽器不支援或未啟用 GPS 定位服務。');
      return;
    }

    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setGpsStatus('success');
      },
      (error) => {
        console.error('GPS Geolocation error:', error);
        setGpsStatus('error');
        alert('定位失敗。請確認是否開啟定位權限與 GPS 服務。');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-gray-100 flex flex-col md:flex-row">
      
      {/* 1. 地圖主體 (佔滿背景) */}
      <div className="absolute inset-0 z-0">
        <LeafletMap
          points={filteredPoints}
          config={config}
          selectedPoint={selectedPoint}
          onSelectPoint={setSelectedPoint}
          userLocation={userLocation}
        />
      </div>

      {/* 2. 懸浮控制介面 (Overlay Panel) */}
      <div className="absolute inset-0 z-10 pointer-events-none p-4 md:p-6 flex flex-col justify-between">
        
        {/* 上半部：標頭、搜尋欄與分類列 */}
        <div className="w-full max-w-md space-y-3 pointer-events-auto">
          {/* 地圖 Catalog 標頭 */}
          <MapCatalogHeader metadata={metadata} config={config} />
          
          {/* 搜尋列 */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            config={config}
            onTriggerGPS={handleTriggerGPS}
            gpsStatus={gpsStatus}
          />
          
          {/* 分類捲動列 */}
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            config={config}
          />
        </div>

        {/* 下半部：資料透明度頁尾 */}
        <div className="w-full max-w-md pointer-events-auto">
          <MapDataFooter metadata={metadata} />
        </div>

      </div>

      {/* 3. 地標詳情抽屜 (自底部彈起或側邊滑出) */}
      <DetailDrawer
        point={selectedPoint}
        onClose={() => setSelectedPoint(null)}
        config={config}
      />

    </main>
  );
}
