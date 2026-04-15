'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface AuthUser {
  id: string
  email: string
  username: string
  name?: string
  role: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (user: AuthUser, token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        setUser(parsed.user)
        setToken(parsed.token)
      }
    } catch {
      // ignore
    }
  }, [])

  function login(user: AuthUser, token: string) {
    setUser(user)
    setToken(token)
    localStorage.setItem('auth', JSON.stringify({ user, token }))
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('auth')
  }

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
