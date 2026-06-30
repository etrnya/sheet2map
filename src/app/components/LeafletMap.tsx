'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { MapConfig, MapPoint } from '@/types/map';

interface LeafletMapProps {
  points: MapPoint[];
  config: MapConfig;
  selectedPoint: MapPoint | null;
  onSelectPoint: (point: MapPoint | null) => void;
  userLocation: [number, number] | null;
}

// 根據 theme_color 名稱返回十六進位色碼
const getHexColor = (colorName: string): string => {
  const colors: Record<string, string> = {
    green: '#10B981',
    orange: '#F97316',
    red: '#EF4444',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    pink: '#EC4899',
    gray: '#6B7280',
  };
  return colors[colorName.toLowerCase()] || '#3B82F6';
};

// 建立自訂 SVG Marker 圖示，避免 Next.js 載入預設圖片失敗問題，且能根據主題色動態渲染
const createCustomMarker = (colorName: string) => {
  const hexColor = getHexColor(colorName);
  return L.divIcon({
    html: `
      <div class="relative w-8 h-8 flex items-center justify-center">
        <svg class="w-8 h-8 filter drop-shadow-md transition-transform duration-300 hover:scale-110" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="${hexColor}"/>
        </svg>
        <span class="absolute w-2 h-2 bg-white rounded-full" style="top: 8px;"></span>
      </div>
    `,
    className: 'custom-marker-container',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// 建立使用者定位藍點圖示
const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative w-6 h-6 flex items-center justify-center">
        <div class="absolute w-6 h-6 bg-blue-500 rounded-full opacity-30 animate-ping"></div>
        <div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>
      </div>
    `,
    className: 'user-location-container',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export default function LeafletMap({
  points,
  config,
  selectedPoint,
  onSelectPoint,
  userLocation,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // 1. 初始化地圖
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // 預設以台灣中心為視角
    const defaultCenter: [number, number] = [23.6, 120.9];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 8,
      zoomControl: false, // 關閉預設 zoom 控制鍵，改放到右上角
      attributionControl: true,
    });

    // 載入高質感無障礙地圖圖磚 (Stadia/CartoDB Voyger)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);

    // 新增 Zoom 控制元件到右上角
    L.control.zoom({ position: 'topright' }).addTo(map);

    // 初始化 Marker Cluster Group
    const hexColor = getHexColor(config.theme_color);
    
    // 透過強制轉型避開 Leaflet namespace 沒有宣告 markerClusterGroup 的編譯限制
    const clusterGroup = (L as unknown as { markerClusterGroup: (options?: unknown) => L.FeatureGroup }).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster: unknown) => {
        const childCount = (cluster as { getChildCount: () => number }).getChildCount();
        return L.divIcon({
          html: `
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white transition-transform duration-300 hover:scale-105" 
                 style="background-color: ${hexColor};">
              <span>${childCount}</span>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: [40, 40],
        });
      },
    });

    map.addLayer(clusterGroup);

    mapRef.current = map;
    clusterGroupRef.current = clusterGroup;

    // 清理函數
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [config.theme_color]);

  // 2. 當點位資料 (points) 改變時，更新 Marker
  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    // 清空現有 markers
    clusterGroup.clearLayers();
    markersRef.current.clear();

    if (points.length === 0) return;

    const bounds = L.latLngBounds([]);

    // 建立新點位的 Marker
    points.forEach((p) => {
      if (!p.lat || !p.lng) return;

      const marker = L.marker([p.lat, p.lng], {
        icon: createCustomMarker(config.theme_color),
      });

      // 綁定點擊事件
      marker.on('click', () => {
        onSelectPoint(p);
        map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15), { animate: true });
      });

      // 儲存 marker 參考，供後續定位聚焦使用
      markersRef.current.set(p.id, marker);
      clusterGroup.addLayer(marker);
      bounds.extend([p.lat, p.lng]);
    });

    // 自動調整視野包含所有點位 (第一次載入或點位改變時)
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, config.theme_color, onSelectPoint]);

  // 3. 當選取的特定點位 (selectedPoint) 改變時，地圖聚焦該點
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPoint) return;

    const marker = markersRef.current.get(selectedPoint.id);
    if (marker) {
      map.setView([selectedPoint.lat, selectedPoint.lng], 16, { animate: true });
    }
  }, [selectedPoint]);

  // 4. 使用者定位 GPS 更新與標記
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !config.enable_gps) return;

    if (userLocation) {
      const [lat, lng] = userLocation;
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([lat, lng]);
      } else {
        userMarkerRef.current = L.marker([lat, lng], {
          icon: createUserLocationIcon(),
        }).addTo(map);
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [userLocation, config.enable_gps]);

  // 5. 地圖點擊空白處，關閉詳情抽屜
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // 只有當點擊的不是 Marker 時，才關閉抽屜
      if (e.originalEvent.target && (e.originalEvent.target as HTMLElement).closest('.leaflet-marker-icon')) {
        return;
      }
      onSelectPoint(null);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [onSelectPoint]);

  return (
    <div className="relative w-full h-full">
      {/* 地圖容器 */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
}
