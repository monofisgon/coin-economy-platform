'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth-context'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, RefreshCw } from 'lucide-react'

interface Ticket {
  id: string
  description: string
  status: string
  createdAt: string
  requester?: { username: string }
}

const STATUS_LABELS: Record<string, string> = {
  ABIERTO: 'Abierto',
  EN_PROGRESO: 'En progreso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
}

const STATUS_COLORS: Record<string, string> = {
  ABIERTO: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  EN_PROGRESO: 'bg-blue-50 text-blue-700 border-blue-200',
  RESUELTO: 'bg-green-50 text-green-700 border-green-200',
  CERRADO: 'bg-gray-50 text-gray-600 border-gray-200',
}

const NEXT_STATUS: Record<string, string> = {
  ABIERTO: 'EN_PROGRESO',
  EN_PROGRESO: 'RESUELTO',
  RESUELTO: 'CERRADO',
}

export default function AgentPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!user || !token) { router.push('/login'); return }
    if (user.role !== 'SUPPORT_AGENT' && user.role !== 'ADMIN') {
      router.push('/support')
      return
    }
    loadTickets()
  }, [user, token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTickets() {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setTickets(data.tickets ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleAdvance(ticketId: string, currentStatus: string) {
    if (!token) return
    const nextStatus = NEXT_STATUS[currentStatus]
    if (!nextStatus) return
    setUpdating(ticketId)
    setMsg('')
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      })
      setMsg(`Ticket actualizado a "${STATUS_LABELS[nextStatus]}".`)
      loadTickets()
    } catch {
      setMsg('Error al actualizar el ticket.')
    } finally {
      setUpdating(null)
    }
  }

  if (!user || user.role === 'USER') return null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/support" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Panel de Agente</h1>
        </div>
        <button onClick={loadTickets} className="ml-auto p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No hay tickets pendientes.</div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[ticket.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                    {ticket.requester && (
                      <span className="text-xs text-gray-400">@{ticket.requester.username}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{ticket.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(ticket.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {NEXT_STATUS[ticket.status] && (
                  <button
                    onClick={() => handleAdvance(ticket.id, ticket.status)}
                    disabled={updating === ticket.id}
                    className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium"
                  >
                    {updating === ticket.id ? '...' : `→ ${STATUS_LABELS[NEXT_STATUS[ticket.status]]}`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
