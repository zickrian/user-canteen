/**
 * Test Cerebras API Connection
 */

import { NextResponse } from 'next/server'
import Cerebras from '@cerebras/cerebras_cloud_sdk'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiKey = process.env.CEREBRAS_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'CEREBRAS_API_KEY not configured'
      }, { status: 500 })
    }

    console.log('[TestCerebras] Testing Cerebras API...')
    console.log('[TestCerebras] API Key prefix:', apiKey.substring(0, 10) + '...')

    const cerebras = new Cerebras({ apiKey })

    const response = await cerebras.chat.completions.create({
      model: 'gpt-oss-120b',
      messages: [
        { role: 'user', content: 'Halo, jawab dengan singkat: apa itu nasi goreng?' }
      ],
      temperature: 0.5,
      max_completion_tokens: 100,
      stream: false
    });

    const text = (response as any).choices?.[0]?.message?.content
    console.log('[TestCerebras] Response:', text)

    return NextResponse.json({
      success: true,
      response: text,
      model: 'gpt-oss-120b'
    })
  } catch (error: any) {
    console.error('[TestCerebras] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
