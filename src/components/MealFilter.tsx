'use client'

type MealTime = 'Makan Pagi' | 'Makan Siang' | 'Snack' | 'Minuman' | ''

interface MealFilterProps {
  selected: MealTime
  onSelect: (filter: MealTime) => void
}

const filters: { label: string; value: MealTime; icon: string }[] = [
  {
    label: 'Makan Pagi',
    value: 'Makan Pagi',
    icon: '🌅',
  },
  {
    label: 'Makan Siang',
    value: 'Makan Siang',
    icon: '🍽️',
  },
  {
    label: 'Snack',
    value: 'Snack',
    icon: '🍿',
  },
  {
    label: 'Minuman',
    value: 'Minuman',
    icon: '🧋',
  },
]

export default function MealFilter({ selected, onSelect }: MealFilterProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 w-full">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onSelect(selected === filter.value ? '' : filter.value)}
          className={`
            w-full px-2.5 sm:px-3 md:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all text-left
            border shadow-sm
            ${selected === filter.value
              ? 'bg-zinc-900 text-white shadow-zinc-200 border-zinc-900 transform scale-[1.02]'
              : 'bg-white text-zinc-900 border-zinc-100 hover:shadow-md hover:border-orange-200 hover:-translate-y-0.5'
            }
          `}
        >
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl border shrink-0 flex items-center justify-center text-xl sm:text-2xl ${selected === filter.value ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-50 border-zinc-100'}`}>
              <span aria-hidden="true">{filter.icon}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm md:text-base font-bold leading-tight line-clamp-1">{filter.label}</span>
              <span className={`text-[10px] sm:text-[11px] md:text-xs font-medium ${selected === filter.value ? 'text-zinc-400' : 'text-zinc-400'}`}>
                Cari {filter.label.toLowerCase()}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

export type { MealTime }
