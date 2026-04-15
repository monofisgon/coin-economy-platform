'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type RankingEntry } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { Trophy, Users, Building2, Lock } from 'lucide-react'

const USER_RANKINGS = [
  { key: 'USER_COINS_SOLD', label: 'Usuarios — Más Coins vendidos', metric: 'Coins vendidos' },
  { key: 'USER_COINS_BALANCE', label: 'Usuarios — Mayor balance de Coins', metric: 'Coins en wallet' },
  { key: 'USER_COINS_REDEEMED', label: 'Usuarios — Más Coins canjeados', metric: 'Coins canjeados' },
]

const BUSINESS_RANKINGS = [
  { key: 'BUSINESS_COINS_DONATED', label: 'Negocios — Más Coins donados', metric: 'Coins donados' },
  { key: 'BUSINESS_COINS_PURCHASED', label: 'Negocios — Más Coins comprados', metric: 'Coins comprados' },
  { key: 'BUSINESS_COINS_REDEEMED_ON', label: 'Negocios — Más Coins canjeados en sus productos', metric: 'Coins canjeados' },
]

const ALL_RANKINGS = [...USER_RANKINGS, ...BUSINESS_RANKINGS]

export default function RankingsPage() {
  const { token } = useAuth()
  const year = new Date().getFullYear()
  const [rankings, setRankings] = useState<Record<string, RankingEntry[]>>({})
  const [visible, setVisible] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }

    // Check visibility first
    api.getRankings(USER_RANKINGS[0].key, year, token)
      .then(({ visible: v }) => {
        setVisible(v)
        if (!v) { setLoading(false); return }

        // Load all 6 rankings in parallel
        Promise.all(
          ALL_RANKINGS.map((rt) =>
            api.getRankings(rt.key, year, token)
              .then(({ rankings }) => ({ key: rt.key, rankings }))
              .catch(() => ({ key: rt.key, rankings: [] })),
          ),
        ).then((results) => {
          const map: Record<string, RankingEntry[]> = {}
          results.forEach(({ key, rankings }) => { map[key] = rankings })
          setRankings(map)
        }).finally(() => setLoading(false))
      })
      .catch(() => { setVisible(false); setLoading(false) })
  }, [token, year])

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600">
          Debes{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            iniciar sesión
          </Link>{' '}
          para ver los rankings.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (visible === false) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Rankings {year}</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Los rankings estarán disponibles cuando la plataforma alcance{' '}
          <strong>500 negocios activos</strong>. ¡Sigue creciendo la comunidad!
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-7 h-7 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rankings {year}</h1>
          <p className="text-gray-500 text-sm">Top 10 usuarios y negocios más activos</p>
        </div>
      </div>

      {/* User rankings */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Rankings de Usuarios</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {USER_RANKINGS.map((rt) => (
            <RankingTable
              key={rt.key}
              title={rt.label.replace('Usuarios — ', '')}
              metricLabel={rt.metric}
              entries={rankings[rt.key] ?? []}
              type="user"
            />
          ))}
        </div>
      </div>

      {/* Business rankings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Rankings de Negocios</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BUSINESS_RANKINGS.map((rt) => (
            <RankingTable
              key={rt.key}
              title={rt.label.replace('Negocios — ', '')}
              metricLabel={rt.metric}
              entries={rankings[rt.key] ?? []}
              type="business"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function RankingTable({
  title,
  metricLabel,
  entries,
  type,
}: {
  title: string
  metricLabel: string
  entries: RankingEntry[]
  type: 'user' | 'business'
}) {
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-400 text-sm">Sin datos disponibles.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {entries.map((e, i) => (
            <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-base w-6 text-center shrink-0">
                {i < 3 ? medals[i] : <span className="text-xs text-gray-400 font-medium">{e.rank}</span>}
              </span>
              <div className="flex-1 min-w-0">
                {type === 'user' ? (
                  <Link href={`/profile/${e.username ?? e.name}`} className="text-sm font-medium text-blue-600 hover:underline truncate block">
                    {e.name}
                  </Link>
                ) : (
                  <Link href={`/businesses/${e.id}`} className="text-sm font-medium text-blue-600 hover:underline truncate block">
                    {e.name}
                  </Link>
                )}
              </div>
              <span className="text-sm font-bold text-gray-700 shrink-0">
                {e.metric.toLocaleString('es-CO')}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 py-2 border-t border-gray-50 bg-gray-50">
        <span className="text-xs text-gray-400">{metricLabel}</span>
      </div>
    </div>
  )
}
