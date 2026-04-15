'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api, apiExtra, type PublicUser, type Offer } from '../../../lib/api'
import { useAuth } from '../../../lib/auth-context'
import { Globe, MessageCircle, UserPlus, UserCheck, Plus, ExternalLink, Lock, Pencil } from 'lucide-react'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: currentUser, token } = useAuth()

  const [profile, setProfile] = useState<PublicUser | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followId, setFollowId] = useState<string | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [followMsg, setFollowMsg] = useState('')
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null)

  const isOwnProfile = currentUser?.username === username

  useEffect(() => {
    async function load() {
      try {
        // Try profile endpoint first, fall back to search
        let found: PublicUser | null = null
        try {
          const res = await apiExtra.getUserProfile(username, token ?? undefined)
          found = res.user
          if (res.user.offers) setOffers(res.user.offers.filter((o) => o.status === 'ACTIVE' && o.visibility === 'PUBLICA'))
        } catch {
          if (token) {
            const { users } = await api.searchUsers(username, token)
            found = users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null
          }
        }

        if (!found) { setNotFound(true); return }
        setProfile(found)

        // Load follower counts
        if (token && found.id) {
          try {
            const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
            const res = await fetch(`${API}/api/users/${encodeURIComponent(username)}/counts`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) setCounts(await res.json())
          } catch { /* ignore */ }
        }

        // Load offers if not already loaded
        if (token && offers.length === 0) {
          try {
            const { offers: allOffers } = await api.listOffers(token)
            setOffers(allOffers.filter((o) => o.sellerId === found!.id && o.status === 'ACTIVE' && o.visibility === 'PUBLICA'))
          } catch { /* ignore */ }
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [username, token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFollow() {
    if (!token || !profile) return
    setFollowLoading(true)
    setFollowMsg('')
    try {
      if (followId) {
        await apiExtra.unfollow(followId, token)
        setFollowId(null)
        setFollowMsg('Dejaste de seguir a este usuario.')
      } else {
        const res = await apiExtra.followUser(profile.id, token)
        setFollowId(res.followId)
        setFollowMsg('Ahora sigues a este usuario.')
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFollowMsg(e.message ?? 'Error')
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!token) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <p className="text-gray-600">
          Debes{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            iniciar sesión
          </Link>{' '}
          para ver perfiles.
        </p>
      </div>
    )
  }

  if (notFound || !profile) {
    return <p className="py-12 text-center text-gray-500">Usuario no encontrado.</p>
  }

  const { socialLinks } = profile

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-4">
          {profile.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profilePhoto}
              alt={profile.username}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {profile.username[0].toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">@{profile.username}</h1>

            {/* Follower counts */}
            {counts && (
              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                <span><strong className="text-gray-900">{counts.followers}</strong> seguidores</span>
                <span><strong className="text-gray-900">{counts.following}</strong> siguiendo</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {isOwnProfile ? (
                <>
                  <Link
                    href="/profile/edit"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar perfil
                  </Link>
                  <Link
                    href="/business/create"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Crear negocio
                  </Link>
                </>
              ) : (
                token && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-60 ${
                      followId
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {followId ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {followId ? 'Siguiendo' : 'Seguir'}
                  </button>
                )
              )}
            </div>

            {followMsg && <p className="text-sm text-gray-500 mt-2">{followMsg}</p>}
          </div>
        </div>

        {/* Social links */}
        {socialLinks && Object.values(socialLinks).some(Boolean) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            {socialLinks.instagram && (
              <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Instagram
              </a>
            )}
            {socialLinks.facebook && (
              <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Facebook
              </a>
            )}
            {socialLinks.tiktok && (
              <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> TikTok
              </a>
            )}
            {socialLinks.whatsapp && (
              <a href={`https://wa.me/${socialLinks.whatsapp}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
            {socialLinks.website && (
              <a href={socialLinks.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Globe className="w-3.5 h-3.5" /> Sitio web
              </a>
            )}
          </div>
        )}
      </div>

      {/* Active offers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ofertas activas en el Marketplace</h2>
        {offers.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay ofertas activas.</p>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <div key={offer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    {offer.visibility === 'PRIVADA' && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="font-semibold text-gray-900">{offer.coinAmount} Coins</span>
                    <span className="text-gray-500 text-sm">a {offer.diamondPricePerCoin} Diamonds/Coin</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Vendedor:{' '}
                    <Link href={`/profile/${profile.username}`} className="text-blue-600 hover:underline">
                      {profile.username}
                    </Link>
                  </div>
                </div>
                <Link
                  href="/marketplace"
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ver
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
