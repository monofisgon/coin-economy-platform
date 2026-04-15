'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiExtra, type Transaction } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { Coins, Diamond, RefreshCw, ArrowDownLeft, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

const TX_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'DONATION', label: 'Donación' },
  { value: 'PRODUCT_PURCHASE', label: 'Compra de producto' },
  { value: 'MARKETPLACE_SALE', label: 'Venta en Marketplace' },
  { value: 'MARKETPLACE_PURCHASE', label: 'Compra en Marketplace' },
  { value: 'COIN_RECHARGE', label: 'Recarga de Coins' },
  { value: 'DIAMOND_RECHARGE', label: 'Recarga de Diamonds' },
  { value: 'DIAMOND_REFUND', label: 'Reembolso de Diamonds' },
  { value: 'INCENTIVE_DISTRIBUTION', label: 'Distribución de incentivo' },
  { value: 'OFFER_CANCEL_RETURN', label: 'Cancelación de oferta' },
]

const TX_LABELS: Record<string, string> = {
  DONATION: 'Donación',
  PRODUCT_PURCHASE: 'Compra de producto',
  MARKETPLACE_SALE: 'Venta en Marketplace',
  MARKETPLACE_PURCHASE: 'Compra en Marketplace',
  COIN_RECHARGE: 'Recarga de Coins',
  DIAMOND_RECHARGE: 'Recarga de Diamonds',
  DIAMOND_REFUND: 'Reembolso de Diamonds',
  INCENTIVE_DISTRIBUTION: 'Distribución de incentivo',
  OFFER_CANCEL_RETURN: 'Cancelación de oferta',
}

export default function WalletPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [balance, setBalance] = useState<{ coinBalance: number; diamondBalance: number } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!token || !user) { router.push('/login'); return }
    setWalletId(user.id)
  }, [token, user, router])

  useEffect(() => {
    if (!walletId || !token) return
    setLoading(true)
    Promise.all([
      api.getWalletBalance(walletId, token),
      api.getTransactions(walletId, token, { type: typeFilter || undefined, page, limit: 10 }),
    ])
      .then(([bal, txs]) => {
        setBalance(bal.balance)
        setTransactions(txs.transactions)
        setTotal(txs.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [walletId, token, typeFilter, page])

  async function handleRecharge() {
    if (!token) return
    setActionLoading(true)
    setActionMsg('')
    setActionError('')
    try {
      await apiExtra.rechargeDiamonds(token)
      setActionMsg('¡Recarga de Diamonds exitosa! Se acreditaron 70 Diamonds.')
      setWalletId((id) => id) // trigger reload
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message ?? 'Error al recargar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRefund() {
    if (!token) return
    setActionLoading(true)
    setActionMsg('')
    setActionError('')
    try {
      await apiExtra.refundDiamonds(token)
      setActionMsg('¡Reembolso de Diamonds exitoso!')
      setWalletId((id) => id)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message ?? 'Error al reembolsar')
    } finally {
      setActionLoading(false)
    }
  }

  if (!token) return null

  const totalPages = Math.ceil(total / 10)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Billetera</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Coins className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">Coins</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {balance ? balance.coinBalance.toLocaleString('es-CO') : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <Diamond className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">Diamonds</span>
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {balance ? balance.diamondBalance.toLocaleString('es-CO') : '—'}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleRecharge}
          disabled={actionLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Recargar Diamonds ($25.000 COP)
        </button>
        <button
          onClick={handleRefund}
          disabled={actionLoading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors font-medium"
        >
          <ArrowDownLeft className="w-4 h-4" />
          Reembolsar Diamonds
        </button>
      </div>

      {actionMsg && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Historial de transacciones</h2>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TX_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No hay transacciones.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{TX_LABELS[tx.type] ?? tx.type}</div>
                  {tx.description && <div className="text-xs text-gray-400 mt-0.5">{tx.description}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(tx.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{tx.amount} <span className="text-xs font-normal text-gray-500">{tx.currency}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 10 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{total} transacciones · Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
