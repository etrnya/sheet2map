'use client';

import { MapConfig } from '@/types/map';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  config: MapConfig;
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
          全部 ({categories.length ? '多種' : '0'})
        </button>

        {/* 各分類按鈕 */}
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`px-4 py-2 text-[14px] font-semibold border rounded-full transition-all duration-300 active:scale-95 whitespace-nowrap ${
              selectedCategory === cat
                ? `${theme.active} border-transparent shadow-md`
                : 'bg-white/95 text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
