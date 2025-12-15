/**
 * Brevo Email Service
 * Handles sending transactional emails via Brevo SMTP
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const { to, subject, html, text } = options

    // Use Brevo SMTP via API
    const apiKey = process.env.BREVO_API_KEY
    const senderEmail = process.env.BREVO_SENDER_EMAIL
    if (!apiKey || !senderEmail) {
      console.error('Brevo config missing:', { hasApiKey: !!apiKey, hasSenderEmail: !!senderEmail })
      return false
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || 'E-Kantin',
          email: senderEmail
        },
        to: [
          {
            email: to,
            name: to.split('@')[0]
          }
        ],
        subject: subject,
        htmlContent: html,
        textContent: text || html.replace(/<[^>]*>/g, '')
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Brevo API error:', response.status, error)
      console.error('Request details:', {
        senderEmail,
        toEmail: to,
        subject
      })
      return false
    }

    console.log('Email sent successfully to:', to)
    return true

  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

/**
 * Generate receipt email HTML template - Clean receipt style
 */
export function generateReceiptHTML(data: {
  pesananId: string
  nomorAntrian: number
  namaPemesan: string
  nomorMeja?: string
  tipePesanan?: string
  kantinName: string
  items: Array<{
    nama: string
    jumlah: number
    hargaSatuan: number
    subtotal: number
  }>
  totalHarga: number
  paymentMethod: string
  paymentStatus: string
  createdAt?: string
}): string {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const createdDate = data.createdAt 
    ? new Date(data.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: 'Courier New', Courier, monospace;">
  <div style="max-width: 400px; margin: 0 auto; background-color: white; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="text-align: center; padding: 24px 20px; border-bottom: 2px dashed #ddd;">
      <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 2px;">E-KANTIN</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${data.kantinName}</p>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #999;">Struk Pemesanan</p>
    </div>

    <!-- Order Info -->
    <div style="padding: 16px 20px; border-bottom: 1px dashed #ddd; font-size: 12px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 3px 0; color: #666;">No. Antrian</td>
          <td style="padding: 3px 0; text-align: right; font-weight: bold; font-size: 16px;">#${data.nomorAntrian.toString().padStart(3, '0')}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #666;">Tanggal</td>
          <td style="padding: 3px 0; text-align: right;">${createdDate}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #666;">Nama</td>
          <td style="padding: 3px 0; text-align: right;">${data.namaPemesan}</td>
        </tr>
        ${data.nomorMeja ? `<tr>
          <td style="padding: 3px 0; color: #666;">Meja</td>
          <td style="padding: 3px 0; text-align: right;">${data.nomorMeja}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 3px 0; color: #666;">Tipe</td>
          <td style="padding: 3px 0; text-align: right;">${data.tipePesanan === 'dine_in' ? 'Makan di Tempat' : 'Bawa Pulang'}</td>
        </tr>
      </table>
    </div>

    <!-- Payment Status -->
    <div style="padding: 12px 20px; border-bottom: 1px dashed #ddd; font-size: 12px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666;">Pembayaran</td>
          <td style="text-align: right;">
            <span style="margin-right: 8px;">${data.paymentMethod === 'cash' ? 'Cash' : 'QRIS'}</span>
            <span style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; ${data.paymentStatus === 'settlement' ? 'background-color: #d4edda; color: #155724;' : 'background-color: #fff3cd; color: #856404;'}">
              ${data.paymentStatus === 'settlement' ? '✓ Lunas' : '⏳ Pending'}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Items Header -->
    <div style="padding: 10px 20px; background-color: #f9f9f9; border-bottom: 1px solid #eee; font-size: 11px; font-weight: bold; color: #666;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 50%;">Item</td>
          <td style="width: 15%; text-align: center;">Qty</td>
          <td style="width: 35%; text-align: right;">Harga</td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div style="padding: 12px 20px; border-bottom: 2px dashed #ddd; font-size: 12px;">
      <table style="width: 100%; border-collapse: collapse;">
        ${data.items.map(item => `
        <tr>
          <td style="padding: 6px 0; width: 50%; vertical-align: top;">
            <div style="font-weight: 500;">${item.nama}</div>
            <div style="color: #999; font-size: 11px;">@ ${formatPrice(item.hargaSatuan)}</div>
          </td>
          <td style="padding: 6px 0; width: 15%; text-align: center; vertical-align: top;">${item.jumlah}</td>
          <td style="padding: 6px 0; width: 35%; text-align: right; vertical-align: top; font-weight: 500;">${formatPrice(item.subtotal)}</td>
        </tr>
        `).join('')}
      </table>
    </div>

    <!-- Total -->
    <div style="padding: 16px 20px; border-bottom: 2px dashed #ddd; font-size: 12px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 3px 0; color: #666;">Subtotal</td>
          <td style="padding: 3px 0; text-align: right;">${formatPrice(data.totalHarga)}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #666;">Biaya Layanan</td>
          <td style="padding: 3px 0; text-align: right;">Rp 0</td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 10px; border-top: 1px solid #eee;"></td>
        </tr>
        <tr>
          <td style="padding: 3px 0; font-weight: bold; font-size: 14px;">TOTAL</td>
          <td style="padding: 3px 0; text-align: right; font-weight: bold; font-size: 14px;">${formatPrice(data.totalHarga)}</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px; font-size: 11px; color: #666;">
      <p style="margin: 0 0 4px 0;">Terima kasih atas pesanan Anda!</p>
      <p style="margin: 0 0 12px 0; color: #999;">Simpan struk ini sebagai bukti pembayaran</p>
      <p style="margin: 0; color: #ccc;">================================</p>
      <p style="margin: 8px 0 0 0; color: #999;">E-Kantin © ${new Date().getFullYear()}</p>
    </div>

  </div>
</body>
</html>
  `
}
