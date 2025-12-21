'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, User, Mail, Phone, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/lib/supabase'

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/')
        return
      }
      fetchProfile()
    }
  }, [isAuthenticated, authLoading, router])

  const fetchProfile = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data) {
        setProfile(data)
        setFormData({
          full_name: data.full_name || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
        })
      } else {
        // Create profile if doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
          })
          .select()
          .single()

        if (createError) throw createError

        if (newProfile) {
          setProfile(newProfile)
          setFormData({
            full_name: newProfile.full_name || '',
            email: newProfile.email || '',
            phone: newProfile.phone || '',
          })
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Gagal memuat profil')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      // Validate phone number format (optional, but if provided should be valid)
      const phoneRegex = /^[0-9+\-\s()]*$/
      if (formData.phone && formData.phone.trim() && !phoneRegex.test(formData.phone)) {
        setError('Format nomor telepon tidak valid')
        setSaving(false)
        return
      }

      // Prepare update data
      const updateData: {
        full_name: string | null
        phone: string | null
        updated_at: string
      } = {
        full_name: formData.full_name.trim() || null,
        phone: formData.phone.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id)

      if (updateError) {
        console.error('Update error:', updateError)
        throw updateError
      }

      setSuccess(true)
      await fetchProfile() // Refresh profile

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      const errorMessage = err?.message || 'Gagal menyimpan perubahan'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">Memuat pengaturan...</p>
        </div>
      </div>
    )
  }

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-6 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center group-hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="font-medium text-sm">Kembali</span>
          </button>

          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-zinc-900">Pengaturan Akun</h1>
            <p className="text-zinc-500">Kelola informasi pribadi dan preferensi Anda.</p>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium text-sm">Profil berhasil diperbarui!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span className="font-medium text-sm">{error}</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
          {/* Avatar Section Header */}
          <div className="relative bg-zinc-50/50 p-8 border-b border-zinc-100 flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <div className="h-28 w-28 rounded-full p-1 bg-white border border-zinc-200 shadow-sm">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={formData.full_name || 'Profile'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-zinc-100 flex items-center justify-center">
                    <User className="h-10 w-10 text-zinc-400" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Foto Profil</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="full_name"
                  className="block text-sm font-bold text-zinc-700 mb-2"
                >
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <input
                    type="text"
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-zinc-900 placeholder:text-zinc-400 font-medium"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-bold text-zinc-700 mb-2"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    disabled
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl text-zinc-400 cursor-not-allowed font-medium"
                  />
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 ml-1">
                  Email tidak dapat diubah karena terhubung dengan akun Google.
                </p>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-bold text-zinc-700 mb-2"
                >
                  Nomor Telepon
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-zinc-900 placeholder:text-zinc-400 font-medium"
                    placeholder="Masukkan nomor telepon (opsional)"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-zinc-200">
              {/* Submit Button */}
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-zinc-200 active:scale-95"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition-all font-bold active:scale-95"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar Akun
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

