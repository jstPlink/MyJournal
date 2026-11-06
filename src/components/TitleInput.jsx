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
      value={(value ?? '').toLocaleUpperCase('it-IT')}
      onChange={(e) => {
        // sempre maiuscolo davvero (non solo a vista), tenendo il cursore dov'era
        const el = e.target
        const pos = el.selectionStart
        const next = el.value.replace(/\n/g, ' ').toLocaleUpperCase('it-IT')
        if (next !== el.value) {
          el.value = next
          el.setSelectionRange(pos, pos)
        }
        onChange(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault()
      }}
      className={className + ' uppercase'}
      aria-label={placeholder}
    />
  )
}
