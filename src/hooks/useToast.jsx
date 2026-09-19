import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null)

  const toast = useCallback((msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 2400)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-pill bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-8"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
