'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, X, Bot, User, Sparkles } from 'lucide-react'
import { Menu, Kantin } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  menuSuggestions?: Menu[]
}

interface AIAssistantProps {
  kantinId?: string
  kantin?: Kantin
}

export default function AIAssistant({ kantinId, kantin }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { addItem } = useCart()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Add welcome message when first opened
    if (isOpen && messages.length === 0) {
      const welcomeMessage: AIMessage = {
        id: '1',
        role: 'assistant',
        content: `Halo! 👋 Saya asisten kuliner ${kantin?.nama_kantin || 'E-Kantin'}. Ada yang bisa saya bantu hari ini? 😊`,
        timestamp: new Date().toISOString(),
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen, messages.length, kantin?.nama_kantin])

  const generateAIResponse = async (userMessage: string) => {
    try {
      console.log('Calling AI action with:', { message: userMessage, kantinId })
      
      // Import server action dynamically
      const { generateContent } = await import('@/app/actions');
      
      // Call the server action directly
      const data = await generateContent(userMessage, kantinId || '');
      
      console.log('AI Response data:', data)
      
      if (data.error) {
        throw new Error(data.details || data.error);
      }
      
      return {
        message: data.response || 'Maaf, saya tidak bisa memproses permintaan kamu saat ini.',
        menuData: data.menuData || null,
        toolUsed: data.toolUsed || null,
      }
    } catch (error: any) {
      console.error('Error generating AI response:', error)
      console.error('Error message:', error.message)
      return {
        message: `Maaf, terjadi kesalahan: ${error.message || 'Silakan coba lagi'} 😅`,
        menuData: null,
        toolUsed: null,
      }
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const aiResponse = await generateAIResponse(inputValue)

      // Parse menu data jika ada
      let menuSuggestions: Menu[] | undefined
      if (aiResponse.menuData && Array.isArray(aiResponse.menuData)) {
        menuSuggestions = aiResponse.menuData.slice(0, 10) // Limit to 10 menus
      }

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date().toISOString(),
        menuSuggestions: menuSuggestions,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error generating AI response:', error)
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi beberapa saat ya! 😅',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCart = (menu: Menu) => {
    if (kantin) {
      addItem(menu, kantin)

      const confirmationMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ "${menu.nama_menu}" telah ditambahkan ke keranjang! 🛒 Ada yang mau ditambah lagi?`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, confirmationMessage])
    } else {
      // Jika ini adalah menu global, beri tahu user untuk memilih kantin terlebih dahulu
      const errorMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `⚠️ Menu "${menu.nama_menu}" dari kantin "${(menu as any).kantin?.nama_kantin || 'Unknown'}" tidak bisa ditambahkan langsung. Silakan buka halaman kantin terlebih dahulu untuk melakukan pemesanan.`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const renderMenuSuggestions = (menuSuggestions: Menu[]) => (
    <div className="space-y-2 mt-3">
      {menuSuggestions.map((menu) => {
        const kantinInfo = (menu as any).kantin;
        const isGlobalMenu = !kantin && kantinInfo;
        
        return (
          <div
            key={menu.id}
            className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-black transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-black flex items-center gap-2 flex-wrap">
                  <span className="truncate">{menu.nama_menu}</span>
                  {menu.total_sold && menu.total_sold > 10 && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                      🔥 Populer
                    </span>
                  )}
                </h4>
                
                {isGlobalMenu && kantinInfo && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    🏪 {kantinInfo.nama_kantin}
                  </p>
                )}
                
                {menu.deskripsi && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {menu.deskripsi}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <p className="text-sm font-bold text-black">
                    {formatPrice(menu.harga)}
                  </p>
                  {menu.kategori_menu && menu.kategori_menu.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {menu.kategori_menu.slice(0, 2).map((cat, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {isGlobalMenu ? (
                  <button
                    onClick={() => {
                      window.location.href = `/kantin/${kantinInfo.id}`;
                    }}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Lihat Kantin
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddToCart(menu)}
                    className="bg-black text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors whitespace-nowrap"
                  >
                    <span>+</span> Tambah
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition-all duration-300 z-50 group"
        aria-label="Buka AI Assistant"
      >
        <div className="relative">
          <MessageCircle className="h-6 w-6" />
          <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-yellow-400" />
        </div>
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          AI Assistant Kuliner 🍽️
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border-2 border-black">
      {/* Header */}
      <div className="bg-black text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm">AI Assistant Kuliner</span>
            <span className="text-xs text-gray-300">
              {kantin?.nama_kantin || 'E-Kantin'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          aria-label="Tutup AI Assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-black text-white rounded-2xl rounded-tr-sm'
                  : 'bg-white text-black rounded-2xl rounded-tl-sm border border-gray-200'
              } p-3 shadow-sm`}
            >
              <p className="text-sm whitespace-pre-line leading-relaxed">
                {message.content}
              </p>
              {message.menuSuggestions &&
                message.menuSuggestions.length > 0 &&
                renderMenuSuggestions(message.menuSuggestions)}
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-3 shadow-sm">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Tanya AI tentang menu... 😊"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Kirim pesan"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
