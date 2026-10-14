import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const HTML_RE = /<[a-z!/][\s\S]*>/i

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Converte il valore memorizzato in HTML da mettere nell'editor.
// Le note vecchie sono testo semplice: preserva gli a capo.
function toHtml(value) {
  const v = value || ''
  if (HTML_RE.test(v)) return v
  return escapeHtml(v).replace(/\r\n|\r|\n/g, '<br>')
}

function isEmpty(el) {
  return el.textContent.trim() === '' && !el.querySelector('img')
}

const BLOCKS = new Set(['DIV', 'P', 'UL', 'OL', 'LI'])

// Il punto è davvero a inizio riga? (nessun testo prima, fino al <br> o al blocco)
function atLineStart(root, node) {
  let n = node
  while (n && n !== root) {
    for (let p = n.previousSibling; p; p = p.previousSibling) {
      if (p.nodeName === 'BR' || BLOCKS.has(p.nodeName)) return true
      if (p.textContent.trim() !== '') return false
    }
    n = n.parentNode
    if (n && n !== root && BLOCKS.has(n.nodeName)) return true
  }
  return true
}

// «-» + spazio a inizio riga -> punto elenco. Si costruisce a mano il <ul><li>
// invece di usare execCommand('insertUnorderedList'): quel comando di Chrome,
// dopo aver tolto il «-», sceglieva da solo "la riga" da trasformare e spesso
// prendeva quella PRECEDENTE (il testo saliva sopra). Qui si trasforma
// esattamente la riga in cui si sta scrivendo e basta.
function toBullet(root, node, range, removeCount = 1) {
  // il contenitore più esterno della riga, sotto la radice dell'editor
  let top = node
  while (top.parentNode && top.parentNode !== root) top = top.parentNode
  // già dentro un elenco: si controlla PRIMA di toccare il testo, altrimenti il «-» sparirebbe senza punto
  if (top.nodeName === 'UL' || top.nodeName === 'OL') return false

  // via il «-» (e lo spazio, se è già stato scritto)
  range.setStart(node, range.startOffset - removeCount)
  range.deleteContents()

  const li = document.createElement('li')
  const ul = document.createElement('ul')
  ul.appendChild(li)

  // riga avvolta da un elemento in linea (<span>, <font>, <b>…) lasciato da una cancellazione: si tratta come riga libera
  if (top !== node && !BLOCKS.has(top.nodeName)) node = top

  if (node.parentNode === root) {
    // riga "libera" nell'editor: il testo e gli elementi in linea fino al <br>
    // (o al blocco) precedente e successivo
    let start = node
    while (start.previousSibling && start.previousSibling.nodeName !== 'BR' && !BLOCKS.has(start.previousSibling.nodeName)) {
      start = start.previousSibling
    }
    let end = node
    while (end.nextSibling && end.nextSibling.nodeName !== 'BR' && !BLOCKS.has(end.nextSibling.nodeName)) {
      end = end.nextSibling
    }
    const after = end.nextSibling
    const nodes = []
    for (let n = start; n; n = n === end ? null : n.nextSibling) nodes.push(n)
    root.insertBefore(ul, start)
    nodes.forEach((n) => li.appendChild(n))
    // il <br> che chiudeva la riga non serve più: dopo un blocco farebbe una riga vuota
    if (after && after.nodeName === 'BR') after.remove()
  } else {
    // riga dentro un blocco (<div>/<p> creati da Invio)
    while (top.firstChild) li.appendChild(top.firstChild)
    root.replaceChild(ul, top)
  }

  // niente nodi di testo vuoti; un <br> tiene aperta la riga se il punto è vuoto
  li.childNodes.forEach((n) => {
    if (n.nodeType === 3 && n.textContent === '') n.remove()
  })
  if (li.textContent === '') li.appendChild(document.createElement('br'))

  // attaccato a un elenco che lo precede: stesso elenco
  const prev = ul.previousElementSibling
  if (prev && prev.nodeName === 'UL' && prev.nextSibling === ul) {
    prev.appendChild(li)
    ul.remove()
  }

  const sel = window.getSelection()
  const r = document.createRange()
  r.setStart(li, 0)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
  return true
}

// Editor WYSIWYG minimale (grassetto / corsivo / sottolineato).
// Il contenuto viene emesso come HTML tramite onChange.
const RichText = forwardRef(function RichText(
  { value, onChange, onFocusChange, placeholder = '', className = '' },
  ref,
) {
  const elRef = useRef(null)
  const lastHtml = useRef(undefined)

  useImperativeHandle(ref, () => ({
    exec(command) {
      const el = elRef.current
      if (!el) return
      el.focus()
      document.execCommand(command, false)
      const html = el.innerHTML
      lastHtml.current = html
      el.dataset.empty = String(isEmpty(el))
      onChange?.(html)
    },
    focus() {
      elRef.current?.focus()
    },
  }))

  // Sincronizza value -> DOM solo quando cambia dall'esterno (evita salti del cursore).
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    if (value !== lastHtml.current) {
      el.innerHTML = toHtml(value)
      lastHtml.current = value
      el.dataset.empty = String(isEmpty(el))
    }
  }, [value])

  function emit() {
    const el = elRef.current
    const html = el.innerHTML
    lastHtml.current = html
    el.dataset.empty = String(isEmpty(el))
    onChange?.(html)
  }

  // Backspace a inizio di un punto elenco: lo toglie (la voce torna riga normale
  // o sale di un livello). Di suo il browser unisce la voce alla riga sopra e il
  // punto resta lì. beforeinput funziona anche sui telefoni, dove keydown non dà il tasto.
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    function onBeforeInput(e) {
      if (e.inputType !== 'deleteContentBackward') return
      const sel = window.getSelection()
      if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return
      const node = sel.anchorNode
      const li = (node?.nodeType === 3 ? node.parentElement : node)?.closest('li')
      if (!li || !el.contains(li)) return
      const head = document.createRange()
      head.selectNodeContents(li)
      head.setEnd(sel.anchorNode, sel.anchorOffset)
      if (head.toString() !== '' || head.cloneContents().querySelector('img')) return
      e.preventDefault()
      document.execCommand('outdent', false) // l'evento input che ne segue aggiorna il valore
    }
    el.addEventListener('beforeinput', onBeforeInput)
    return () => el.removeEventListener('beforeinput', onBeforeInput)
  }, [])

  // Telefono: le tastiere non mandano il tasto in keydown (key = "Unidentified"),
  // quindi «-» + spazio non si vede lì. Si guarda il risultato dopo che lo spazio è
  // stato scritto: se la riga è «- » si toglie e si fa il punto elenco. Con un
  // piccolo ritardo, perché la tastiera può essere ancora in composizione.
  function bulletFromInput() {
    const sel = window.getSelection()
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== 3 || !elRef.current?.contains(node)) return
    const before = node.textContent.slice(0, range.startOffset)
    const lineStart = before.lastIndexOf('\n') + 1
    if (!/^-[ \u00a0]$/.test(before.slice(lineStart))) return
    if (!atLineStart(elRef.current, node)) return
    if (node.parentElement?.closest('ul, ol')) return
    if (toBullet(elRef.current, node, range, 2)) emit()
  }

  function handleInput(e) {
    emit()
    const t = e.nativeEvent?.inputType
    if ((t === 'insertText' || t === 'insertCompositionText') && /^[ \u00a0]$/.test(e.nativeEvent.data || ' ')) {
      setTimeout(bulletFromInput, 0)
    }
  }

  // "-" + spazio a inizio riga -> punto elenco (tastiera fisica).
  function handleKeyDown(e) {
    if (e.key !== ' ' && e.key !== 'Spacebar') return
    const sel = window.getSelection()
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== 3) return
    const before = node.textContent.slice(0, range.startOffset)
    const lineStart = before.lastIndexOf('\n') + 1
    if (before.slice(lineStart).trim() !== '-') return
    if (!atLineStart(elRef.current, node)) return

    // dentro un elenco il «-» resta un normale trattino
    if (node.parentElement?.closest('ul, ol')) return

    e.preventDefault()
    if (toBullet(elRef.current, node, range)) emit()
  }

  return (
    <div
      ref={elRef}
      className={'richtext ' + className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder || 'Contenuto della nota'}
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
    />
  )
})

export default RichText
