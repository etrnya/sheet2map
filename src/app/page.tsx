import { getMapsListAction } from '@/app/actions';
import Link from 'next/link';

// 根據 theme_color 返回對應的 Tailwind 樣式背景色與陰影
const getCardThemeClasses = (colorName: string): { border: string; bg: string; text: string; shadow: string } => {
  const colors: Record<string, { border: string; bg: string; text: string; shadow: string }> = {
    green: { border: 'group-hover:border-emerald-200', bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-700', shadow: 'hover:shadow-emerald-100/50' },
    orange: { border: 'group-hover:border-orange-200', bg: 'bg-orange-50 text-orange-600', text: 'text-orange-700', shadow: 'hover:shadow-orange-100/50' },
    red: { border: 'group-hover:border-red-200', bg: 'bg-red-50 text-red-600', text: 'text-red-700', shadow: 'hover:shadow-red-100/50' },
    blue: { border: 'group-hover:border-blue-200', bg: 'bg-blue-50 text-blue-600', text: 'text-blue-700', shadow: 'hover:shadow-blue-100/50' },
    purple: { border: 'group-hover:border-purple-200', bg: 'bg-purple-50 text-purple-600', text: 'text-purple-700', shadow: 'hover:shadow-purple-100/50' },
    pink: { border: 'group-hover:border-pink-200', bg: 'bg-pink-50 text-pink-600', text: 'text-pink-700', shadow: 'hover:shadow-pink-100/50' },
    gray: { border: 'group-hover:border-gray-200', bg: 'bg-gray-50 text-gray-600', text: 'text-gray-700', shadow: 'hover:shadow-gray-100/50' },
  };
  return colors[colorName.toLowerCase()] || colors.blue;
};

export default async function HubPage() {
  const result = await getMapsListAction();
  const maps = result.success && result.maps ? result.maps : [];

  return (
    <main className="min-h-screen bg-gray-50/50 select-none pb-16">
      
      {/* 1. 頂部主視覺 Banner：動態漸層與品牌 Slogan */}
      <section className="relative w-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white overflow-hidden py-16 px-6">
        {/* 背景網格幾何紋理 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-30"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          {/* 品牌標章 */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[12px] font-bold tracking-wider uppercase">
            🚀 Sheet2Map 地圖中心
          </div>
          
          <h1 className="text-[32px] md:text-[44px] font-extrabold tracking-tight leading-none">
            Sheet2Map 互動地圖平台
          </h1>
          
          <p className="text-[15px] md:text-[18px] text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
            Turn Any Spreadsheet, OpenData, or Ranking into a Mobile Interactive Map.
            <span className="block mt-1 text-slate-400">任何試算表、OpenData 或排行榜，都能一鍵轉成手機版互動地圖。</span>
          </p>
        </div>
      </section>

      {/* 2. 地圖目錄卡片清單 (Map Catalog Cards) */}
      <section className="max-w-5xl mx-auto px-6 -mt-8 relative z-10 space-y-10">
        
        {/* 目錄卡片網格 */}
        {maps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {maps.map((map) => {
              const theme = getCardThemeClasses(map.theme_color);
              return (
                <Link
                  key={map.map_id}
                  href={`/${map.map_id}`}
                  className={`group bg-white border border-gray-200/80 rounded-3xl shadow-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between gap-6 ${theme.shadow} ${theme.border}`}
                >
                  <div className="space-y-4">
                    {/* 卡片標頭：圖示與分類 */}
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform duration-300">
                        {map.icon}
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                        {map.group}
                      </span>
                    </div>

                    {/* 地圖標題 */}
                    <div>
                      <h3 className="text-[17px] font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {map.title}
                      </h3>
                      <p className="text-[12px] text-gray-400 font-semibold mt-1">
                        路由代碼：/{map.map_id}
                      </p>
                    </div>
                  </div>

                  {/* 進入地圖按鈕 */}
                  <div className={`flex items-center justify-between text-[13px] font-bold ${theme.text} pt-2`}>
                    <span>開啟互動地圖</span>
                    <svg className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* 無資料時的引導 */
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-3xl shadow-2xl p-8 space-y-6 text-center mx-auto">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-[18px] font-extrabold text-gray-900 leading-tight">
                地圖目錄目前為空
              </h2>
              <p className="text-[13px] text-gray-400 font-semibold leading-relaxed">
                尚未在 Google Sheets Catalog 中註冊任何啟用之地圖，或環境變數設定不完全。
              </p>
            </div>

            {/* 偵錯說明 */}
            <div className="bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 space-y-2.5">
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                請依序進行以下配置：
              </h4>
              <ol className="text-[12px] text-gray-500 font-semibold list-decimal list-inside space-y-1.5 leading-normal">
                <li>將 <code className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded font-mono font-bold">gas/Code.js</code> 程式碼貼入您的 Google Apps Script 編輯器中。</li>
                <li>將 Apps Script 網址填入本專案根目錄的 <code className="font-mono">.env</code> 檔，鍵名為 <code className="font-mono">GAS_API_URL</code>。</li>
                <li>於 Catalog 試算表之 <code className="font-mono">MAP_LIST</code> 註冊您的地圖，並設定 <code className="font-mono">status = active</code> 與 <code className="font-mono">visibility = hub</code>。</li>
              </ol>
            </div>
          </div>
        )}

      </section>

    </main>
  );
}
