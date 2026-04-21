import { ReactNode } from 'react'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'

interface AlertProps {
  type?: 'error' | 'success' | 'info'
  children: ReactNode
}

export function Alert({ type = 'info', children }: AlertProps) {
  const configs = {
    error: {
      icon: AlertCircle,
      classes: 'bg-red-50 border-red-200 text-red-700'
    },
    success: {
      icon: CheckCircle,
      classes: 'bg-green-50 border-green-200 text-green-700'
    },
    info: {
      icon: Info,
      classes: 'bg-blue-50 border-blue-200 text-blue-700'
    }
  }
  
  const { icon: Icon, classes } = configs[type]
  
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm ${classes}`}>
      <Icon className="w-4 h-4 shrink-0" />
      {children}
    </div>
  )
}