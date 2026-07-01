import { getMapDataAction } from '@/app/actions';
import MapContainer from '@/app/components/MapContainer';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ mapId: string }>;
}

// 🌐 動態產生 SEO 與 LINE 分享預覽資料 (Open Graph)
export async function generateMetadata({ params }: PageProps) {
  const { mapId } = await params;
  const result = await getMapDataAction(mapId);
  
  if (result.success && result.data?.metadata) {
    const meta = result.data.metadata;
    return {
      title: meta.title,
      description: meta.description || '手機版微型互動地圖平台',
      openGraph: {
        title: `${meta.title} | Sheet2Map`,
        description: meta.description || '手機版微型互動地圖平台',
        images: [
          {
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: meta.title,
          }
        ],
      }
    };
  }
  
  return {
    title: '互動地圖',
    description: '手機版微型互動地圖平台',
  };
}

export default async function MapPage({ params }: PageProps) {
  const { mapId } = await params;
  
  // 1. 於伺服器端呼叫 Server Action 取得資料 (觸發伺服器端 ISR 快取)
  const result = await getMapDataAction(mapId);

  // 2. 錯誤降級處理：若 API 請求失敗，呈現友善的引導偵錯頁面
  if (!result.success || !result.data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6 select-none">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl shadow-2xl p-8 space-y-6 text-center">
          {/* 錯誤圖示 */}
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-[20px] font-extrabold text-gray-900 leading-tight">
              無法載入地圖資料
            </h2>
            <p className="text-[13px] text-gray-400 font-semibold leading-relaxed">
              原因：{result.error || '請確認網路連線或地圖狀態。'}
            </p>
          </div>

          {/* 偵錯小叮嚀 */}
          <div className="bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 space-y-2.5">
            <h4 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">
              開發偵錯提示：
            </h4>
            <ul className="text-[12px] text-gray-500 font-semibold list-disc list-inside space-y-1.5">
              <li>請確認 <code className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded font-mono">.env</code> 中是否已設定 <code className="font-mono">GAS_API_URL</code> 環境變數。</li>
              <li>請確認該地圖 ID（当前為 <code className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded font-mono">{mapId}</code>）已註冊於全域 Catalog 總表的 <code className="font-mono">MAP_LIST</code> 工作表中。</li>
              <li>請確認 Catalog 總表中的地圖狀態已設為 <code className="bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-bold font-mono">active</code>。</li>
            </ul>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-[14px] rounded-2xl shadow-lg shadow-gray-100 transition-all duration-300 active:scale-95"
            >
              返回地圖目錄
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. 取得資料成功，渲染地圖主頁面
  return (
    <MapContainer
      points={result.data.points}
      config={result.data.config}
      metadata={result.data.metadata}
    />
  );
}
