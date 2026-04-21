import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  children: ReactNode
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  icon, 
  children, 
  className = '', 
  ...props 
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center gap-1.5 font-medium transition-colors disabled:opacity-60'
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-xl'
  }
  
  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}