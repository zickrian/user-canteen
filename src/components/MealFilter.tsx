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
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onSelect(selected === filter.value ? '' : filter.value)}
          className={`
            min-w-max p-4 rounded-lg transition-all shrink-0
            ${
              selected === filter.value
                ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                : 'bg-white text-black border border-gray-300 shadow-sm hover:shadow-md hover:border-red-300'
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
                  sizes="48px"
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
