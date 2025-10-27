'use client'

import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
      <input
        type="text"
        placeholder="Cari kantin atau menu..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full py-3 pl-12 pr-4 text-base border border-gray-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 transition-all"
      />
    </div>
  )
}
