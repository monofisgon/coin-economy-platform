'use client'

import Link from 'next/link'
import { useAuth } from '../lib/auth-context'
import { Coins, Wallet, User, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Nav() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/', label: 'Inicio' },
    { href: '/catalog', label: 'Catálogo' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/rankings', label: 'Rankings' },
    { href: '/support', label: 'Soporte' },
  ]

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 font-bold text-blue-600 text-lg shrink-0">
          <Coins className="w-5 h-5" />
          Krowdco
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 ml-auto">
          {user ? (
            <>
              <Link
                href="/wallet"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Wallet className="w-4 h-4" />
                Billetera
              </Link>
              <Link
                href={`/profile/${user.username}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <User className="w-4 h-4" />
                {user.username}
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden ml-auto p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/wallet" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100">
                Billetera
              </Link>
              <Link href={`/profile/${user.username}`} onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100">
                Mi perfil
              </Link>
              <button onClick={() => { logout(); setOpen(false) }} className="text-left px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50">
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100">
                Iniciar sesión
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-blue-600 font-medium hover:bg-blue-50">
                Registrarse
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
