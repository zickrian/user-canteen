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
        content: 'Halo! 👋 Saya asisten kuliner Anda di E-Kantin. Ada yang bisa saya bantu hari ini? 😊',
        timestamp: new Date().toISOString()
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen, messages.length])

  const generateAIResponse = async (userMessage: string): Promise<AIResponse> => {
    try {
      // Step 1: Understand context first
      let context: any = null
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
          context = contextData.context
          console.log('Understood context:', context)
        }
      } catch (error) {
        console.log('Failed to understand context, using default')
      }

      // Step 2: Filter menus based on context
      let filteredMenus = menus.filter(menu => menu.tersedia)
      
      if (context) {
        // Apply filters based on context
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
        if (context.sortBy === 'price_asc') {
          filteredMenus = filteredMenus.sort((a, b) => a.harga - b.harga)
        } else if (context.sortBy === 'price_desc') {
          filteredMenus = filteredMenus.sort((a, b) => b.harga - a.harga)
        } else if (context.sortBy === 'popularity') {
          filteredMenus = filteredMenus.sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0))
        }
      }

      // Limit results
      const resultCount = context?.requestedCount || 3
      const menuSuggestions = filteredMenus.slice(0, resultCount)

      // Step 3: Generate AI response
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          menus: menuSuggestions, // Only send filtered menus
          kantins: kantins,
          context: context
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.response) {
          return {
            message: data.response,
            menuSuggestions: menuSuggestions.length > 0 ? menuSuggestions : undefined,
            actionType: menuSuggestions.length > 0 ? 'recommendation' : 'general'
          }
        }
      }

      // Fallback response
      return {
        message: 'Maaf, saya tidak menemukan menu yang cocok. Coba kata kunci lain ya! 😊',
        actionType: 'general'
      }

    } catch (error) {
      console.error('Error generating AI response:', error)
      return {
        message: 'Maaf, terjadi kesalahan. Silakan coba lagi nanti ya! 😅',
        actionType: 'general'
      }
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
        content: 'Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi beberapa saat ya!',
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
      
      const newTotalItems = cart.totalItems + 1
      
      const confirmationMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ "${menu.nama_menu}" telah ditambahkan ke keranjang! 🛒 Total: ${newTotalItems} item. Ada lagi?`,
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
          <div key={menu.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-black flex items-center gap-1">
                  {menu.nama_menu}
                  {menu.total_sold && menu.total_sold > 10 && <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">🔥</span>}
                </h4>
                <p className="text-xs text-gray-600">{kantin?.nama_kantin}</p>
                <p className="text-sm font-bold text-black">{formatPrice(menu.harga)}</p>
              </div>
              <button
                onClick={() => handleAddToCart(menu)}
                className="bg-black text-white px-3 py-1 rounded text-xs hover:bg-gray-800 transition-colors flex items-center gap-1"
              >
                <span>+</span> Keranjang
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
          AI Assistant Kuliner 🍽️
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
          <span className="font-semibold">AI Assistant Kuliner 🍽️</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
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
            placeholder="Tanya AI Assistant Kuliner... 😊"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
