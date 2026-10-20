import { AlertIcon, CheckIcon, CloseIcon } from './Icons'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null
  const isError = toast.tone === 'error'

  return (
    <div
      className={`toast ${isError ? 'is-error' : ''}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="toast-icon" aria-hidden="true">
        {isError ? <AlertIcon /> : <CheckIcon />}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Close message">
        <CloseIcon />
      </button>
    </div>
  )
}
