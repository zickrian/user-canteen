'use client'

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { Cart, CartItem, Menu, Kantin } from '@/lib/supabase'

type CartAction =
  | { type: 'ADD_ITEM'; payload: { menu: Menu; kantin: Kantin } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { menuId: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: Cart }

interface CartContextType {
  cart: Cart
  addItem: (menu: Menu, kantin: Kantin) => void
  removeItem: (menuId: string) => void
  updateQuantity: (menuId: string, quantity: number) => void
  clearCart: () => void
  getItemCount: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function cartReducer(state: Cart, action: CartAction): Cart {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { menu, kantin } = action.payload
      const existingItemIndex = state.items.findIndex(item => item.menu.id === menu.id)

      let newItems: CartItem[]
      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        newItems = state.items.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        // Add new item
        newItems = [...state.items, { menu, quantity: 1, kantin }]
      }

      return calculateCartTotals({ ...state, items: newItems })
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.menu.id !== action.payload)
      return calculateCartTotals({ ...state, items: newItems })
    }

    case 'UPDATE_QUANTITY': {
      const { menuId, quantity } = action.payload
      if (quantity <= 0) {
        const newItems = state.items.filter(item => item.menu.id !== menuId)
        return calculateCartTotals({ ...state, items: newItems })
      }

      const newItems = state.items.map(item =>
        item.menu.id === menuId ? { ...item, quantity } : item
      )
      return calculateCartTotals({ ...state, items: newItems })
    }

    case 'CLEAR_CART':
      return { items: [], totalItems: 0, totalPrice: 0 }

    case 'LOAD_CART':
      return action.payload

    default:
      return state
  }
}

function calculateCartTotals(cart: Cart): Cart {
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.items.reduce((sum, item) => sum + (item.menu.harga * item.quantity), 0)

  return {
    ...cart,
    totalItems,
    totalPrice
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, {
    items: [],
    totalItems: 0,
    totalPrice: 0
  })

  // Load cart from session storage on mount
  useEffect(() => {
    const savedCart = sessionStorage.getItem('e-kantin-cart')
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart)
        dispatch({ type: 'LOAD_CART', payload: parsedCart })
      } catch (error) {
        console.error('Failed to load cart from session storage:', error)
      }
    }
  }, [])

  // Save cart to session storage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('e-kantin-cart', JSON.stringify(cart))
  }, [cart])

  const addItem = (menu: Menu, kantin: Kantin) => {
    dispatch({ type: 'ADD_ITEM', payload: { menu, kantin } })
  }

  const removeItem = (menuId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: menuId })
  }

  const updateQuantity = (menuId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { menuId, quantity } })
  }

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' })
  }

  const getItemCount = () => cart.totalItems

  const value: CartContextType = {
    cart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemCount
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}