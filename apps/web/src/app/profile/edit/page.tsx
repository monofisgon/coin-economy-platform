'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../lib/auth-context'
import { Camera } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export default function EditProfilePage() {
  const { user, token } = useAuth()
  const router = useRouter()

  const [name, setName] = useState(user?.name ?? '')
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto ?? '')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!token && !user) {
      router.push('/login')
    }
  }, [token, user, router])

  if (!token || !user) {
    return null
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingPhoto(true)
    setMsg('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API}/api/upload/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setProfilePhoto(`${API}${data.url}`)
      setMsg('Foto actualizada. Guarda los cambios para aplicarla.')
    } catch {
      setMsg('Error al subir la foto. Intenta de nuevo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name || undefined,
          profilePhoto: profilePhoto || undefined,
          socialLinks: {
            instagram: instagram || undefined,
            facebook: facebook || undefined,
            tiktok: tiktok || undefined,
            whatsapp: whatsapp || undefined,
            website: website || undefined,
          },
        }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      setMsg('¡Perfil actualizado correctamente!')
      setTimeout(() => router.push(`/profile/${user.username}`), 1200)
    } catch {
      setMsg('Error al actualizar el perfil.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar perfil</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

        {/* Foto de perfil */}
        <div className="flex flex-col items-center gap-2 pb-4 border-b border-gray-100">
          <div className="relative">
            {profilePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profilePhoto} alt="Foto de perfil"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                {user.username[0].toUpperCase()}
              </div>
            )}
            {/* Botón de cámara encima del círculo */}
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors border-2 border-white shadow">
              <Camera className="w-4 h-4 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </div>
          <p className="text-xs text-gray-400">
            {uploadingPhoto ? 'Subiendo foto...' : 'Haz clic en la cámara para cambiar tu foto'}
          </p>
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tu nombre" />
        </div>

        {/* Redes sociales */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
          <input type="url" value={instagram} onChange={e => setInstagram(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://instagram.com/tu_usuario" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
          <input type="url" value={facebook} onChange={e => setFacebook(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://facebook.com/tu_usuario" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
          <input type="url" value={tiktok} onChange={e => setTiktok(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://tiktok.com/@tu_usuario" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
          <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="573001234567" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
          <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://tu-sitio.com" />
        </div>

        {msg && (
          <p className={`text-sm font-medium ${msg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {msg}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading || uploadingPhoto}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
