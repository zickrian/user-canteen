'use client'

import Image from 'next/image'

type MealTime = 'Makan Pagi' | 'Makan Siang' | 'Snack' | 'Minuman' | ''

interface MealFilterProps {
  selected: MealTime
  onSelect: (filter: MealTime) => void
}

const filters: { label: string; value: MealTime; icon?: string }[] = [
  {
    label: 'Makan Pagi',
    value: 'Makan Pagi',
    icon: 'https://png.pngtree.com/png-vector/20230901/ourmid/pngtree-breakfast-icon-illustration-vector-png-image_7016287.png',
  },
  {
    label: 'Makan Siang',
    value: 'Makan Siang',
    icon: 'https://png.pngtree.com/png-clipart/20230913/original/pngtree-packed-lunch-vector-png-image_11058643.png',
  },
  {
    label: 'Snack',
    value: 'Snack',
    icon: 'https://cdn-icons-png.flaticon.com/512/2575/2575818.png',
  },
  {
    label: 'Minuman',
    value: 'Minuman',
    icon: 'https://png.pngtree.com/png-clipart/20230913/original/pngtree-beverages-clipart-collection-of-drinks-with-various-fruit-cartoon-vector-png-image_11064846.png',
  },
]

export default function MealFilter({ selected, onSelect }: MealFilterProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 w-full">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onSelect(selected === filter.value ? '' : filter.value)}
          className={`
            w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl transition-all text-left
            border shadow-sm shadow-black/5
            ${
              selected === filter.value
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-200 border-red-500'
                : 'bg-white text-black border-gray-200 hover:shadow-md hover:border-red-300'
            }
          `}
        >
          {filter.icon ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-50 overflow-hidden border border-gray-100">
                <Image
                  src={filter.icon}
                  alt={filter.label}
                  fill
                  className="object-contain"
                  sizes="48px"
                  unoptimized
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-semibold leading-tight line-clamp-1">{filter.label}</span>
                <span className={`text-[11px] sm:text-xs ${selected === filter.value ? 'text-red-50/90' : 'text-gray-500'}`}>
                  Pilih kategori {filter.label.toLowerCase()}
                </span>
              </div>
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
