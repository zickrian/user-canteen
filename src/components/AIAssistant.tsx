'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Send, X } from 'lucide-react'
import { Menu, Kantin } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface ComboPackage {
  id: string
  type: 'combo'
  makanan: Menu
  minuman: Menu
  total: number
  sisa: number
}

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  menuSuggestions?: Menu[]
  comboSuggestions?: ComboPackage[]
  quickReplies?: string[]
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
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { addItem } = useCart()
  const { isAuthenticated } = useAuth()

  // Generate quick reply suggestions based on context (fallback if server doesn't provide)
  const generateQuickReplies = (
    hasMenuData: boolean,
    lastUserMessage: string,
    serverQuickReplies?: string[]
  ): string[] => {
    // Use server-provided quick replies if available
    if (serverQuickReplies && serverQuickReplies.length > 0) {
      return serverQuickReplies.slice(0, 6)
    }

    const suggestions: string[] = []
    const lowerMsg = lastUserMessage.toLowerCase()

    // Contextual suggestions based on conversation
    if (hasMenuData) {
      if (lowerMsg.includes('makan') || lowerMsg.includes('nasi') || lowerMsg.includes('goreng')) {
        suggestions.push('Minuman apa yang cocok?')
        suggestions.push('Ada yang lebih murah?')
        suggestions.push('Snack apa aja?')
      } else if (lowerMsg.includes('minum') || lowerMsg.includes('es') || lowerMsg.includes('jus')) {
        suggestions.push('Makanan apa yang enak?')
        suggestions.push('Snack ringan dong')
        suggestions.push('Paket makan siang')
      } else if (lowerMsg.includes('snack') || lowerMsg.includes('jajan')) {
        suggestions.push('Minuman dingin')
        suggestions.push('Menu makan siang')
        suggestions.push('Yang murah apa?')
      } else {
        suggestions.push('Ada minuman apa?')
        suggestions.push('Snack apa aja?')
        suggestions.push('Yang paling laris?')
      }
    } else {
      if (lowerMsg.includes('budget') || lowerMsg.includes('murah')) {
        suggestions.push('Budget 15rb')
        suggestions.push('Menu paling murah')
        suggestions.push('Paket hemat')
      } else {
        suggestions.push('Coba tanya yang lain')
        suggestions.push('Menu populer')
        suggestions.push('Minuman segar')
      }
    }

    return suggestions.slice(0, 6)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check authentication when modal opens (skip in development)
  useEffect(() => {
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (isOpen && !isAuthenticated && !isDevelopment && messages.length === 0) {
      // Show login message when opening chat without authentication (production only)
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Lakukan login untuk bisa memulai bercakapan dengan chatbot',
        timestamp: new Date().toISOString(),
      }])
    }
  }, [isOpen, isAuthenticated, messages.length])

  // No welcome message - chat starts empty, quick replies appear after first interaction

  // Send quick reply directly
  const sendQuickReply = async (reply: string) => {
    if (isLoading) return

    setQuickReplies([]) // Clear quick replies

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: reply,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      const aiResponse = await generateAIResponse(reply, updatedMessages)

      let menuSuggestions: Menu[] | undefined
      if (aiResponse.menuData && Array.isArray(aiResponse.menuData)) {
        menuSuggestions = aiResponse.menuData.slice(0, 10)
      }

      let comboSuggestions: ComboPackage[] | undefined
      if (aiResponse.comboData && Array.isArray(aiResponse.comboData)) {
        comboSuggestions = aiResponse.comboData
      }

      // Use server-provided quick replies or generate fallback
      const newQuickReplies = generateQuickReplies(
        !!(menuSuggestions && menuSuggestions.length > 0) || !!(comboSuggestions && comboSuggestions.length > 0),
        reply,
        aiResponse.quickReplies
      )
      setQuickReplies(newQuickReplies)

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date().toISOString(),
        menuSuggestions: menuSuggestions,
        comboSuggestions: comboSuggestions,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      console.error('Error generating AI response:', error)
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.message?.includes('login') || error.message === 'UNAUTHORIZED'
          ? 'Lakukan login untuk bisa memulai bercakapan dengan chatbot'
          : 'Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi beberapa saat ya! 😅',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
      setQuickReplies(['Coba lagi', 'Menu populer'])
    } finally {
      setIsLoading(false)
    }
  }

  const generateAIResponse = async (userMessage: string, currentMessages: AIMessage[]) => {
    try {
      // Check if we're in development mode
      const isDevelopment = process.env.NODE_ENV === 'development'
      
      // Get session token for authentication (skip in development)
      let authHeader = ''
      if (!isDevelopment) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('UNAUTHORIZED')
        }
        authHeader = `Bearer ${session.access_token}`
      } else {
        // In development, try to get session but don't fail if not available
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          authHeader = `Bearer ${session.access_token}`
        }
      }

      // Build conversation history from current messages (last 6 messages)
      const history = currentMessages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      console.log('Calling chat API with:', { message: userMessage, kantinId, historyLength: history.length })

      // Gunakan /api/chat untuk semua request (support dengan atau tanpa kantinId)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (authHeader) {
        headers['Authorization'] = authHeader
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kantin_id: kantinId || undefined,
          message: userMessage,
          history: history.length > 0 ? history : undefined
        })
      });

      const data = await response.json();
      console.log('Chat API Response:', data)

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401 || data.code === 'UNAUTHORIZED') {
          throw new Error('UNAUTHORIZED')
        }
        throw new Error(data.error || `API Error: ${response.status}`);
      }

      return {
        message: data.reply || 'Maaf, saya tidak bisa memproses permintaan kamu saat ini.',
        menuData: data.menuData || null,
        comboData: data.comboData || null,
        quickReplies: data.quickReplies || null,
        toolUsed: data.debug?.toolsCalled || data.debug?.intent || 'chat',
      }
    } catch (error: any) {
      console.error('Error generating AI response:', error)
      console.error('Error message:', error.message)

      // Check if it's an authentication error
      if (error.message === 'UNAUTHORIZED' || error.message?.includes('login')) {
        return {
          message: 'Lakukan login untuk bisa memulai bercakapan dengan chatbot',
          menuData: null,
          comboData: null,
          quickReplies: null,
          toolUsed: null,
        }
      }

      // Return pesan error yang user-friendly
      return {
        message: `Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi beberapa saat ya! 😅`,
        menuData: null,
        comboData: null,
        quickReplies: null,
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

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      const aiResponse = await generateAIResponse(inputValue, updatedMessages)

      // Parse menu data jika ada
      let menuSuggestions: Menu[] | undefined
      if (aiResponse.menuData && Array.isArray(aiResponse.menuData)) {
        menuSuggestions = aiResponse.menuData.slice(0, 10) // Limit to 10 menus
      }

      // Parse combo data jika ada
      let comboSuggestions: ComboPackage[] | undefined
      if (aiResponse.comboData && Array.isArray(aiResponse.comboData)) {
        comboSuggestions = aiResponse.comboData
      }

      // Use server-provided quick replies or generate fallback
      const newQuickReplies = generateQuickReplies(
        !!(menuSuggestions && menuSuggestions.length > 0) || !!(comboSuggestions && comboSuggestions.length > 0),
        inputValue,
        aiResponse.quickReplies
      )
      setQuickReplies(newQuickReplies)

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date().toISOString(),
        menuSuggestions: menuSuggestions,
        comboSuggestions: comboSuggestions,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      console.error('Error generating AI response:', error)
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.message?.includes('login') || error.message === 'UNAUTHORIZED'
          ? 'Lakukan login untuk bisa memulai bercakapan dengan chatbot'
          : 'Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi beberapa saat ya! 😅',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCart = (menu: Menu, menuKantin?: Kantin) => {
    // Gunakan kantin dari parameter (untuk menu global) atau kantin dari props
    const targetKantin = menuKantin || kantin

    if (targetKantin) {
      addItem(menu, targetKantin)

      const confirmationMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ ${menu.nama_menu} ditambahkan! Mau pesan lagi?`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, confirmationMessage])
    } else {
      // Jika tidak ada data kantin sama sekali
      const errorMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `⚠️ Gagal menambahkan. Coba lagi ya!`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleAddComboToCart = (combo: ComboPackage) => {
    // Build kantin object from menu data (API returns kantin_id and nama_kantin directly on menu)
    const makananData = combo.makanan as any
    const minumanData = combo.minuman as any
    
    // Try to get kantin from nested object first, then from flat fields, then fallback to props
    const makananKantin = makananData.kantin || (makananData.kantin_id ? {
      id: makananData.kantin_id,
      nama_kantin: makananData.nama_kantin || 'Unknown',
    } : kantin)
    
    const minumanKantin = minumanData.kantin || (minumanData.kantin_id ? {
      id: minumanData.kantin_id,
      nama_kantin: minumanData.nama_kantin || 'Unknown',
    } : kantin)

    if (makananKantin?.id && minumanKantin?.id) {
      addItem(combo.makanan, makananKantin as Kantin)
      addItem(combo.minuman, minumanKantin as Kantin)

      const confirmationMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Paket ${combo.makanan.nama_menu} + ${combo.minuman.nama_menu} ditambahkan! Total ${formatPrice(combo.total)}. Mau pesan lagi?`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, confirmationMessage])
    } else {
      console.error('Failed to add combo - missing kantin data:', { makananKantin, minumanKantin })
      const errorMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `⚠️ Gagal menambahkan paket. Coba lagi ya!`,
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

  const renderComboSuggestions = (comboSuggestions: ComboPackage[]) => (
    <div className="space-y-3 mt-3">
      {comboSuggestions.map((combo, index) => (
        <div
          key={combo.id}
          className="bg-white border-2 border-orange-100 rounded-xl p-3 hover:border-orange-300 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase tracking-wider">
              🍱 Paket {index + 1}
            </span>
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Hemat Rp {combo.sisa.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="space-y-2">
            {/* Makanan */}
            <div className="flex items-center gap-3 bg-zinc-50 rounded-lg p-2">
              <div className="w-10 h-10 bg-white rounded-md overflow-hidden flex-shrink-0 border border-zinc-100">
                {combo.makanan.foto_menu ? (
                  <img
                    src={combo.makanan.foto_menu}
                    alt={combo.makanan.nama_menu}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🍚</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{combo.makanan.nama_menu}</p>
                <p className="text-xs text-orange-600 font-medium">{formatPrice(combo.makanan.harga)}</p>
              </div>
            </div>

            {/* Plus sign */}
            <div className="text-center text-zinc-300 text-xs py-1">+</div>

            {/* Minuman */}
            <div className="flex items-center gap-3 bg-zinc-50 rounded-lg p-2">
              <div className="w-10 h-10 bg-white rounded-md overflow-hidden flex-shrink-0 border border-zinc-100">
                {combo.minuman.foto_menu ? (
                  <img
                    src={combo.minuman.foto_menu}
                    alt={combo.minuman.nama_menu}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🥤</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{combo.minuman.nama_menu}</p>
                <p className="text-xs text-orange-600 font-medium">{formatPrice(combo.minuman.harga)}</p>
              </div>
            </div>
          </div>

          {/* Total & Button */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-zinc-200">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Total Paket</p>
              <p className="text-sm font-bold text-zinc-900">{formatPrice(combo.total)}</p>
            </div>
            <button
              onClick={() => handleAddComboToCart(combo)}
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors shadow-sm"
            >
              + Ambil Paket
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  const renderMenuSuggestions = (menuSuggestions: Menu[]) => (
    <div className="space-y-2 mt-3">
      {menuSuggestions.map((menu) => {
        const kantinInfo = (menu as any).kantin || (menu as any).nama_kantin ? { nama_kantin: (menu as any).nama_kantin } : null;
        const isGlobalMenu = !kantin && kantinInfo;
        const avgRating = (menu as any).avg_rating;
        const ratingCount = (menu as any).rating_count;

        return (
          <div
            key={menu.id}
            className="bg-white border border-zinc-100 shadow-sm rounded-xl p-3 hover:border-orange-200 transition-colors group"
          >
            <div className="flex items-start gap-3">
              {/* Menu Image */}
              <div className="w-14 h-14 bg-zinc-50 rounded-lg flex-shrink-0 overflow-hidden border border-zinc-100">
                {menu.foto_menu ? (
                  <img
                    src={menu.foto_menu}
                    alt={menu.nama_menu}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2 flex-wrap">
                  <span className="truncate">{menu.nama_menu}</span>
                  {(menu.total_sold && menu.total_sold > 10) ? (
                    <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full whitespace-nowrap border border-orange-100 font-medium">
                      Popular
                    </span>
                  ) : null}
                </h4>

                {isGlobalMenu && kantinInfo ? (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    🏪 {kantinInfo.nama_kantin}
                  </p>
                ) : null}

                {menu.deskripsi ? (
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                    {menu.deskripsi}
                  </p>
                ) : null}

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <p className="text-sm font-bold text-orange-600">
                    {formatPrice(menu.harga)}
                  </p>
                  {avgRating > 0 && (
                    <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                      ⭐ {Number(avgRating).toFixed(1)} ({ratingCount})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (isGlobalMenu && kantinInfo) {
                      handleAddToCart(menu, kantinInfo as any);
                    } else {
                      handleAddToCart(menu);
                    }
                  }}
                  className="bg-zinc-900 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors whitespace-nowrap shadow-sm active:scale-95"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )

  const handleOpenChat = () => {
    setIsOpen(true)
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpenChat}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 p-1 transition-transform duration-300 hover:scale-105 z-50 group"
        aria-label="Buka AI Assistant"
      >
        <div className="relative h-12 w-12 sm:h-14 sm:w-14 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-zinc-100 overflow-hidden group-hover:border-orange-200 transition-colors">
          <Image
            src="/ang.png"
            alt="AI Assistant"
            fill
            sizes="56px"
            className="object-cover"
            priority={false}
          />
        </div>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 max-w-[calc(100vw-2rem)] h-[500px] sm:h-[600px] max-h-[85vh] sm:max-h-[80vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-zinc-900/20 z-50 flex flex-col border border-zinc-200 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="bg-zinc-900 text-white p-3 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative h-8 w-8 sm:h-9 sm:w-9 bg-white/10 rounded-full p-1 border border-white/20 overflow-hidden shrink-0">
            <Image
              src="/ang.png"
              alt="AI Assistant"
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs sm:text-sm tracking-wide truncate">AI Assistant</span>
            <span className="text-[9px] sm:text-[10px] text-zinc-400 uppercase tracking-wider font-medium truncate">
              {kantin?.nama_kantin || 'E-Kantin'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
          aria-label="Tutup AI Assistant"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400 hover:text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6 bg-zinc-50 relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 sm:gap-3 relative z-10 ${message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
          >
            {message.role === 'assistant' && (
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-white border border-zinc-100 overflow-hidden shadow-sm">
                <Image
                  src="/ang.png"
                  alt="AI"
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </div>
            )}

            <div
              className={`max-w-[85%] ${message.role === 'user'
                ? 'bg-zinc-900 text-white rounded-xl sm:rounded-2xl rounded-tr-sm shadow-md'
                : 'bg-white text-zinc-900 rounded-xl sm:rounded-2xl rounded-tl-sm border border-zinc-100 shadow-sm'
                } p-3 sm:p-4`}
            >
              <p className="text-xs sm:text-sm whitespace-pre-line leading-relaxed">
                {message.content}
              </p>
              {message.comboSuggestions &&
                message.comboSuggestions.length > 0 &&
                renderComboSuggestions(message.comboSuggestions)}
              {message.menuSuggestions &&
                message.menuSuggestions.length > 0 &&
                renderMenuSuggestions(message.menuSuggestions)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 sm:gap-3 justify-start relative z-10">
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-white border border-zinc-100 overflow-hidden shadow-sm">
              <Image
                src="/ang.png"
                alt="AI"
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl sm:rounded-2xl rounded-tl-sm p-3 sm:p-4 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {quickReplies.length > 0 && !isLoading && (
        <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-zinc-100 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {quickReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => sendQuickReply(reply)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold bg-zinc-50 border border-zinc-200 rounded-full hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors text-zinc-700 active:scale-95"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 sm:p-4 bg-white border-t border-zinc-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ketik pesan..."
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:bg-white transition-all text-xs sm:text-sm placeholder:text-zinc-400 text-zinc-900"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-zinc-900 text-white p-2.5 sm:p-3 rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm shrink-0"
            aria-label="Kirim pesan"
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
