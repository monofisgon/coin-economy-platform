export interface FAQEntry {
  question: string
  answer: string
  keywords: string[]
}

export const FAQ_KNOWLEDGE_BASE: FAQEntry[] = [
  {
    question: '¿Cómo recargo Coins en mi negocio?',
    answer:
      'Para recargar Coins en tu negocio, ve a la sección "Billetera" de tu negocio y selecciona "Recargar Coins". El costo es $50.000 COP y recibirás 233 Coins. El 25% va a la plataforma y el 5% al Fondo de Incentivos.',
    keywords: ['recargar', 'coins', 'negocio', 'billetera', 'recarga', 'pago'],
  },
  {
    question: '¿Cómo recargo Diamonds?',
    answer:
      'Puedes recargar Diamonds desde la sección "Billetera". El costo es $25.000 COP y recibirás 70 Diamonds. Tanto usuarios como propietarios de negocios pueden recargar Diamonds.',
    keywords: ['recargar', 'diamonds', 'diamantes', 'billetera', 'recarga'],
  },
  {
    question: '¿Cómo puedo donar Coins a un usuario?',
    answer:
      'Como propietario de negocio, ve a "Donar Coins", busca al usuario por nombre de usuario o email, ingresa el monto y confirma. El negocio debe estar activo y tener saldo suficiente.',
    keywords: ['donar', 'donación', 'coins', 'usuario', 'recompensa', 'cliente'],
  },
  {
    question: '¿Cómo funciona el Marketplace?',
    answer:
      'En el Marketplace, los usuarios pueden publicar ofertas para vender Coins a cambio de Diamonds. Los compradores pueden aceptar ofertas usando sus Diamonds. Las ofertas pueden ser públicas o privadas (con código de acceso).',
    keywords: ['marketplace', 'mercado', 'oferta', 'vender', 'comprar', 'coins', 'diamonds', 'intercambio'],
  },
  {
    question: '¿Cómo solicito el reembolso de mis Diamonds?',
    answer:
      'Puedes solicitar el reembolso de Diamonds si tu saldo está entre 200 y 500 Diamonds. Ve a "Billetera" > "Reembolsar Diamonds". Recibirás $250 COP por cada Diamond reembolsado.',
    keywords: ['reembolso', 'diamonds', 'diamantes', 'devolver', 'dinero', 'cop', 'refund'],
  },
  {
    question: '¿Qué son los Rankings?',
    answer:
      'Los Rankings muestran los top 10 usuarios y negocios más activos de la plataforma. Se actualizan cada 7 días y están disponibles cuando hay 500 o más negocios activos. Incluyen categorías como más Coins donados, más Coins vendidos, etc.',
    keywords: ['ranking', 'clasificación', 'top', 'mejores', 'activos', 'tabla'],
  },
  {
    question: '¿Cómo creo un negocio?',
    answer:
      'Ve a tu perfil y selecciona "Crear negocio". Completa la información requerida (nombre, descripción, categoría, dirección) y realiza la recarga inicial de Coins para activar el negocio. Puedes tener hasta 3 negocios activos.',
    keywords: ['crear', 'negocio', 'registrar', 'empresa', 'tienda', 'activar'],
  },
  {
    question: '¿Cómo compro productos con Coins?',
    answer:
      'Navega al catálogo, selecciona tu ubicación para ver productos cercanos, elige el producto que deseas y confirma la compra. Los Coins se deducirán automáticamente de tu billetera.',
    keywords: ['comprar', 'producto', 'catálogo', 'coins', 'canjear', 'redimir'],
  },
  {
    question: '¿Cómo funciona el sistema de notificaciones?',
    answer:
      'Recibirás notificaciones en tiempo real cuando: recibas una donación de Coins, se complete una transacción en el Marketplace, alguien compre un producto de tu negocio, o cambie el estado de un ticket de soporte.',
    keywords: ['notificación', 'alerta', 'aviso', 'tiempo real', 'socket'],
  },
  {
    question: '¿Cómo sigo a otros usuarios o negocios?',
    answer:
      'Visita el perfil del usuario o negocio que deseas seguir y haz clic en "Seguir". Sus publicaciones aparecerán en tu Feed. Puedes dejar de seguir en cualquier momento desde el mismo perfil.',
    keywords: ['seguir', 'follow', 'feed', 'publicaciones', 'suscribir', 'unfollow'],
  },
]

export interface FAQResult {
  question: string
  answer: string
}

/**
 * Search the FAQ knowledge base by keywords.
 * Returns the best matching entry or null if no match found.
 */
export function searchFAQ(query: string): FAQResult | null {
  const normalizedQuery = query.toLowerCase()
  const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 2)

  let bestMatch: FAQEntry | null = null
  let bestScore = 0

  for (const entry of FAQ_KNOWLEDGE_BASE) {
    let score = 0
    for (const keyword of entry.keywords) {
      if (normalizedQuery.includes(keyword)) {
        score += 2
      }
      for (const word of words) {
        if (keyword.includes(word) || word.includes(keyword)) {
          score += 1
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = entry
    }
  }

  if (bestScore === 0) return null

  return bestMatch ? { question: bestMatch.question, answer: bestMatch.answer } : null
}
