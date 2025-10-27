'use client'

import Image from 'next/image'

type MealTime = 'makan_pagi' | 'makan_siang' | 'snack' | 'minuman' | 'none'

interface MealFilterProps {
  selected: MealTime
  onSelect: (filter: MealTime) => void
}

const filters: { label: string; value: MealTime; icon?: string }[] = [
  {
    label: 'Makan Pagi',
    value: 'makan_pagi',
    icon: 'https://png.pngtree.com/png-vector/20230901/ourmid/pngtree-breakfast-icon-illustration-vector-png-image_7016287.png',
  },
  {
    label: 'Makan Siang',
    value: 'makan_siang',
    icon: 'https://png.pngtree.com/png-clipart/20230913/original/pngtree-packed-lunch-vector-png-image_11058643.png',
  },
  {
    label: 'Snack',
    value: 'snack',
    icon: 'https://cdn.creazilla.com/cliparts/7771642/snacks-clipart-lg.png',
  },
  {
    label: 'Minuman',
    value: 'minuman',
    icon: 'https://png.pngtree.com/png-clipart/20230913/original/pngtree-beverages-clipart-collection-of-drinks-with-various-fruit-cartoon-vector-png-image_11064846.png',
  },
]

export default function MealFilter({ selected, onSelect }: MealFilterProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onSelect(filter.value)}
          className={`
            min-w-max p-4 rounded-lg transition-all shrink-0
            ${
              selected === filter.value
                ? 'bg-black text-white shadow-lg'
                : 'bg-white text-black border border-gray-300 shadow-sm hover:shadow-md'
            }
          `}
        >
          {filter.icon ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-12 h-12">
                <Image
                  src={filter.icon}
                  alt={filter.label}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span className="text-xs font-medium text-center line-clamp-2 w-20">
                {filter.label}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium">{filter.label}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export type { MealTime }
