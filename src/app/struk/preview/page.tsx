'use client'

import { useState } from 'react'
import { Printer, Mail, CheckCircle, Clock, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Dummy data untuk preview
const dummyData = {
  pesanan: {
    id: 'preview-123',
    nomor_antrian: 42,
    nama_pemesan: 'John Doe',
    email: 'john@example.com',
    nomor_meja: '5',
    tipe_pesanan: 'dine_in',
    total_harga: 75000,
    status: 'selesai',
    catatan: '',
    created_at: new Date().toISOString(),
  },
  detailPesanan: [
    { id: '1', menu: { nama_menu: 'Nasi Goreng Spesial' }, jumlah: 2, harga_satuan: 25000, subtotal: 50000 },
    { id: '2', menu: { nama_menu: 'Es Teh Manis' }, jumlah: 2, harga_satuan: 5000, subtotal: 10000 },
    { id: '3', menu: { nama_menu: 'Kerupuk' }, jumlah: 3, harga_satuan: 5000, subtotal: 15000 },
  ],
  kantin: { nama_kantin: 'Kantin Pak Budi' },
  paymentInfo: { payment_type: 'qris', status: 'settlement' }
}

export default function StrukPreviewPage() {
  const router = useRouter()
  const [paymentStatus, setPaymentStatus] = useState<'settlement' | 'pending'>('settlement')
  
  const { pesanan, detailPesanan, kantin, paymentInfo } = dummyData

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-4">
      {/* Preview Notice */}
      <div className="max-w-md mx-auto mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
        <p className="text-yellow-800 text-sm font-medium">🔍 Mode Preview - Data Dummy</p>
        <div className="mt-2 flex justify-center gap-2">
          <button
            onClick={() => setPaymentStatus('settlement')}
            className={`px-3 py-1 text-xs rounded ${paymentStatus === 'settlement' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          >
            Lunas
          </button>
          <button
            onClick={() => setPaymentStatus('pending')}
            className={`px-3 py-1 text-xs rounded ${paymentStatus === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
          >
            Pending
          </button>
        </div>
      </div>

      {/* Header Actions */}
      <div className="max-w-md mx-auto mb-4 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Kembali</span>
          </button>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition"
            >
              <Printer className="h-4 w-4" />
              Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Receipt */}
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden font-mono text-sm">
          {/* Receipt Header */}
          <div className="text-center py-6 border-b-2 border-dashed border-gray-300">
            <h1 className="text-xl font-bold tracking-wide">E-KANTIN</h1>
            <p className="text-gray-600 text-xs mt-1">{kantin.nama_kantin}</p>
            <p className="text-gray-500 text-xs mt-1">Struk Pemesanan</p>
          </div>

          {/* Order Info */}
          <div className="px-4 py-4 border-b border-dashed border-gray-300">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">No. Antrian</span>
              <span className="font-bold text-lg">#{pesanan.nomor_antrian.toString().padStart(3, '0')}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Tanggal</span>
              <span>{formatDate(pesanan.created_at)}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Nama</span>
              <span>{pesanan.nama_pemesan}</span>
            </div>
            {pesanan.nomor_meja && (
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Meja</span>
                <span>{pesanan.nomor_meja}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Tipe</span>
              <span>{pesanan.tipe_pesanan === 'dine_in' ? 'Makan di Tempat' : 'Bawa Pulang'}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div className="px-4 py-3 border-b border-dashed border-gray-300">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Pembayaran</span>
              <div className="flex items-center gap-2">
                <span className="text-xs capitalize">QRIS</span>
                {paymentStatus === 'settlement' ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    <CheckCircle className="h-3 w-3" />
                    Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Items Header */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex text-xs text-gray-600 font-semibold">
              <span className="flex-1">Item</span>
              <span className="w-12 text-center">Qty</span>
              <span className="w-24 text-right">Harga</span>
            </div>
          </div>

          {/* Items List */}
          <div className="px-4 py-2 border-b border-dashed border-gray-300">
            {detailPesanan.map((item) => (
              <div key={item.id} className="flex py-2 text-xs border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{item.menu?.nama_menu}</p>
                  <p className="text-gray-500">@ {formatPrice(item.harga_satuan)}</p>
                </div>
                <span className="w-12 text-center">{item.jumlah}</span>
                <span className="w-24 text-right font-medium">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-4 py-3 border-b border-dashed border-gray-300">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatPrice(pesanan.total_harga)}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-600">Biaya Layanan</span>
              <span>Rp 0</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>TOTAL</span>
              <span>{formatPrice(pesanan.total_harga)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-6 px-4">
            <p className="text-xs text-gray-600 mb-1">Terima kasih atas pesanan Anda!</p>
            <p className="text-xs text-gray-500">Simpan struk ini sebagai bukti pembayaran</p>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">================================</p>
              <p className="text-xs text-gray-500 mt-2">E-Kantin © {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="max-w-md mx-auto mt-6 print:hidden">
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Beranda
          </button>
          <button
            onClick={() => router.push('/checkout')}
            className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium"
          >
            Pesan Lagi
          </button>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
