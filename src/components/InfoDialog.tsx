import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { WarningGlyph } from './WarningGlyph'

interface Props {
  title: string
  /** Set for points that are not from a weather station; shown first, with a warning icon. */
  warning?: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE = 'button, a[href], [tabindex]:not([tabindex="-1"])'

/**
 * A modal over the whole screen. Escape or a tap outside closes it, Tab stays
 * inside it, and focus goes back to whatever opened it.
 */
export function InfoDialog({ title, warning, onClose, children }: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [])

  // Rendered on <body>: the phone sheet is transformed, which would trap a fixed-position child inside it.
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {warning && (
          <p className="modal-warning">
            <WarningGlyph />
            {warning}
          </p>
        )}
        <h2 id={titleId}>{title}</h2>
        <div className="modal-body">{children}</div>
        <button type="button" className="primary-button modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  )
}
