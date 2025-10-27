# 🎯 Quick Start Guide - E-Kantin App

## ✅ Checklist Setup

### 1. Instalasi ✓
- [x] Dependencies terinstal (`npm install`)
- [x] File `.env.local` sudah dibuat
- [x] Supabase credentials sudah dikonfigurasi

### 2. Database Setup
- [ ] Login ke Supabase Dashboard
- [ ] Jalankan script dari `supabase-schema.sql`
- [ ] Insert data dummy (opsional)
- [ ] Verifikasi tabel `kantins` sudah dibuat

### 3. Development
- [ ] Jalankan `npm run dev`
- [ ] Buka http://localhost:3000
- [ ] Test fitur search
- [ ] Test filter waktu makan
- [ ] Test responsive design

## 🎨 Design Highlights

### Aesthetic Black & White Theme
- ⚫ **Black**: Border, text, buttons (active state)
- ⚪ **White**: Background, cards, buttons (inactive)
- 🎭 **No Gradients**: Pure black & white, minimalist
- 🔲 **Thick Borders**: 2px solid black untuk aesthetic
- 🎪 **Shadow Effect**: 8px offset shadow on hover

### Typography
- **Header**: Geist Sans Bold, uppercase, tracking-tight
- **Body**: Geist Sans Regular
- **No Emoji**: Using Lucide icons instead

## 🧩 Component Architecture

```
Page (page.tsx)
├── Header
│   └── Logo (UtensilsCrossed icon) + Title
├── Main
│   ├── SearchBar
│   ├── MealFilter
│   └── KantinList
│       └── KantinCard (multiple)
└── Footer
```

## 🔍 Features Breakdown

### 1. Search Bar
**Location**: Top of page
**Function**: Real-time search kantin by name
**UX**: 
- Icon inside input (left)
- Rounded full border
- Black ring on focus
- Instant filter results

### 2. Meal Filter
**Location**: Below search bar
**Buttons**: 4 chips
- Semua (default)
- Makan Pagi
- Makan Siang  
- Snack

**UX**:
- Active: Black background, white text
- Inactive: White background, black border
- Smooth transition
- Real-time filtering

### 3. Kantin Cards
**Display**: Grid layout (responsive)
**Content**:
- Photo (with fallback icon)
- Name (bold, max 2 lines)
- Status badge (BUKA/TUTUP)
- Meal time tags

**UX**:
- Hover: Shadow effect
- Border: 2px solid black
- Rounded corners: 2xl
- Clean spacing

## 📊 Database Schema

```sql
Table: kantins
├── id (UUID, PK)
├── nama (TEXT, required)
├── foto_url (TEXT, nullable)
├── status (ENUM: 'buka'/'tutup')
├── makan_pagi (BOOLEAN)
├── makan_siang (BOOLEAN)
├── snack (BOOLEAN)
└── created_at (TIMESTAMP)
```

**Security**: RLS enabled, public read access

## 🎯 User Flow

1. **Landing**
   - User sees header with logo & title
   - Search bar immediately visible
   - Filter chips below search
   - Grid of kantin cards

2. **Search**
   - Type in search bar
   - Results filter instantly
   - Shows "Tidak ada kantin ditemukan" if empty

3. **Filter**
   - Click meal time chip
   - Cards filter by availability
   - Can combine with search

4. **Browse**
   - Scroll through cards
   - See status at glance
   - Hover for shadow effect
   - View meal time tags

## 🛠️ Customization Guide

### Menambah Kantin Baru
1. Buka Supabase Dashboard
2. Table Editor → `kantins`
3. Insert row baru:
   - `nama`: Nama kantin
   - `foto_url`: URL foto (Unsplash/etc)
   - `status`: 'buka' atau 'tutup'
   - `makan_pagi`: true/false
   - `makan_siang`: true/false
   - `snack`: true/false

### Mengubah Theme
Edit `src/app/globals.css`:
```css
:root {
  --background: #ffffff;  /* Background color */
  --foreground: #000000;  /* Text color */
}
```

### Mengubah Layout
Edit `src/components/KantinList.tsx`:
```tsx
// Desktop: 4 columns → change to 3
xl:grid-cols-4  →  xl:grid-cols-3

// Tablet: 2 columns → change to 3
sm:grid-cols-2  →  sm:grid-cols-3
```

### Menambah Field Baru
1. Update database schema di Supabase
2. Update type di `src/lib/supabase.ts`
3. Update UI di `src/components/KantinCard.tsx`

## 🐛 Troubleshooting

### Data tidak muncul
**Problem**: Kantin list kosong
**Solutions**:
1. Check console browser (F12)
2. Verify Supabase credentials di `.env.local`
3. Check RLS policy di Supabase
4. Verify tabel `kantins` exists
5. Insert sample data

### Styling tidak apply
**Problem**: Tailwind classes tidak bekerja
**Solutions**:
1. Restart dev server (`Ctrl+C`, `npm run dev`)
2. Clear `.next` folder
3. Check `globals.css` imported di `layout.tsx`

### Build error
**Problem**: TypeScript errors
**Solutions**:
1. Run `npm run build` to see errors
2. Check type definitions di `supabase.ts`
3. Verify all imports correct

## 📝 Best Practices

### Performance
- ✅ Use Next.js Image component (auto-optimization)
- ✅ Lazy load images (default in Next.js)
- ✅ Minimize re-renders (useEffect dependencies)
- ✅ Use React Server Components where possible

### Security
- ✅ Never commit `.env.local` (already in .gitignore)
- ✅ Use environment variables for secrets
- ✅ Enable RLS in Supabase
- ✅ Validate user input

### Code Quality
- ✅ TypeScript for type safety
- ✅ ESLint for code quality
- ✅ Consistent naming conventions
- ✅ Component reusability

## 🚀 Next Steps

### Immediate
1. ✅ Setup database di Supabase
2. ✅ Run development server
3. ✅ Test all features
4. ✅ Add your own kantins

### Short Term
- [ ] Add pagination (jika data banyak)
- [ ] Add kantin detail page
- [ ] Add admin panel (CRUD operations)
- [ ] Add authentication

### Long Term
- [ ] Add menu items per kantin
- [ ] Add reviews/ratings
- [ ] Add location/maps integration
- [ ] Add opening hours
- [ ] Mobile app version

## 📞 Support

Jika ada pertanyaan atau issue:
1. Check documentation files
2. Check Supabase docs: https://supabase.com/docs
3. Check Next.js docs: https://nextjs.org/docs
4. Check browser console for errors

## 🎉 You're Ready!

Server sudah running di: **http://localhost:3000**

Sekarang:
1. Setup database (ikuti `SETUP_DATABASE.md`)
2. Refresh browser
3. Nikmati aplikasi Anda!

**Happy Coding! 🚀**
