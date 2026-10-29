import { useLayoutEffect, useRef } from 'react'

// Titolo della nota: come un campo di testo, ma se è più lungo della larghezza
// va a capo e il campo si allunga in verticale (mai barra di scorrimento). Invio non
// manda a capo: il titolo resta una riga logica.
export default function TitleInput({ value, onChange, placeholder, className = '' }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // si espande in verticale quanto serve: niente barra di scorrimento
    el.style.height = `${el.scrollHeight}px`
    el.style.overflowY = 'hidden'
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault()
      }}
      className={className + ' uppercase'}
      aria-label={placeholder}
    />
  )
}
