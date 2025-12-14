'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Send, X, User } from 'lucide-react'
import { Menu, Kantin } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'

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

  // Generate quick reply suggestions based on context
  const generateQuickReplies = (
    hasMenuData: boolean,
    lastUserMessage: string
  ): string[] => {
    const suggestions: string[] = []
    const lowerMsg = lastUserMessage.toLowerCase()

    // Contextual suggestions based on conversation
    if (hasMenuData) {
      // User got menu results
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
      // No menu results
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

    return suggestions.slice(0, 3)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

      const newQuickReplies = generateQuickReplies(
        !!(menuSuggestions && menuSuggestions.length > 0) || !!(comboSuggestions && comboSuggestions.length > 0),
        reply
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
    } catch (error) {
      console.error('Error generating AI response:', error)
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi beberapa saat ya! 😅',
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
      // Build conversation history from current messages (last 6 messages)
      const history = currentMessages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      console.log('Calling chat API with:', { message: userMessage, kantinId, historyLength: history.length })
      
      // Gunakan /api/chat untuk semua request (support dengan atau tanpa kantinId)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kantin_id: kantinId || undefined,
          message: userMessage,
          history: history.length > 0 ? history : undefined
        })
      });
      
      const data = await response.json();
      console.log('Chat API Response:', data)
      
      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.status}`);
      }
      
      return {
        message: data.reply || 'Maaf, saya tidak bisa memproses permintaan kamu saat ini.',
        menuData: data.menuData || null,
        comboData: data.comboData || null,
        toolUsed: data.debug?.intent || 'chat',
      }
    } catch (error: any) {
      console.error('Error generating AI response:', error)
      console.error('Error message:', error.message)
      
      // Return pesan error yang user-friendly
      return {
        message: `Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi beberapa saat ya! 😅`,
        menuData: null,
        comboData: null,
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

      // Generate quick reply suggestions
      const newQuickReplies = generateQuickReplies(
        !!(menuSuggestions && menuSuggestions.length > 0) || !!(comboSuggestions && comboSuggestions.length > 0),
        inputValue
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
    const makananKantin = (combo.makanan as any).kantin || kantin
    const minumanKantin = (combo.minuman as any).kantin || kantin
    
    if (makananKantin && minumanKantin) {
      addItem(combo.makanan, makananKantin)
      addItem(combo.minuman, minumanKantin)

      const confirmationMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Paket ${combo.makanan.nama_menu} + ${combo.minuman.nama_menu} ditambahkan! Total ${formatPrice(combo.total)}. Mau pesan lagi?`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, confirmationMessage])
    } else {
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
          className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-3 hover:border-orange-400 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              🍱 Paket {index + 1}
            </span>
            <span className="text-xs text-gray-500">
              Hemat Rp {combo.sisa.toLocaleString('id-ID')}
            </span>
          </div>
          
          <div className="space-y-2">
            {/* Makanan */}
            <div className="flex items-center gap-2 bg-white rounded p-2">
              <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                {combo.makanan.foto_menu ? (
                  <img src={combo.makanan.foto_menu} alt={combo.makanan.nama_menu} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🍚</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">{combo.makanan.nama_menu}</p>
                <p className="text-xs text-gray-500">{formatPrice(combo.makanan.harga)}</p>
              </div>
            </div>
            
            {/* Plus sign */}
            <div className="text-center text-gray-400 text-sm">+</div>
            
            {/* Minuman */}
            <div className="flex items-center gap-2 bg-white rounded p-2">
              <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                {combo.minuman.foto_menu ? (
                  <img src={combo.minuman.foto_menu} alt={combo.minuman.nama_menu} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🥤</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">{combo.minuman.nama_menu}</p>
                <p className="text-xs text-gray-500">{formatPrice(combo.minuman.harga)}</p>
              </div>
            </div>
          </div>
          
          {/* Total & Button */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-orange-200">
            <div>
              <p className="text-xs text-gray-500">Total Paket</p>
              <p className="text-sm font-bold text-black">{formatPrice(combo.total)}</p>
            </div>
            <button
              onClick={() => handleAddComboToCart(combo)}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
            >
              + Tambah Paket
            </button>
          </div>
        </div>
      ))}
    </div>
  )

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
            <div className="flex items-start gap-3">
              {/* Menu Image */}
              <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                {menu.foto_menu ? (
                  <img 
                    src={menu.foto_menu} 
                    alt={menu.nama_menu}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-black flex items-center gap-2 flex-wrap">
                  <span className="truncate">{menu.nama_menu}</span>
                  {(menu.total_sold && menu.total_sold > 10) ? (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                      🔥 Populer
                    </span>
                  ) : null}
                </h4>
                
                {isGlobalMenu && kantinInfo ? (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    🏪 {kantinInfo.nama_kantin}
                  </p>
                ) : null}
                
                {menu.deskripsi ? (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {menu.deskripsi}
                  </p>
                ) : null}
                
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <p className="text-sm font-bold text-black">
                    {formatPrice(menu.harga)}
                  </p>
                  {menu.kategori_menu && menu.kategori_menu.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {menu.kategori_menu.slice(0, 2).map((cat) => (
                        <span
                          key={`${menu.id}-${cat}`}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (isGlobalMenu && kantinInfo) {
                      // Untuk menu global, gunakan data kantin dari menu
                      handleAddToCart(menu, kantinInfo);
                    } else {
                      // Untuk menu kantin saat ini
                      handleAddToCart(menu);
                    }
                  }}
                  className="bg-black text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  + Tambah
                </button>
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
        className="fixed bottom-6 right-6 p-2 transition-transform duration-300 hover:scale-105 z-50"
        aria-label="Buka AI Assistant"
      >
        <div className="relative h-12 w-12">
          <Image
            src="/ang.png"
            alt="AI Assistant"
            fill
            sizes="48px"
            className="object-contain drop-shadow-lg"
            priority={false}
          />
        </div>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border-2 border-black">
      {/* Header */}
      <div className="bg-black text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7">
            <Image
              src="/ang.png"
              alt="AI Assistant"
              fill
              sizes="28px"
              className="object-contain"
            />
          </div>
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
              <div className="relative w-10 h-10 shrink-0">
                <Image
                  src="/ang.png"
                  alt="AI"
                  fill
                  sizes="40px"
                  className="object-contain"
                />
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
              {message.comboSuggestions &&
                message.comboSuggestions.length > 0 &&
                renderComboSuggestions(message.comboSuggestions)}
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
            <div className="relative w-8 h-8 shrink-0">
              <Image
                src="/ang.png"
                alt="AI"
                fill
                sizes="32px"
                className="object-contain"
              />
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

      {/* Quick Replies */}
      {quickReplies.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-2 flex-wrap">
            {quickReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => sendQuickReply(reply)}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-full hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-700"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

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
