'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiExtra, api, type PlatformStats, type FeedItem, type RankingEntry } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { Users, Building2, Coins, Trophy, ArrowRight, Rss } from 'lucide-react'

const ANNUAL_RANKINGS = [
  { key: 'USER_COINS_SOLD', label: 'Más Coins vendidos', type: 'user' as const },
  { key: 'USER_COINS_BALANCE', label: 'Mayor balance', type: 'user' as const },
  { key: 'USER_COINS_REDEEMED', label: 'Más Coins canjeados', type: 'user' as const },
  { key: 'BUSINESS_COINS_DONATED', label: 'Más Coins donados', type: 'business' as const },
  { key: 'BUSINESS_COINS_PURCHASED', label: 'Más Coins comprados', type: 'business' as const },
  { key: 'BUSINESS_COINS_REDEEMED_ON', label: 'Más Coins canjeados en productos', type: 'business' as const },
]

export default function HomePage() {
  const { user, token } = useAuth()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [feedMsg, setFeedMsg] = useState('')
  const [rankings, setRankings] = useState<Record<string, RankingEntry[]>>({})
  const [rankingsVisible, setRankingsVisible] = useState(false)
  const year = new Date().getFullYear()

  // Load stats (and poll every 5s)
  useEffect(() => {
    apiExtra.getStats().then(setStats).catch(() => {})
    const interval = setInterval(() => {
      apiExtra.getStats().then(setStats).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Load feed for authenticated users
  useEffect(() => {
    if (!token) return
    apiExtra.getFeed(token)
      .then(({ items, message }) => {
        setFeed(items ?? [])
        if (message) setFeedMsg(message)
      })
      .catch(() => {})
  }, [token])

  // Load annual rankings
  useEffect(() => {
    if (!token) return
    api.getRankings(ANNUAL_RANKINGS[0].key, year, token)
      .then(({ visible }) => {
        setRankingsVisible(visible)
        if (!visible) return
        Promise.all(
          ANNUAL_RANKINGS.map((r) =>
            api.getRankings(r.key, year, token)
              .then(({ rankings }) => ({ key: r.key, rankings }))
              .catch(() => ({ key: r.key, rankings: [] })),
          ),
        ).then((results) => {
          const map: Record<string, RankingEntry[]> = {}
          results.forEach(({ key, rankings }) => { map[key] = rankings })
          setRankings(map)
        })
      })
      .catch(() => {})
  }, [token, year])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center py-10 mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Krowdco</h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Conectamos negocios físicos con sus clientes a través de una economía de monedas virtuales innovadora.
        </p>
        {!user && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link href="/register"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Crear cuenta
            </Link>
            <Link href="/catalog"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              Ver catálogo
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full mb-2">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString('es-CO')}</div>
            <div className="text-sm text-gray-500 mt-0.5">Usuarios</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-green-100 rounded-full mb-2">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalActiveBusinesses.toLocaleString('es-CO')}</div>
            <div className="text-sm text-gray-500 mt-0.5">Negocios activos</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-yellow-100 rounded-full mb-2">
              <Coins className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.incentiveFundCoins.toLocaleString('es-CO')}</div>
            <div className="text-sm text-gray-500 mt-0.5">Coins en Incentive Fund</div>
          </div>
        </div>
      )}

      {/* Annual rankings preview */}
      {rankingsVisible && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-gray-900">Rankings Anuales {year}</h2>
            </div>
            <Link href="/rankings" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ANNUAL_RANKINGS.map((r) => {
              const entries = (rankings[r.key] ?? []).slice(0, 3)
              return (
                <div key={r.key} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{r.label}</div>
                  {entries.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin datos</p>
                  ) : (
                    <div className="space-y-1.5">
                      {entries.map((e, i) => (
                        <div key={e.id} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{['🥇', '🥈', '🥉'][i]}</span>
                          {r.type === 'user' ? (
                            <Link href={`/profile/${e.username ?? e.name}`} className="text-xs text-blue-600 hover:underline truncate flex-1">
                              {e.name}
                            </Link>
                          ) : (
                            <Link href={`/businesses/${e.id}`} className="text-xs text-blue-600 hover:underline truncate flex-1">
                              {e.name}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Feed for authenticated users */}
      {user && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Rss className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Tu feed</h2>
          </div>

          {feedMsg && feed.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Rss className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{feedMsg}</p>
              <Link href="/catalog" className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 hover:underline">
                Explorar negocios <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {feed.length > 0 && (
            <div className="space-y-3">
              {feed.map((item) => (
                <div key={`${item.type}-${item.id}`} className="bg-white rounded-xl border border-gray-200 p-4">
                  {item.type === 'PRODUCT' && item.product && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-blue-600 uppercase tracking-wide bg-blue-50 px-2 py-0.5 rounded-full">
                          Nuevo producto
                        </span>
                        <div className="font-semibold text-gray-900 mt-1.5">{item.product.name}</div>
                        {item.business && (
                          <div className="text-sm text-gray-500 mt-0.5">
                            <Link href={`/businesses/${item.business.id}`} className="text-blue-600 hover:underline">
                              {item.business.name}
                            </Link>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-blue-600 text-lg">{item.product.coinPrice}</div>
                        <div className="text-xs text-gray-400">Coins</div>
                      </div>
                    </div>
                  )}
                  {item.type === 'OFFER' && item.offer && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-purple-600 uppercase tracking-wide bg-purple-50 px-2 py-0.5 rounded-full">
                          Nueva oferta
                        </span>
                        <div className="font-semibold text-gray-900 mt-1.5">{item.offer.coinAmount} Coins</div>
                        {item.seller && (
                          <div className="text-sm text-gray-500 mt-0.5">
                            <Link href={`/profile/${item.seller.username}`} className="text-blue-600 hover:underline">
                              {item.seller.username}
                            </Link>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-purple-600 text-lg">{item.offer.diamondPricePerCoin}</div>
                        <div className="text-xs text-gray-400">Diamonds/Coin</div>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-300 mt-2">
                    {new Date(item.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
