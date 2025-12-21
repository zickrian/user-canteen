import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const kantinId = searchParams.get('kantin_id')

    if (!kantinId) {
      return NextResponse.json(
        { error: 'kantin_id wajib disediakan' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch all ratings for this kantin with user info
    const { data: ratings, error: ratingsError } = await supabase
      .from('rating_kantin')
      .select(`
        id,
        rating,
        komentar,
        created_at,
        updated_at,
        user_id,
        pesanan_id
      `)
      .eq('kantin_id', kantinId)
      .order('created_at', { ascending: false })

    if (ratingsError) {
      console.error('Error fetching ratings:', ratingsError)
      return NextResponse.json(
        { error: 'Gagal mengambil reviews' },
        { status: 500 }
      )
    }

    if (!ratings || ratings.length === 0) {
      return NextResponse.json({
        success: true,
        reviews: [],
        total: 0,
      })
    }

    // Fetch user profiles and order names for user names
    const userIds = [...new Set(ratings.map(r => r.user_id).filter(Boolean))]
    const pesananIds = ratings.map(r => r.pesanan_id).filter(Boolean)
    let userProfilesMap = new Map()
    let pesananList: any[] = []

    if (userIds.length > 0) {
      // Try to get from user_profiles first
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      if (profiles) {
        profiles.forEach(profile => {
          userProfilesMap.set(profile.id, profile.full_name || profile.email || 'Anonymous')
        })
      }

      // For users not in user_profiles, get name from pesanan
      if (pesananIds.length > 0) {
        const { data: pesananData } = await supabase
          .from('pesanan')
          .select('id, user_id, nama_pemesan, email')
          .in('id', pesananIds)

        if (pesananData) {
          pesananList = pesananData
          pesananData.forEach(pesanan => {
            if (pesanan.user_id && !userProfilesMap.has(pesanan.user_id)) {
              userProfilesMap.set(
                pesanan.user_id,
                pesanan.nama_pemesan || pesanan.email || 'Anonymous'
              )
            }
          })
        }
      }

      // Set Anonymous for any remaining users without names
      userIds.forEach(userId => {
        if (!userProfilesMap.has(userId)) {
          userProfilesMap.set(userId, 'Anonymous')
        }
      })
    }

    // Map ratings with user names
    const reviews = ratings.map(rating => {
      // Get name from map, or try to get from pesanan directly if not found
      let userName = userProfilesMap.get(rating.user_id) || 'Anonymous'
      
      // If still Anonymous, try to get from pesanan for this specific rating
      if (userName === 'Anonymous' && rating.pesanan_id && pesananList.length > 0) {
        const pesanan = pesananList.find(p => p.id === rating.pesanan_id)
        if (pesanan) {
          userName = pesanan.nama_pemesan || pesanan.email || 'Anonymous'
        }
      }
      
      return {
        id: rating.id,
        rating: rating.rating,
        komentar: rating.komentar,
        nama_pengirim: userName,
        created_at: rating.created_at,
        updated_at: rating.updated_at,
      }
    })

    return NextResponse.json({
      success: true,
      reviews,
      total: reviews.length,
    })
  } catch (error) {
    console.error('Reviews error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

