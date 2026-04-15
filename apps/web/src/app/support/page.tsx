'use client'

import { useState, useRef, type FormEvent } from 'react'
import Link from 'next/link'
import { apiExtra } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { MessageCircle, Ticket, Bot, Send, AlertCircle, CheckCircle, Headphones } from 'lucide-react'

type Tab = 'faq' | 'ticket' | 'chat'

interface ChatMessage {
  role: 'user' | 'bot'
  text: string
}

export default function SupportPage() {
  const { user, token } = useAuth()
  const [tab, setTab] = useState<Tab>('faq')

  // FAQ / chatbot
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: '¡Hola! Soy el asistente de soporte. ¿En qué puedo ayudarte hoy?' },
  ])
  const [faqInput, setFaqInput] = useState('')
  const [faqLoading, setFaqLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Ticket
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [ticketMsg, setTicketMsg] = useState('')
  const [ticketError, setTicketError] = useState('')
  const [ticketLoading, setTicketLoading] = useState(false)

  // Chat
  const [chatMsg, setChatMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  async function handleFAQ(e: FormEvent) {
    e.preventDefault()
    if (!token || !faqInput.trim()) return
    const question = faqInput.trim()
    setFaqInput('')
    setChatMessages((prev) => [...prev, { role: 'user', text: question }])
    setFaqLoading(true)
    try {
      const { answer, found } = await apiExtra.queryFAQ(question, token)
      const reply = found
        ? answer
        : 'No encontré una respuesta exacta para esa pregunta. Puedes crear un ticket o iniciar un chat con un agente.'
      setChatMessages((prev) => [...prev, { role: 'bot', text: reply }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'bot', text: 'Ocurrió un error al consultar. Intenta de nuevo.' }])
    } finally {
      setFaqLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  async function handleTicket(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setTicketLoading(true)
    setTicketMsg('')
    setTicketError('')
    try {
      const { ticket } = await apiExtra.createTicket({ subject, description }, token)
      setTicketMsg(`Ticket creado exitosamente (ID: ${ticket.id}). Estado: ${ticket.status}`)
      setSubject('')
      setDescription('')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setTicketError(e.message ?? 'Error al crear ticket')
    } finally {
      setTicketLoading(false)
    }
  }

  async function handleChat() {
    if (!token) return
    setChatLoading(true)
    setChatMsg('')
    try {
      const res = await apiExtra.startChat(token)
      if (res.agentAvailable) {
        setChatMsg(`Chat iniciado (ID: ${res.chatId}). Un agente se conectará en breve.`)
      } else {
        setChatMsg(`No hay agentes disponibles en este momento. Se creó un ticket automáticamente (ID: ${res.ticketId}). Te contactaremos pronto.`)
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      setChatMsg(e.message ?? 'Error al iniciar chat')
    } finally {
      setChatLoading(false)
    }
  }

  if (!user || !token) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <Headphones className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600">
          Debes{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            iniciar sesión
          </Link>{' '}
          para acceder al soporte.
        </p>
      </div>
    )
  }

  const tabs = [
    { id: 'faq' as Tab, label: 'Chatbot FAQ', icon: Bot },
    { id: 'ticket' as Tab, label: 'Crear ticket', icon: Ticket },
    { id: 'chat' as Tab, label: 'Chat en vivo', icon: MessageCircle },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Soporte</h1>
        <p className="text-gray-500 text-sm mt-1">Estamos aquí para ayudarte</p>
      </div>

      {user.role === 'SUPPORT_AGENT' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Link href="/support/agent" className="text-sm text-blue-700 font-medium hover:underline">
            → Ir al panel de agente
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* FAQ Chatbot */}
      {tab === 'faq' && (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: 420 }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3.5 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {faqLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3.5 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleFAQ} className="border-t border-gray-100 p-3 flex gap-2">
            <input
              value={faqInput}
              onChange={(e) => setFaqInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              required
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={faqLoading}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Ticket form */}
      {tab === 'ticket' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Crear ticket de soporte</h2>
          <form onSubmit={handleTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Describe brevemente el problema"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el problema con el mayor detalle posible..."
                required
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {ticketMsg && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {ticketMsg}
              </div>
            )}
            {ticketError && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {ticketError}
              </div>
            )}

            <button type="submit" disabled={ticketLoading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {ticketLoading ? 'Enviando...' : 'Crear ticket'}
            </button>
          </form>
        </div>
      )}

      {/* Live chat */}
      {tab === 'chat' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
              <MessageCircle className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Chat en vivo</h2>
            <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
              Conéctate con un agente de soporte en tiempo real. Si no hay agentes disponibles, se creará un ticket automáticamente.
            </p>
          </div>

          <button
            onClick={handleChat}
            disabled={chatLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {chatLoading ? 'Conectando...' : 'Iniciar chat'}
          </button>

          {chatMsg && (
            <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
              chatMsg.includes('No hay agentes')
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {chatMsg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
