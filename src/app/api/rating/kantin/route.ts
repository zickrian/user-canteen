import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    // Get auth token from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { pesanan_id, kantin_id, rating, komentar } = body

    // Validate input
    if (!pesanan_id || !kantin_id || !rating) {
      return NextResponse.json(
        { error: 'pesanan_id, kantin_id, dan rating wajib diisi' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating harus antara 1-5' },
        { status: 400 }
      )
    }

    // Verify that the order belongs to the user and is completed
    const { data: pesanan, error: pesananError } = await supabase
      .from('pesanan')
      .select('id, status, kantin_id, user_id')
      .eq('id', pesanan_id)
      .single()

    if (pesananError || !pesanan) {
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    if (pesanan.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke pesanan ini' },
        { status: 403 }
      )
    }

    if (pesanan.status !== 'selesai') {
      return NextResponse.json(
        { error: 'Rating hanya bisa diberikan untuk pesanan yang sudah selesai' },
        { status: 400 }
      )
    }

    if (pesanan.kantin_id !== kantin_id) {
      return NextResponse.json(
        { error: 'Kantin ID tidak sesuai dengan pesanan' },
        { status: 400 }
      )
    }

    // Check if user already rated this order
    const { data: existingRating } = await supabase
      .from('rating_kantin')
      .select('id')
      .eq('pesanan_id', pesanan_id)
      .eq('user_id', user.id)
      .single()

    let result
    if (existingRating) {
      // Update existing rating
      const { data, error } = await supabase
        .from('rating_kantin')
        .update({
          rating,
          komentar: komentar?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRating.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating rating:', error)
        return NextResponse.json(
          { error: 'Gagal mengupdate rating' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Insert new rating
      const { data, error } = await supabase
        .from('rating_kantin')
        .insert({
          pesanan_id,
          kantin_id,
          user_id: user.id,
          rating,
          komentar: komentar?.trim() || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting rating:', error)
        return NextResponse.json(
          { error: 'Gagal menyimpan rating' },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({
      success: true,
      rating: result,
    })
  } catch (error) {
    console.error('Rating error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const pesananId = searchParams.get('pesanan_id')

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    if (kantinId) {
      // Get average rating for kantin
      const { data, error } = await supabase.rpc('get_kantin_rating', {
        p_kantin_id: kantinId,
      })

      if (error) {
        console.error('Error fetching kantin rating:', error)
        return NextResponse.json(
          { error: 'Gagal mengambil rating' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        rating: data?.[0] || { avg_rating: 0, total_ratings: 0 },
      })
    }

    if (pesananId) {
      // Get auth token
      const authHeader = request.headers.get('authorization')
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const token = authHeader.replace('Bearer ', '')
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      })

      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Get user's rating for this order
      const { data, error } = await supabaseAuth
        .from('rating_kantin')
        .select('*')
        .eq('pesanan_id', pesananId)
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching rating:', error)
        return NextResponse.json(
          { error: 'Gagal mengambil rating' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        rating: data || null,
      })
    }

    return NextResponse.json(
      { error: 'kantin_id atau pesanan_id harus disediakan' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Rating GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

