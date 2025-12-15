import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/brevo'

export async function GET() {
  const testEmail = process.env.BREVO_SENDER_EMAIL // kirim ke diri sendiri untuk test

  if (!testEmail) {
    return NextResponse.json({ error: 'BREVO_SENDER_EMAIL not set' }, { status: 500 })
  }

  console.log('Testing email with config:', {
    apiKey: process.env.BREVO_API_KEY ? 'SET (length: ' + process.env.BREVO_API_KEY.length + ')' : 'NOT SET',
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME
  })

  const result = await sendEmail({
    to: testEmail,
    subject: 'Test Email dari E-Kantin',
    html: '<h1>Test Email</h1><p>Jika kamu menerima email ini, konfigurasi Brevo sudah benar!</p>'
  })

  return NextResponse.json({ 
    success: result,
    message: result ? 'Email terkirim! Cek inbox.' : 'Gagal kirim email. Cek terminal untuk error.'
  })
}
