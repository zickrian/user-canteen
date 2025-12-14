/**
 * Test Database Connection
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('[TestDB] Testing database connection...')
    
    // Test 1: Get kantin count
    const { data: kantinData, error: kantinError } = await supabaseAdmin
      .from('kantin')
      .select('id, nama_kantin, status')
      .limit(5)
    
    if (kantinError) {
      console.error('[TestDB] Kantin error:', kantinError)
      return NextResponse.json({ 
        success: false, 
        error: 'Kantin query failed',
        details: kantinError.message 
      }, { status: 500 })
    }
    
    // Test 2: Get menu count
    const { data: menuData, error: menuError } = await supabaseAdmin
      .from('menu')
      .select('id, nama_menu, harga, kategori_menu, tersedia')
      .eq('tersedia', true)
      .limit(10)
    
    if (menuError) {
      console.error('[TestDB] Menu error:', menuError)
      return NextResponse.json({ 
        success: false, 
        error: 'Menu query failed',
        details: menuError.message 
      }, { status: 500 })
    }
    
    console.log('[TestDB] Success! Kantin:', kantinData?.length, 'Menu:', menuData?.length)
    
    return NextResponse.json({
      success: true,
      kantin: {
        count: kantinData?.length || 0,
        data: kantinData
      },
      menu: {
        count: menuData?.length || 0,
        data: menuData
      }
    })
  } catch (error: any) {
    console.error('[TestDB] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
