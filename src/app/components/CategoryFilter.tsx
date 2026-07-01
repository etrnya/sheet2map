'use client';

import { MapConfig } from '@/types/map';

interface CategoryFilterProps {
  categories: { name: string; count: number }[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  config: MapConfig;
  favoritesCount?: number;
  totalPointsCount?: number;
}

// 根據 theme_color 名稱返回 Tailwind 樣式類別對照
const getThemeClasses = (colorName: string): { active: string; border: string } => {
  const colors: Record<string, { active: string; border: string }> = {
    green: { active: 'bg-emerald-500 text-white shadow-emerald-100', border: 'border-emerald-200' },
    orange: { active: 'bg-orange-500 text-white shadow-orange-100', border: 'border-orange-200' },
    red: { active: 'bg-red-500 text-white shadow-red-100', border: 'border-red-200' },
    blue: { active: 'bg-blue-500 text-white shadow-blue-100', border: 'border-blue-200' },
    purple: { active: 'bg-purple-500 text-white shadow-purple-100', border: 'border-purple-200' },
    pink: { active: 'bg-pink-500 text-white shadow-pink-100', border: 'border-pink-200' },
    gray: { active: 'bg-gray-500 text-white shadow-gray-100', border: 'border-gray-300' },
  };
  return colors[colorName.toLowerCase()] || colors.blue;
};

export default function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  config,
  favoritesCount = 0,
  totalPointsCount = 0,
}: CategoryFilterProps) {
  const theme = getThemeClasses(config.theme_color);

  return (
    <div className="relative w-full z-10 select-none overflow-x-auto no-scrollbar scroll-smooth">
      {/* 橫向捲動容器 */}
      <div className="flex gap-2 pb-1 pr-4">
        {/* 「全部」按鈕 */}
        <button
          onClick={() => onSelectCategory('')}
          className={`px-4 py-2 text-[14px] font-semibold border rounded-full transition-all duration-300 active:scale-95 whitespace-nowrap ${
            selectedCategory === ''
              ? `${theme.active} border-transparent shadow-md`
              : 'bg-white/95 text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          全部 ({totalPointsCount})
        </button>

        {/* ⭐️ 「我的收藏」按鈕 (若地圖設定啟用) */}
        {config.enable_favorites && (
          <button
            onClick={() => onSelectCategory('__favorites__')}
            className={`px-4 py-2 text-[14px] font-semibold border rounded-full transition-all duration-300 active:scale-95 whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === '__favorites__'
                ? 'bg-yellow-500 text-white shadow-md border-transparent shadow-yellow-100'
                : 'bg-white/95 text-yellow-600 border-yellow-100 hover:bg-yellow-50/50'
            }`}
          >
            ⭐ 我的收藏 ({favoritesCount})
          </button>
        )}

        {/* 各分類按鈕 */}
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onSelectCategory(cat.name)}
            className={`px-4 py-2 text-[14px] font-semibold border rounded-full transition-all duration-300 active:scale-95 whitespace-nowrap ${
              selectedCategory === cat.name
                ? `${theme.active} border-transparent shadow-md`
                : 'bg-white/95 text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat.name} ({cat.count})
          </button>
        ))}
      </div>
    </div>
  );
}
