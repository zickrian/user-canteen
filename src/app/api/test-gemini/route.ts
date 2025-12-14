/**
 * Test Gemini API Connection
 */

import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'GEMINI_API_KEY not configured' 
      }, { status: 500 })
    }
    
    console.log('[TestGemini] Testing Gemini API...')
    console.log('[TestGemini] API Key prefix:', apiKey.substring(0, 10) + '...')
    
    const ai = new GoogleGenAI({ apiKey })
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: 'Halo, jawab dengan singkat: apa itu nasi goreng?',
      config: {
        temperature: 0.5,
        maxOutputTokens: 100,
      },
    })
    
    const text = response.text
    console.log('[TestGemini] Response:', text)
    
    return NextResponse.json({
      success: true,
      response: text,
      model: 'gemini-2.0-flash-lite'
    })
  } catch (error: any) {
    console.error('[TestGemini] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
