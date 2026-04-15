'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api, apiExtra, type BusinessProfile, type Product } from '../../../lib/api'
import { useAuth } from '../../../lib/auth-context'
import { MapPin, Globe, MessageCircle, ExternalLink, UserPlus, UserCheck, ShoppingCart, ArrowLeft } from 'lucide-react'

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>()
  const { user, token } = useAuth()
  const [business, setBusiness] = useState<BusinessProfile & { socialLinks?: Record<string, string>; coverPhoto?: string; profilePhoto?: string } | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [purchaseMsg, setPurchaseMsg] = useState('')
  const [followId, setFollowId] = useState<string | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [followMsg, setFollowMsg] = useState('')

  useEffect(() => {
    api
      .getBusiness(id, token ?? undefined)
      .then(({ business, products }) => {
        setBusiness(business as typeof business & { socialLinks?: Record<string, string>; coverPhoto?: string; profilePhoto?: string })
        setProducts(products.filter((p) => p.isActive))
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, token])

  async function handlePurchase(productId: string) {
    if (!token) return
    setPurchasing(productId)
    setPurchaseMsg('')
    try {
      await api.purchaseProduct(productId, token)
      setPurchaseMsg('¡Compra exitosa!')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setPurchaseMsg(e.message ?? 'Error al comprar')
    } finally {
      setPurchasing(null)
    }
  }

  async function handleFollow() {
    if (!token || !business) return
    setFollowLoading(true)
    setFollowMsg('')
    try {
      if (followId) {
        await apiExtra.unfollow(followId, token)
        setFollowId(null)
        setFollowMsg('Dejaste de seguir este negocio.')
      } else {
        const res = await apiExtra.followBusiness(business.id, token)
        setFollowId(res.followId)
        setFollowMsg('Ahora sigues este negocio.')
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

  if (notFound || !business) {
    return <p className="py-12 text-center text-gray-500">Negocio no encontrado.</p>
  }

  const lat = (business as { latitude?: number }).latitude
  const lng = (business as { longitude?: number }).longitude
  const hasCoords = lat != null && lng != null
  const socialLinks = business.socialLinks ?? {}

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/catalog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver al catálogo
      </Link>

      {/* Cover photo */}
      {business.coverPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={business.coverPhoto} alt="Portada" className="w-full h-48 object-cover rounded-xl mb-4" />
      ) : (
        <div className="w-full h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl mb-4" />
      )}

      {/* Business header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-4">
          {business.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.profilePhoto} alt={business.name} className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {business.name[0]}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{business.name}</h1>
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                  {business.category}
                </span>
              </div>
              {user && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-60 shrink-0 ${
                    followId ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {followId ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {followId ? 'Siguiendo' : 'Seguir'}
                </button>
              )}
            </div>

            {followMsg && <p className="text-xs text-gray-500 mt-1">{followMsg}</p>}

            <p className="text-gray-600 text-sm mt-2">{business.description}</p>

            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4 shrink-0" />
              {business.address}
            </div>
          </div>
        </div>

        {/* Social links */}
        {Object.values(socialLinks).some(Boolean) && (
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

      {/* Map */}
      {hasCoords && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Ubicación</h2>
          </div>
          <iframe
            title="Mapa del negocio"
            width="100%"
            height="280"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
          />
        </div>
      )}

      {/* Products */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Productos activos</h2>

        {purchaseMsg && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${purchaseMsg.includes('exitosa') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {purchaseMsg}
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay productos disponibles.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-gray-500 text-sm truncate">{p.description}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-blue-600">{p.coinPrice} Coins</span>
                  {token && (
                    <button
                      onClick={() => handlePurchase(p.id)}
                      disabled={purchasing === p.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {purchasing === p.id ? '...' : 'Comprar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
