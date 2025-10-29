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
  const { addItem } = useCart()

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

  const generateAIResponse = async (userMessage: string): Promise<AIResponse> => {
    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          menus: menus,
          kantins: kantins
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()
      
      // Try to extract menu suggestions from the response
      const mentionedMenus = menus.filter((menu: any) =>
        data.response.toLowerCase().includes(menu.nama_menu.toLowerCase())
      ).slice(0, 5)

      return {
        message: data.response,
        menuSuggestions: mentionedMenus.length > 0 ? mentionedMenus : undefined,
        actionType: mentionedMenus.length > 0 ? 'recommendation' : 'general'
      }

    } catch (error) {
      console.error('Error calling Gemini API:', error)
      
      // Fallback to simple logic if Gemini fails
      const lowerMessage = userMessage.toLowerCase()
      
      if (lowerMessage.includes('best seller') || lowerMessage.includes('populer')) {
        const popularMenus = menus
          .filter(menu => menu.tersedia)
          .sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0))
          .slice(0, 3)

        if (popularMenus.length > 0) {
          return {
            message: `Menu best seller kami adalah ${popularMenus[0].nama_menu}! Sudah terjual ${popularMenus[0].total_sold || 0} kali. Enak banget dan jadi favorit banyak orang. Mau coba?`,
            menuSuggestions: popularMenus,
            actionType: 'recommendation'
          }
        }
      }

      if (lowerMessage.includes('termurah') || lowerMessage.includes('murah')) {
        const cheapestMenus = menus
          .filter(menu => menu.tersedia)
          .sort((a, b) => a.harga - b.harga)
          .slice(0, 3)

        if (cheapestMenus.length > 0) {
          return {
            message: `Menu termurah kami adalah ${cheapestMenus[0].nama_menu} cuma Rp${cheapestMenus[0].harga.toLocaleString('id-ID')}! Murah meriah dan tetap enak. Mau ditambahkan ke keranjang?`,
            menuSuggestions: cheapestMenus,
            actionType: 'budget'
          }
        }
      }

      return {
        message: 'Maaf, saya sedang mengalami masalah koneksi. Silakan coba lagi ya!',
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
      
      // Add confirmation message
      const confirmationMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ "${menu.nama_menu}" telah ditambahkan ke keranjang! Total keranjang: ${useCart().cart.totalItems} item.`,
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
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center flex-shrink-0">
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
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
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