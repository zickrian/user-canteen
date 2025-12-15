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
      console.error('Brevo API error:', error)
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
 * Generate receipt email HTML template
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
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background-color: #000;
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .header p {
          margin: 5px 0 0 0;
          opacity: 0.8;
        }
        .content {
          padding: 30px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-weight: bold;
          font-size: 14px;
          color: #333;
          margin-bottom: 10px;
          text-transform: uppercase;
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 5px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .info-label {
          color: #666;
        }
        .info-value {
          color: #000;
          font-weight: 500;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        .items-table th {
          background-color: #f9f9f9;
          border-bottom: 2px solid #e0e0e0;
          padding: 10px;
          text-align: left;
          font-size: 12px;
          font-weight: bold;
          color: #333;
        }
        .items-table td {
          border-bottom: 1px solid #f0f0f0;
          padding: 10px;
          font-size: 13px;
        }
        .items-table tr:last-child td {
          border-bottom: none;
        }
        .qty-col {
          text-align: center;
        }
        .price-col {
          text-align: right;
        }
        .total-section {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          margin-top: 15px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .total-row.grand-total {
          font-size: 18px;
          font-weight: bold;
          color: #000;
          border-top: 2px solid #e0e0e0;
          padding-top: 10px;
          margin-top: 10px;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-top: 5px;
        }
        .status-pending {
          background-color: #fff3cd;
          color: #856404;
        }
        .status-settlement {
          background-color: #d4edda;
          color: #155724;
        }
        .footer {
          background-color: #f5f5f5;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #e0e0e0;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Struk Pesanan</h1>
          <p>${data.kantinName}</p>
        </div>
        
        <div class="content">
          <!-- Status Section -->
          <div class="section">
            <div class="section-title">Status Pembayaran</div>
            <span class="status-badge ${data.paymentStatus === 'settlement' ? 'status-settlement' : 'status-pending'}">
              ${data.paymentStatus === 'settlement' ? '✓ Sudah Dibayar' : '⏳ Menunggu Pembayaran'}
            </span>
          </div>

          <!-- Order Info -->
          <div class="section">
            <div class="section-title">Informasi Pesanan</div>
            <div class="info-row">
              <span class="info-label">ID Pesanan:</span>
              <span class="info-value">${data.pesananId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nomor Antrian:</span>
              <span class="info-value">${data.nomorAntrian}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nama Pemesan:</span>
              <span class="info-value">${data.namaPemesan}</span>
            </div>
            ${data.nomorMeja ? `<div class="info-row">
              <span class="info-label">Nomor Meja:</span>
              <span class="info-value">${data.nomorMeja}</span>
            </div>` : ''}
            ${data.tipePesanan ? `<div class="info-row">
              <span class="info-label">Tipe Pesanan:</span>
              <span class="info-value">${data.tipePesanan === 'dine_in' ? 'Makan di Tempat' : 'Bawa Pulang'}</span>
            </div>` : ''}
            <div class="info-row">
              <span class="info-label">Metode Pembayaran:</span>
              <span class="info-value">${data.paymentMethod === 'cash' ? 'Cash' : 'QRIS'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tanggal & Waktu:</span>
              <span class="info-value">${createdDate}</span>
            </div>
          </div>

          <!-- Items -->
          <div class="section">
            <div class="section-title">Detail Menu</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Menu</th>
                  <th class="qty-col">Qty</th>
                  <th class="price-col">Harga</th>
                  <th class="price-col">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map(item => `
                  <tr>
                    <td>${item.nama}</td>
                    <td class="qty-col">${item.jumlah}</td>
                    <td class="price-col">${formatPrice(item.hargaSatuan)}</td>
                    <td class="price-col">${formatPrice(item.subtotal)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Total -->
          <div class="total-section">
            <div class="total-row grand-total">
              <span>Total Pembayaran:</span>
              <span>${formatPrice(data.totalHarga)}</span>
            </div>
          </div>

          <!-- Footer Message -->
          <div class="section" style="text-align: center; color: #666; font-size: 13px; margin-top: 30px;">
            <p>Terima kasih telah memesan di ${data.kantinName}</p>
            <p>Struk ini adalah bukti pemesanan Anda. Simpan untuk keperluan referensi.</p>
          </div>
        </div>

        <div class="footer">
          <p><strong>E-Kantin</strong></p>
          <p>Sistem Pemesanan Makanan Online</p>
          <p>© ${new Date().getFullYear()} E-Kantin. Semua hak dilindungi.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
