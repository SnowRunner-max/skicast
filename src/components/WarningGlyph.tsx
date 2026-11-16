/** A line-drawn warning triangle. Decorative: always sits beside words that say what it means. */
export function WarningGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`warning-glyph ${className}`.trim()}>
      <path d="M12 3.6 21.2 19.6H2.8Z" />
      <path d="M12 10v4.4M12 17.1v.2" />
    </svg>
  )
}
