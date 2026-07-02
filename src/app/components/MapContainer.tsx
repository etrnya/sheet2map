'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapConfig, MapMetadata, MapPoint } from '@/types/map';
import SearchBar from './SearchBar';
import CategoryFilter from './CategoryFilter';
import DetailDrawer from './DetailDrawer';
import MapDataFooter from './MapDataFooter';
import MapCatalogHeader from './MapCatalogHeader';
import { searchAllMapsAction } from '@/app/actions';
import { CrossSearchPoint } from '@/utils/gas';

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

  // ⭐️ 收藏夾點位 ID 狀態與本地儲存同步
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`s2m_fav_${config.map_id}`);
      if (stored) {
        try {
          setFavorites(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse favorites:', e);
        }
      }
    }
  }, [config.map_id]);

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`s2m_fav_${config.map_id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // 🌐 跨地圖全域搜尋狀態與副作用
  const [crossResults, setCrossResults] = useState<CrossSearchPoint[]>([]);
  const [isCrossSearching, setIsCrossSearching] = useState(false);

  useEffect(() => {
    if (!config.enable_cross_search) return;
    if (searchQuery.trim().length <= 1) {
      setCrossResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCrossSearching(true);
      try {
        const res = await searchAllMapsAction(searchQuery);
        if (res.success && res.results) {
          // 過濾掉目前地圖的點位，只呈現其他地圖中符合關鍵字者
          const filtered = res.results.filter((x) => x.map_id !== config.map_id);
          setCrossResults(filtered);
        } else {
          setCrossResults([]);
        }
      } catch (err) {
        console.error('Cross search error:', err);
        setCrossResults([]);
      } finally {
        setIsCrossSearching(false);
      }
    }, 500); // 500ms 防抖

    return () => clearTimeout(timer);
  }, [searchQuery, config.map_id, config.enable_cross_search]);

  // 1. 動態分析出所有點位擁有的分類與數量列表
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    points.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [points]);

  // 2. 進行前端點位篩選 (搜尋關鍵字 + 分類篩選 + 收藏夾過濾)
  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      // 收藏過濾
      if (selectedCategory === '__favorites__') {
        if (!favorites.includes(p.id)) return false;
      } else if (selectedCategory && p.category !== selectedCategory) {
        // 分類過濾
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
  }, [points, selectedCategory, searchQuery, favorites]);

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
            favoritesCount={favorites.length}
            totalPointsCount={points.length}
          />

          {/* 🌐 跨地圖全域搜尋結果顯示 */}
          {config.enable_cross_search && (isCrossSearching || crossResults.length > 0) && (
            <div className="bg-white/95 backdrop-blur-lg border border-gray-200/80 rounded-2xl p-4 shadow-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 flex items-center gap-1.5">
                  🌐 跨地圖搜尋 {isCrossSearching && <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>}
                </span>
                {crossResults.length > 0 && (
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    在其他地圖找到 {crossResults.length} 筆
                  </span>
                )}
              </div>
              
              {crossResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-100">
                  {crossResults.map((res) => (
                    <a
                      key={`${res.map_id}-${res.point.id}`}
                      href={`/${res.map_id}?point=${res.point.id}`}
                      className="block pt-1.5 first:pt-0 group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-extrabold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                            {res.point.name}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {res.point.address || '無地址資訊'}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-extrabold tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          {res.map_title}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
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
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />

    </main>
  );
}
