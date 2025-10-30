'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, X, Bot, User, Sparkles } from 'lucide-react'
import { AIMessage, AIResponse, Menu, Kantin } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'

interface AIAssistantProps {
  menus?: Menu[]
  kantins?: Kantin[]
}

export default function AIAssistant({ menus = [], kantins = [] }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { addItem, cart } = useCart()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
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
        content: 'Halo! Saya AI Assistant E-Kantin. Saya bisa membantu Anda:\n\n🍽️ Merekomendasikan menu\n💰 Mencari menu berdasarkan budget\n🔍 Mencari menu dengan kata kunci\n📈 Menampilkan menu populer\n\nApa yang bisa saya bantu hari ini?',
        timestamp: new Date().toISOString()
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen, messages.length])

  // Extract context from user message (budget, keywords, etc)
  const extractContext = (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase()
    const context: {
      budget?: number
      keywords?: string[]
      excludeKeywords?: string[] // For allergies/exclusions
      category?: string
      foodType?: 'makanan' | 'minuman' // To distinguish food vs drink
      sortBy?: 'price_asc' | 'price_desc' | 'popularity' | 'rating'
      type?: 'best_seller' | 'cheapest' | 'most_expensive' | 'recommendation' | 'search' | 'top_kantin'
    } = {}

    // Extract budget
    const budgetMatch = lowerMessage.match(/(\d+)\s*(k|rb|ribu|ratusan ribu)/i) || lowerMessage.match(/budget\s*(\d+)/i)
    if (budgetMatch) {
      const amount = parseInt(budgetMatch[1])
      if (amount < 100) {
        context.budget = amount * 1000 // If "10k" or "10rb"
      } else {
        context.budget = amount
      }
    }

    // Detect query type
    if (lowerMessage.includes('termahal') || lowerMessage.includes('paling mahal') || lowerMessage.includes('mahal')) {
      context.type = 'most_expensive'
      context.sortBy = 'price_desc'
    } else if (lowerMessage.includes('best seller') || lowerMessage.includes('populer') || lowerMessage.includes('favorit') || lowerMessage.includes('paling sering') || lowerMessage.includes('terbanyak')) {
      context.type = 'best_seller'
      context.sortBy = 'popularity'
    } else if (lowerMessage.includes('termurah') || lowerMessage.includes('murah') || lowerMessage.includes('hemat')) {
      context.type = 'cheapest'
      context.sortBy = 'price_asc'
    } else if (lowerMessage.includes('rating tertinggi') || lowerMessage.includes('rating terbaik') || lowerMessage.includes('toko terbaik') || lowerMessage.includes('kantin terbaik')) {
      context.type = 'top_kantin'
      context.sortBy = 'rating'
    } else if (lowerMessage.includes('rekomendasi') || lowerMessage.includes('saran') || lowerMessage.includes('enak')) {
      context.type = 'recommendation'
      context.sortBy = 'popularity'
    } else {
      context.type = 'search'
      context.sortBy = 'popularity'
    }

    // Extract keywords (inclusion)
    const keywords = ['ayam', 'nasi', 'goreng', 'mie', 'soto', 'bakso', 'es', 'teh', 'kopi', 'jus', 'klepon', 'sate', 'bakpao', 'pempek', 'rendang', 'udang', 'ikan', 'daging', 'sayur', 'buah']
    const foundKeywords = keywords.filter(keyword => lowerMessage.includes(keyword))
    if (foundKeywords.length > 0) {
      context.keywords = foundKeywords
    }

    // Extract exclusion keywords (allergies, avoid)
    const allergyPatterns = [
      /alergi\s+([a-z\s]+)/i,
      /tidak\s+bisa\s+makan\s+([a-z\s]+)/i,
      /hindari\s+([a-z\s]+)/i,
      /jangan\s+([a-z\s]+)/i,
      /tidak\s+([a-z\s]+)/i
    ]
    
    const excludeKeywords: string[] = []
    allergyPatterns.forEach(pattern => {
      const match = lowerMessage.match(pattern)
      if (match) {
        const excludedItem = match[1].trim()
        // Extract keywords from excluded item
        keywords.forEach(keyword => {
          if (excludedItem.includes(keyword)) {
            excludeKeywords.push(keyword)
          }
        })
        // Also add the full excluded item if it's a known keyword
        if (keywords.some(k => excludedItem.includes(k) || k.includes(excludedItem))) {
          excludeKeywords.push(excludedItem)
        }
      }
    })
    
    // Also check for direct mentions like "udang" after "alergi" or "tidak bisa"
    if (lowerMessage.includes('alergi') || lowerMessage.includes('tidak bisa')) {
      keywords.forEach(keyword => {
        if (lowerMessage.includes(keyword) && (lowerMessage.includes('alergi') || lowerMessage.includes('tidak bisa'))) {
          const beforeKeyword = lowerMessage.substring(0, lowerMessage.indexOf(keyword))
          if (beforeKeyword.includes('alergi') || beforeKeyword.includes('tidak bisa')) {
            excludeKeywords.push(keyword)
          }
        }
      })
    }
    
    if (excludeKeywords.length > 0) {
      context.excludeKeywords = [...new Set(excludeKeywords)] // Remove duplicates
    }

    // Extract category
    const categories = ['makan pagi', 'makan siang', 'snack', 'minuman']
    const foundCategory = categories.find(category => lowerMessage.includes(category))
    if (foundCategory) {
      context.category = foundCategory
    }

    // Detect food type (makanan vs minuman)
    const makananKeywords = ['makanan', 'makan', 'nasi', 'ayam', 'sate', 'bakso', 'soto', 'rendang', 'mie', 'goreng']
    const minumanKeywords = ['minuman', 'minum', 'jus', 'es', 'teh', 'kopi', 'soda', 'sirup']
    
    if (makananKeywords.some(kw => lowerMessage.includes(kw)) && !minumanKeywords.some(kw => lowerMessage.includes(kw))) {
      context.foodType = 'makanan'
    } else if (minumanKeywords.some(kw => lowerMessage.includes(kw)) && !makananKeywords.some(kw => lowerMessage.includes(kw))) {
      context.foodType = 'minuman'
    }

    return context
  }

  // Filter menus based on context
  const filterMenusByContext = (menus: Menu[], context: ReturnType<typeof extractContext>): Menu[] => {
    let filtered = menus.filter(menu => menu.tersedia)

    // Filter by budget
    if (context.budget !== undefined) {
      filtered = filtered.filter(menu => menu.harga <= context.budget!)
    }

    // Filter out excluded keywords (allergies, avoid)
    if (context.excludeKeywords && context.excludeKeywords.length > 0) {
      filtered = filtered.filter(menu => {
        const menuName = menu.nama_menu.toLowerCase()
        const menuDesc = menu.deskripsi?.toLowerCase() || ''
        return !context.excludeKeywords!.some(exclude => 
          menuName.includes(exclude.toLowerCase()) || 
          menuDesc.includes(exclude.toLowerCase())
        )
      })
    }

    // Filter by keywords (inclusion)
    if (context.keywords && context.keywords.length > 0) {
      filtered = filtered.filter(menu =>
        context.keywords!.some(keyword =>
          menu.nama_menu.toLowerCase().includes(keyword) ||
          menu.deskripsi?.toLowerCase().includes(keyword)
        )
      )
    }

    // Filter by category
    if (context.category) {
      filtered = filtered.filter(menu => menu.kategori_menu?.includes(context.category!))
    }

    // Filter by food type (makanan vs minuman)
    if (context.foodType) {
      if (context.foodType === 'makanan') {
        // Exclude minuman categories
        const minumanCategories = ['minuman']
        filtered = filtered.filter(menu => 
          !menu.kategori_menu?.some(cat => minumanCategories.includes(cat.toLowerCase()))
        )
      } else if (context.foodType === 'minuman') {
        // Only include minuman categories
        const minumanCategories = ['minuman']
        filtered = filtered.filter(menu => 
          menu.kategori_menu?.some(cat => minumanCategories.includes(cat.toLowerCase()))
        )
      }
    }

    // Sort based on type/sortBy
    if (context.sortBy === 'price_desc' || context.type === 'most_expensive') {
      filtered = filtered.sort((a, b) => b.harga - a.harga)
    } else if (context.sortBy === 'price_asc' || context.type === 'cheapest') {
      filtered = filtered.sort((a, b) => a.harga - b.harga)
    } else if (context.sortBy === 'popularity' || context.type === 'best_seller' || context.type === 'recommendation') {
      filtered = filtered.sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0))
    }

    return filtered.slice(0, 3)
  }

  // Filter kantins by rating
  const filterKantinsByRating = (kantins: Kantin[]): Kantin[] => {
    // Filter only active and open kantins
    const activeKantins = kantins.filter(k => k.status === 'aktif' && k.buka_tutup)
    
    // Since we don't have rating data in the kantin type, we'll return them sorted by name
    // In a real scenario, you'd sort by avg_rating if available
    return activeKantins.slice(0, 3)
  }

  const generateAIResponse = async (userMessage: string): Promise<AIResponse> => {
    const lowerMessage = userMessage.toLowerCase()
    
    // Step 1: Use LLM to understand context first
    let understoodContext: any = null
    try {
      const contextResponse = await fetch('/api/gemini/understand-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage })
      })

      if (contextResponse.ok) {
        const contextData = await contextResponse.json()
        understoodContext = contextData.context
        console.log('Understood context from LLM:', understoodContext)
      }
    } catch (error) {
      console.log('Failed to understand context via LLM, using fallback extraction')
    }

    // Step 2: Use understood context if available, otherwise fallback to local extraction
    const context = understoodContext || extractContext(userMessage)
    
    // Step 3: Filter menus based on understood context
    let filteredMenus = menus.filter(menu => menu.tersedia)

    // Filter by specific kantins if mentioned
    if (context.specificKantins && context.specificKantins.length > 0) {
      const matchingKantinIds = kantins
        .filter(k => 
          context.specificKantins.some((name: string) => 
            k.nama_kantin.toLowerCase().includes(name.toLowerCase())
          )
        )
        .map(k => k.id)
      
      if (matchingKantinIds.length > 0) {
        filteredMenus = filteredMenus.filter(m => matchingKantinIds.includes(m.kantin_id))
      }
    }

    // Apply all other filters
    if (context.budget) {
      filteredMenus = filteredMenus.filter(menu => menu.harga <= context.budget)
    }

    if (context.excludeKeywords && context.excludeKeywords.length > 0) {
      filteredMenus = filteredMenus.filter(menu => {
        const menuName = menu.nama_menu.toLowerCase()
        const menuDesc = menu.deskripsi?.toLowerCase() || ''
        return !context.excludeKeywords.some((exclude: string) => 
          menuName.includes(exclude.toLowerCase()) || 
          menuDesc.includes(exclude.toLowerCase())
        )
      })
    }

    if (context.keywords && context.keywords.length > 0) {
      filteredMenus = filteredMenus.filter(menu =>
        context.keywords.some((keyword: string) =>
          menu.nama_menu.toLowerCase().includes(keyword.toLowerCase()) ||
          menu.deskripsi?.toLowerCase().includes(keyword.toLowerCase())
        )
      )
    }

    if (context.category) {
      filteredMenus = filteredMenus.filter(menu => 
        menu.kategori_menu?.some(cat => 
          cat.toLowerCase().includes(context.category.toLowerCase())
        )
      )
    }

    if (context.foodType === 'makanan') {
      filteredMenus = filteredMenus.filter(menu => 
        !menu.kategori_menu?.some(cat => cat.toLowerCase() === 'minuman')
      )
    } else if (context.foodType === 'minuman') {
      filteredMenus = filteredMenus.filter(menu => 
        menu.kategori_menu?.some(cat => cat.toLowerCase() === 'minuman')
      )
    }

    // Sort based on context
    if (context.sortBy === 'price_desc' || context.queryType === 'most_expensive') {
      filteredMenus = filteredMenus.sort((a, b) => b.harga - a.harga)
    } else if (context.sortBy === 'price_asc' || context.queryType === 'cheapest') {
      filteredMenus = filteredMenus.sort((a, b) => a.harga - b.harga)
    } else if (context.sortBy === 'popularity' || context.queryType === 'best_seller' || context.queryType === 'recommendation') {
      filteredMenus = filteredMenus.sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0))
    }

    // Group by kantin if multi-kantin query
    const menuSuggestions = context.multiKantin && filteredMenus.length > 0
      ? filteredMenus.slice(0, 6) // Show more menus if multi-kantin
      : filteredMenus.slice(0, 3)

    // Step 4: Generate AI response with context
    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          menus: menus,
          kantins: kantins,
          context: context // Pass context to help AI generate better response
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Map context type to actionType
        let actionType: 'recommendation' | 'search' | 'budget' | 'general' = 'general'
        if (context.budget) {
          actionType = 'budget'
        } else if (context.keywords && context.keywords.length > 0) {
          actionType = 'search'
        } else if (menuSuggestions.length > 0) {
          actionType = 'recommendation'
        }

        return {
          message: data.response,
          menuSuggestions: menuSuggestions.length > 0 ? menuSuggestions : undefined,
          actionType: menuSuggestions.length > 0 ? actionType : 'general'
        }
      }
    } catch (error) {
      console.log('AI API not available, using smart fallback')
    }

    // Smart fallback logic dengan respons natural - use filtered menus
    if (menuSuggestions.length > 0) {
      const menu = menuSuggestions[0]
      const kantin = kantins.find(k => k.id === menu.kantin_id)
      const kantinName = kantin?.nama_kantin || 'Kantin'
      
      if (context.queryType === 'most_expensive') {
        return {
          message: `Menu termahal ${context.multiKantin ? 'dari berbagai kantin' : `dari ${kantinName}`} adalah ${menu.nama_menu} dengan harga Rp${menu.harga.toLocaleString('id-ID')}! Ini menu premium dengan kualitas terbaik. Mau coba?`,
          menuSuggestions: menuSuggestions,
          actionType: 'recommendation'
        }
      }

      if (context.queryType === 'best_seller') {
        return {
          message: `Menu best seller ${context.multiKantin ? 'dari berbagai kantin' : `dari ${kantinName}`} adalah ${menu.nama_menu}! Sudah terjual ${menu.total_sold || 0} kali dan jadi favorit banyak pelanggan. Rasanya enak banget dan porsinya pas. Mau coba?`,
          menuSuggestions: menuSuggestions,
          actionType: 'recommendation'
        }
      }

      if (context.queryType === 'cheapest') {
        return {
          message: `Kalau cari yang termurah ${context.multiKantin ? 'dari berbagai kantin' : `dari ${kantinName}`}, ada ${menu.nama_menu} cuma Rp${menu.harga.toLocaleString('id-ID')}! Murah meriah tapi tetap enak dan mengenyangkan. Cocok buat kamu yang hemat. Mau ditambahkan ke keranjang?`,
          menuSuggestions: menuSuggestions,
          actionType: 'budget'
        }
      }

      if (context.budget) {
        return {
          message: `Dengan budget Rp${context.budget.toLocaleString('id-ID')}, saya rekomendasikan ${menu.nama_menu} dari ${kantinName} seharga Rp${menu.harga.toLocaleString('id-ID')}! Enak banget dan masih ada sisa budget kamu. Mau coba?`,
          menuSuggestions: menuSuggestions,
          actionType: 'budget'
        }
      }

      if (context.queryType === 'top_kantin') {
        const topKantins = filterKantinsByRating(kantins)
        if (topKantins.length > 0) {
          return {
            message: `Kantin-kantin terbaik kami adalah ${topKantins.map(k => k.nama_kantin).join(', ')}. Berikut beberapa menu favorit dari kantin tersebut!`,
            menuSuggestions: menuSuggestions,
            actionType: 'recommendation'
          }
        }
      }

      // Default recommendation
      return {
        message: `Banyak yang suka ${menu.nama_menu} ${context.multiKantin ? `dari ${kantinName}` : ''}! Ini menu andalan ${context.multiKantin ? 'kami' : kantinName} dan rasanya dijamin enak. Sudah terjual ${menu.total_sold || 0} porsi lho. Mau coba?`,
        menuSuggestions: menuSuggestions,
        actionType: 'recommendation'
      }
    }

    // Default friendly response
    return {
      message: 'Halo! Saya bisa bantu kamu cari menu yang enak. Coba tanya "menu best seller", "menu termurah", atau "menu dengan budget 20k". Ada yang bisa saya bantu?',
      actionType: 'general'
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const aiResponse = await generateAIResponse(inputValue)
      
      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date().toISOString(),
        menuSuggestions: aiResponse.menuSuggestions
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error generating AI response:', error)
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCart = (menu: Menu) => {
    const kantin = kantins.find(k => k.id === menu.kantin_id)
    if (kantin) {
      addItem(menu, kantin)
      
      // Calculate new total items (always adds 1 item to cart)
      const newTotalItems = cart.totalItems + 1
      
      // Add confirmation message
      const confirmationMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ "${menu.nama_menu}" telah ditambahkan ke keranjang! Total keranjang: ${newTotalItems} item.`,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, confirmationMessage])
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
        const kantin = kantins.find(k => k.id === menu.kantin_id)
        return (
          <div key={menu.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-black">{menu.nama_menu}</h4>
                <p className="text-xs text-gray-600">{kantin?.nama_kantin}</p>
                <p className="text-sm font-bold text-black">{formatPrice(menu.harga)}</p>
              </div>
              <button
                onClick={() => handleAddToCart(menu)}
                className="bg-black text-white px-3 py-1 rounded text-xs hover:bg-gray-800"
              >
                + Keranjang
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition-all duration-300 z-50 group"
      >
        <div className="relative">
          <MessageCircle className="h-6 w-6" />
          <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-yellow-400" />
        </div>
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          AI Assistant
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border-2 border-black md:w-96 md:h-[600px] md:max-h-none">
      {/* Header */}
      <div className="bg-black text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-800 rounded"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            
            <div className={`max-w-[80%] ${
              message.role === 'user' 
                ? 'bg-black text-white rounded-2xl rounded-tr-sm' 
                : 'bg-gray-100 text-black rounded-2xl rounded-tl-sm'
            } p-3`}>
              <p className="text-sm whitespace-pre-line">{message.content}</p>
              {message.menuSuggestions && renderMenuSuggestions(message.menuSuggestions)}
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
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Tanya AI Assistant..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
