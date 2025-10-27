# 📁 Struktur Proyek E-Kantin App

## 🌲 Tree Structure

```
e-kantin-app/
├── .env.local                 # Environment variables (Supabase config)
├── .next/                     # Build folder (auto-generated)
├── node_modules/             # Dependencies
├── public/                   # Static assets
├── src/
│   ├── app/
│   │   ├── globals.css       # Global styles (Tailwind + custom)
│   │   ├── layout.tsx        # Root layout dengan metadata
│   │   └── page.tsx          # Home page (main page)
│   ├── components/
│   │   ├── SearchBar.tsx     # Komponen search bar
│   │   ├── MealFilter.tsx    # Komponen filter waktu makan
│   │   ├── KantinCard.tsx    # Komponen card kantin
│   │   └── KantinList.tsx    # Komponen list kantin dengan loading
│   └── lib/
│       └── supabase.ts       # Supabase client & types
├── eslint.config.mjs         # ESLint configuration
├── next.config.ts            # Next.js configuration
├── next-env.d.ts             # Next.js TypeScript definitions
├── package.json              # Dependencies & scripts
├── postcss.config.mjs        # PostCSS configuration
├── tsconfig.json             # TypeScript configuration
├── supabase-schema.sql       # Database schema & sample data
├── SETUP_DATABASE.md         # Panduan setup database
└── README.md                 # Project documentation
```

## 📄 File Details

### Root Files

#### `.env.local`
Environment variables untuk konfigurasi Supabase:
- `SUPABASE_URL`: URL project Supabase
- `SUPABASE_ANON_KEY`: Public anon key untuk client-side

#### `package.json`
Dependencies:
- `next`: 16.0.0
- `react`: 19.2.0
- `@supabase/supabase-js`: Supabase client
- `lucide-react`: Icon library
- `tailwindcss`: 4.x (latest)

### Source Files

#### `src/app/page.tsx`
**Main Page Component**
- Client component dengan state management
- Fetch data dari Supabase
- Search & filter functionality
- Responsive layout

**State:**
- `searchQuery`: String untuk pencarian
- `mealFilter`: Filter waktu makan ('semua' | 'makan_pagi' | 'makan_siang' | 'snack')
- `kantins`: Array semua kantin dari database
- `filteredKantins`: Array kantin setelah difilter
- `loading`: Boolean loading state

**Sections:**
1. Header - Logo & title
2. Search Bar - Input pencarian
3. Meal Filter - Tombol filter
4. Kantin List - Grid cards
5. Footer - Copyright

#### `src/app/layout.tsx`
**Root Layout**
- Metadata (title, description)
- Font configuration (Geist Sans & Mono)
- Global CSS import
- HTML structure

#### `src/app/globals.css`
**Global Styles**
- Tailwind imports
- CSS variables untuk theme
- Body styling
- Font family configuration

### Components

#### `src/components/SearchBar.tsx`
**Props:**
- `value`: string - current search value
- `onChange`: function - callback saat input berubah

**Features:**
- Icon search dari Lucide
- Input dengan rounded-full border
- Focus state dengan ring
- Placeholder text

#### `src/components/MealFilter.tsx`
**Props:**
- `selected`: MealTime - filter yang aktif
- `onSelect`: function - callback saat filter dipilih

**Features:**
- 4 tombol filter (Semua, Makan Pagi, Makan Siang, Snack)
- Active state: hitam background
- Inactive state: putih dengan border
- Hover effect

**Type Export:**
- `MealTime`: 'semua' | 'makan_pagi' | 'makan_siang' | 'snack'

#### `src/components/KantinCard.tsx`
**Props:**
- `kantin`: Kantin object

**Features:**
- Image dengan fallback icon
- Nama kantin (bold, line-clamp-2)
- Status badge (BUKA/TUTUP)
- Tags untuk meal times
- Hover effect: shadow hitam
- Border hitam tebal

#### `src/components/KantinList.tsx`
**Props:**
- `kantins`: Kantin[] - array of kantin
- `loading`: boolean - loading state

**Features:**
- Loading skeleton (6 cards)
- Empty state message
- Responsive grid:
  - Mobile: 1-2 columns
  - Tablet: 2-3 columns
  - Desktop: 3-4 columns
- Auto-wrap cards

### Library

#### `src/lib/supabase.ts`
**Exports:**
- `supabase`: Supabase client instance
- `Kantin`: TypeScript type

**Kantin Type:**
```typescript
{
  id: string
  nama: string
  foto_url: string
  status: 'buka' | 'tutup'
  makan_pagi: boolean
  makan_siang: boolean
  snack: boolean
  created_at: string
}
```

## 🎨 Design System

### Colors
- **Primary**: Black (#000000)
- **Background**: White (#FFFFFF)
- **Gray**: #F3F4F6 (backgrounds), #6B7280 (text)

### Typography
- **Font**: Geist Sans (primary), Geist Mono (code)
- **Weights**: Regular (400), Medium (500), Bold (700), Black (900)
- **Sizes**: 
  - Title: 2xl (24px)
  - Card Title: lg (18px)
  - Body: base (16px)
  - Small: sm (14px), xs (12px)

### Spacing
- **Gap**: 3 (12px), 6 (24px)
- **Padding**: 4 (16px), 6 (24px), 8 (32px)
- **Margin**: 6 (24px), 8 (32px), 16 (64px)

### Border
- **Width**: 2px (thick, aesthetic)
- **Radius**: 
  - Full (pills, buttons)
  - 2xl (cards)
  - md (tags)

### Effects
- **Shadow**: `8px 8px 0px 0px rgba(0,0,0,1)` on hover
- **Transition**: all 300ms
- **Ring**: 2px on focus

## 🔄 Data Flow

1. **Initial Load**
   - `page.tsx` mounts
   - `useEffect` fetch data dari Supabase
   - Set `kantins` state
   - Set `loading` false

2. **Search**
   - User type di `SearchBar`
   - `searchQuery` state updates
   - `useEffect` filters `kantins`
   - `filteredKantins` updates
   - Re-render `KantinList`

3. **Filter**
   - User click filter button
   - `mealFilter` state updates
   - `useEffect` filters `kantins`
   - `filteredKantins` updates
   - Re-render `KantinList`

## 📱 Responsive Breakpoints

- **sm**: 640px (mobile landscape)
- **md**: 768px (tablet)
- **lg**: 1024px (desktop)
- **xl**: 1280px (large desktop)

## 🚀 Build & Deploy

### Development
```bash
npm run dev      # Start dev server
```

### Production
```bash
npm run build    # Build production
npm run start    # Start production server
```

### Lint
```bash
npm run lint     # Run ESLint
```

## 🔧 Configuration Files

- **next.config.ts**: Next.js settings
- **tsconfig.json**: TypeScript compiler options
- **eslint.config.mjs**: Linting rules
- **postcss.config.mjs**: PostCSS plugins
- **tailwind.config**: Handled by Tailwind 4 (auto)

## 📚 Dependencies Overview

### Production
- `next`: React framework
- `react`, `react-dom`: React library
- `@supabase/supabase-js`: Database client
- `lucide-react`: Icon library

### Development
- `typescript`: Type checking
- `@types/*`: Type definitions
- `tailwindcss`: CSS framework
- `eslint`: Code linting
- `babel-plugin-react-compiler`: React optimization
