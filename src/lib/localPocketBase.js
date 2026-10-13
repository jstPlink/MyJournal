// Client "locale": stessa interfaccia (ridotta) dell'SDK di PocketBase che
// l'app usa, ma i dati restano in questo dispositivo (IndexedDB). Serve alla
// modalità "Su questo dispositivo" scelta all'avvio (vedi backend.js): niente
// server, niente account, niente rete.
//
// Copre solo quello che l'app chiama: collection(...).getList / getFullList /
// getOne / getFirstListItem / create / update / delete, authStore, filter(),
// files.getURL(). Il filtro supporta la sintassi di PocketBase usata
// dall'app (= != > >= < <= ~ !~ && || e parentesi), con lo stesso confronto
// "a stringa" sulle date, così le query di notes.js danno gli stessi risultati.
//
// Tutti i record vengono caricati in memoria all'avvio (`ready`) e ogni
// scrittura è subito riportata in IndexedDB; i file allegati sono Blob in un
// secondo store e diventano URL (blob:) solo quando servono.

const DB_NAME = 'myjournal-local'
const RECORDS = 'records'
const FILES = 'files'

// Campi "speciali" per collection (il server li conosce dallo schema).
const SCHEMAS = {
  users: { files: ['avatar'], multi: [], json: ['moodGradient', 'settings', 'moodFormula'], number: [], date: [] },
  note: {
    files: ['images'],
    multi: ['images', 'people', 'tags'],
    json: ['songs'],
    number: ['mood'],
    date: ['date', 'timeStart', 'timeEnd'],
  },
  people: { files: [], multi: [], json: [], number: [], date: [] },
  tags: { files: [], multi: [], json: [], number: [], date: [] },
  places: { files: [], multi: [], json: [], number: ['lat', 'lon'], date: [] },
  import_csvs: { files: [], multi: [], json: [], number: [], date: [] },
  recaps: { files: [], multi: [], json: [], number: [], date: [] },
  recap_jobs: { files: [], multi: [], json: [], number: ['queuedAt'], date: [] },
}
const EMPTY_SCHEMA = { files: [], multi: [], json: [], number: [], date: [] }
const schemaOf = (c) => SCHEMAS[c] || EMPTY_SCHEMA

const NOT_STORED = new Set(['password', 'passwordConfirm', 'oldPassword', 'emailVisibility', 'verified'])

function makeError(status, message, data = {}) {
  const e = new Error(message)
  e.status = status
  e.response = { status, message, data }
  return e
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
function randomId(n = 15) {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

function nowStamp() {
  // stesso formato di PocketBase: "2026-06-01 10:20:30.123Z"
  return new Date().toISOString().replace('T', ' ')
}

// Normalizza una data/ora come fa il campo "date" di PocketBase.
function normalizeDate(v) {
  if (v == null || v === '') return ''
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?Z?$/)
  if (!m) return s
  const [, d, hh = '00', mm = '00', ss = '00', ms = '0'] = m
  return `${d} ${hh}:${mm}:${ss}.${ms.padEnd(3, '0')}Z`
}

// ---------------------------------------------------------------- IndexedDB

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS)
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const reqP = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

function txDone(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

// Cancella tutti i dati locali (usata da "Elimina account" in modalità locale).
export async function wipeLocalData() {
  try {
    const db = await openDb()
    const t = db.transaction([RECORDS, FILES], 'readwrite')
    t.objectStore(RECORDS).clear()
    t.objectStore(FILES).clear()
    await txDone(t)
    db.close()
  } catch {
    // niente da cancellare
  }
}

// ------------------------------------------------------------------ filtro

const TOKEN_RE =
  /\s*(?:(&&|\|\|)|(\(|\))|(\?!=|\?!~|\?>=|\?<=|\?=|\?~|\?>|\?<|!=|!~|>=|<=|=|~|>|<)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(-?\d+(?:\.\d+)?(?![\w.]))|([A-Za-z_@][\w.@:]*))/y

function tokenize(src) {
  const out = []
  TOKEN_RE.lastIndex = 0
  let pos = 0
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break
    TOKEN_RE.lastIndex = pos
    const m = TOKEN_RE.exec(src)
    if (!m) throw makeError(400, `Filtro non valido: ${src}`)
    pos = TOKEN_RE.lastIndex
    if (m[1]) out.push({ t: 'logic', v: m[1] })
    else if (m[2]) out.push({ t: 'paren', v: m[2] })
    else if (m[3]) out.push({ t: 'op', v: m[3] })
    else if (m[4]) {
      const body = m[4].slice(1, -1).replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))
      out.push({ t: 'value', v: body })
    } else if (m[5]) out.push({ t: 'value', v: Number(m[5]) })
    else {
      const w = m[6]
      if (w === 'true') out.push({ t: 'value', v: true })
      else if (w === 'false') out.push({ t: 'value', v: false })
      else if (w === 'null') out.push({ t: 'value', v: null })
      else out.push({ t: 'field', v: w })
    }
  }
  return out
}

function compare(op, l, r) {
  const any = op.startsWith('?')
  const o = any ? op.slice(1) : op
  if (Array.isArray(l)) {
    if (any) return l.some((x) => compare(o, x, r))
    if (o === '=') return l.includes(r)
    if (o === '!=') return !l.includes(r)
    if (o === '~') return l.some((x) => compare('~', x, r))
    if (o === '!~') return !l.some((x) => compare('~', x, r))
    return false
  }
  if (r === null) {
    const empty = l == null || l === ''
    return o === '=' ? empty : o === '!=' ? !empty : false
  }
  switch (o) {
    case '=':
      return typeof r === 'number' || typeof l === 'number'
        ? Number(l) === Number(r)
        : String(l ?? '') === String(r)
    case '!=':
      return !compare('=', l, r)
    case '~':
      return String(l ?? '').toLowerCase().includes(String(r).toLowerCase())
    case '!~':
      return !compare('~', l, r)
    default: {
      const numeric = typeof r === 'number'
      const a = numeric ? Number(l) : String(l ?? '')
      const b = numeric ? r : String(r)
      if (o === '>') return a > b
      if (o === '>=') return a >= b
      if (o === '<') return a < b
      if (o === '<=') return a <= b
      return false
    }
  }
}

function compileFilter(src) {
  if (!src || !String(src).trim()) return () => true
  const toks = tokenize(String(src))
  let i = 0
  const operand = () => {
    const tk = toks[i++]
    if (!tk) throw makeError(400, 'Filtro incompleto.')
    return tk
  }
  const read = (tk, rec) => (tk.t === 'field' ? rec[tk.v] : tk.v)

  function parseOr() {
    let left = parseAnd()
    while (toks[i]?.t === 'logic' && toks[i].v === '||') {
      i++
      const l = left
      const r = parseAnd()
      left = (rec) => l(rec) || r(rec)
    }
    return left
  }
  function parseAnd() {
    let left = parseTerm()
    while (toks[i]?.t === 'logic' && toks[i].v === '&&') {
      i++
      const l = left
      const r = parseTerm()
      left = (rec) => l(rec) && r(rec)
    }
    return left
  }
  function parseTerm() {
    if (toks[i]?.t === 'paren' && toks[i].v === '(') {
      i++
      const inner = parseOr()
      if (!(toks[i]?.t === 'paren' && toks[i].v === ')')) throw makeError(400, 'Parentesi non chiusa nel filtro.')
      i++
      return inner
    }
    const a = operand()
    const op = operand()
    if (op.t !== 'op') throw makeError(400, 'Filtro non valido.')
    const b = operand()
    return (rec) => compare(op.v, read(a, rec), read(b, rec))
  }

  const fn = parseOr()
  if (i < toks.length) throw makeError(400, 'Filtro non valido.')
  return fn
}

function compileSort(src) {
  const keys = String(src || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('-') ? { f: s.slice(1), d: -1 } : { f: s.replace(/^\+/, ''), d: 1 }))
  if (!keys.length) return null
  return (a, b) => {
    for (const { f, d } of keys) {
      const x = a[f] ?? ''
      const y = b[f] ?? ''
      if (x === y) continue
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * d
      return String(x) < String(y) ? -d : d
    }
    return 0
  }
}

// ------------------------------------------------------------------ client

export function createLocalClient() {
  /** @type {Record<string, Map<string, any>>} */
  const data = {}
  /** @type {Map<string, Blob>} */
  const files = new Map()
  const urls = new Map()
  let db = null

  const table = (c) => (data[c] ||= new Map())

  const persistRecord = async (c, rec) => {
    const t = db.transaction(RECORDS, 'readwrite')
    t.objectStore(RECORDS).put(rec, `${c}/${rec.id}`)
    await txDone(t)
  }
  const persistDelete = async (c, id) => {
    const t = db.transaction(RECORDS, 'readwrite')
    t.objectStore(RECORDS).delete(`${c}/${id}`)
    await txDone(t)
  }
  const persistFile = async (key, blob) => {
    const t = db.transaction(FILES, 'readwrite')
    t.objectStore(FILES).put(blob, key)
    await txDone(t)
  }
  const persistFileDelete = async (key) => {
    const t = db.transaction(FILES, 'readwrite')
    t.objectStore(FILES).delete(key)
    await txDone(t)
  }

  // ------------------------------------------------------------ authStore
  const listeners = new Set()
  const authStore = {
    record: null,
    token: 'local',
    get isValid() {
      return Boolean(this.record)
    },
    onChange(cb, fireImmediately = false) {
      listeners.add(cb)
      if (fireImmediately) cb(this.token, this.record)
      return () => listeners.delete(cb)
    },
    save(token, record) {
      this.token = token || 'local'
      this.record = record || null
      for (const cb of listeners) cb(this.token, this.record)
    },
    clear() {
      this.save('', null)
    },
  }

  const clone = (v) => (v == null ? v : structuredClone(v))
  const out = (c, rec) => ({ ...clone(rec), collectionName: c, collectionId: c })

  // ------------------------------------------------------------- file util
  const fileKey = (c, id, name) => `${c}/${id}/${name}`

  function newFileName(file) {
    const raw = file.name || 'file'
    const dot = raw.lastIndexOf('.')
    const base = (dot > 0 ? raw.slice(0, dot) : raw).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'file'
    const ext = dot > 0 ? raw.slice(dot).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) : ''
    return `${base}_${randomId(10)}${ext}`
  }

  async function storeFile(c, id, file) {
    const name = newFileName(file)
    const key = fileKey(c, id, name)
    files.set(key, file)
    await persistFile(key, file)
    return name
  }

  async function dropFile(c, id, name) {
    const key = fileKey(c, id, name)
    files.delete(key)
    const u = urls.get(key)
    if (u) {
      URL.revokeObjectURL(u)
      urls.delete(key)
    }
    await persistFileDelete(key)
  }

  const isBlob = (v) => typeof Blob !== 'undefined' && v instanceof Blob

  // ---------------------------------------------------------- body → record
  function groupBody(body) {
    const groups = new Map()
    const push = (k, v) => {
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(v)
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      for (const [k, v] of body.entries()) push(k, v)
    } else {
      for (const [k, v] of Object.entries(body || {})) {
        if (Array.isArray(v)) {
          if (v.length === 0) groups.set(k, [])
          else for (const x of v) push(k, x)
        } else push(k, v)
      }
    }
    return groups
  }

  async function applyBody(c, rec, body) {
    const sch = schemaOf(c)
    for (const [rawKey, values] of groupBody(body)) {
      const mod = rawKey.endsWith('+') ? '+' : rawKey.endsWith('-') ? '-' : ''
      const key = mod ? rawKey.slice(0, -1) : rawKey
      if (NOT_STORED.has(key) || key === 'id') continue

      if (sch.files.includes(key)) {
        const isMulti = sch.multi.includes(key)
        const current = isMulti ? [...(rec[key] || [])] : rec[key] ? [rec[key]] : []
        if (mod === '-') {
          const gone = new Set(values.filter((v) => typeof v === 'string'))
          for (const n of current.filter((n) => gone.has(n))) await dropFile(c, rec.id, n)
          const left = current.filter((n) => !gone.has(n))
          rec[key] = isMulti ? left : left[0] || ''
          continue
        }
        const added = []
        for (const v of values) if (isBlob(v)) added.push(await storeFile(c, rec.id, v))
        const keptNames = values.filter((v) => typeof v === 'string' && v && current.includes(v))
        let next
        if (mod === '+') next = [...current, ...added]
        else {
          // senza `+` la lista è sostituita da quella inviata
          const hasAny = values.some((v) => isBlob(v) || (typeof v === 'string' && v))
          next = hasAny ? [...keptNames, ...added] : []
          for (const n of current.filter((n) => !next.includes(n))) await dropFile(c, rec.id, n)
        }
        rec[key] = isMulti ? next : next[next.length - 1] || ''
        if (!isMulti) for (const n of next.slice(0, -1)) await dropFile(c, rec.id, n)
        continue
      }

      if (sch.multi.includes(key)) {
        const list = values.filter((v) => typeof v === 'string' && v !== '')
        const current = rec[key] || []
        if (mod === '+') rec[key] = [...current, ...list.filter((v) => !current.includes(v))]
        else if (mod === '-') rec[key] = current.filter((v) => !list.includes(v))
        else rec[key] = list
        continue
      }

      const v = values[values.length - 1]
      if (sch.json.includes(key)) {
        if (typeof v === 'string') {
          try {
            rec[key] = v === '' ? null : JSON.parse(v)
          } catch {
            rec[key] = v
          }
        } else rec[key] = v ?? null
      } else if (sch.number.includes(key)) {
        rec[key] = v === '' || v == null ? 0 : Number(v)
      } else if (sch.date.includes(key)) {
        rec[key] = normalizeDate(v)
      } else if (isBlob(v)) {
        // file in un campo che lo schema locale non conosce: ignorato
      } else {
        rec[key] = v ?? ''
      }
    }
  }

  // ------------------------------------------------------------ collection
  function collection(c) {
    const sch = schemaOf(c)

    const select = (opts = {}) => {
      let list = [...table(c).values()]
      if (opts.filter) list = list.filter(compileFilter(opts.filter))
      const sorter = compileSort(opts.sort)
      if (sorter) list.sort(sorter)
      return list
    }

    return {
      async getFullList(opts) {
        return select(typeof opts === 'object' ? opts : {}).map((r) => out(c, r))
      },
      async getList(page = 1, perPage = 30, opts = {}) {
        const all = select(opts)
        const start = (page - 1) * perPage
        return {
          page,
          perPage,
          totalItems: all.length,
          totalPages: Math.max(1, Math.ceil(all.length / perPage)),
          items: all.slice(start, start + perPage).map((r) => out(c, r)),
        }
      },
      async getOne(id) {
        const rec = table(c).get(id)
        if (!rec) throw makeError(404, 'The requested resource wasn\'t found.')
        return out(c, rec)
      },
      async getFirstListItem(filter, opts = {}) {
        const [first] = select({ ...opts, filter })
        if (!first) throw makeError(404, 'The requested resource wasn\'t found.')
        return out(c, first)
      },
      async create(body) {
        const rec = { id: randomId(), created: nowStamp(), updated: nowStamp() }
        for (const f of sch.multi) rec[f] = []
        for (const f of sch.files) if (!sch.multi.includes(f)) rec[f] = ''
        for (const f of sch.number) rec[f] = 0
        await applyBody(c, rec, body)
        table(c).set(rec.id, rec)
        await persistRecord(c, rec)
        return out(c, rec)
      },
      async update(id, body) {
        const rec = table(c).get(id)
        if (!rec) throw makeError(404, 'The requested resource wasn\'t found.')
        await applyBody(c, rec, body)
        rec.updated = nowStamp()
        await persistRecord(c, rec)
        const result = out(c, rec)
        if (c === 'users' && authStore.record?.id === id) authStore.save(authStore.token, result)
        return result
      },
      async delete(id) {
        const rec = table(c).get(id)
        if (!rec) return true
        for (const f of sch.files) {
          const names = sch.multi.includes(f) ? rec[f] || [] : rec[f] ? [rec[f]] : []
          for (const n of names) await dropFile(c, id, n)
        }
        table(c).delete(id)
        await persistDelete(c, id)
        return true
      },
      // Solo per `users`: l'unico utente è quello locale.
      async authRefresh() {
        return { token: authStore.token, record: authStore.record }
      },
      async authWithPassword() {
        return { token: authStore.token, record: authStore.record }
      },
      async requestEmailChange() {
        return true
      },
    }
  }

  // ----------------------------------------------------------------- avvio
  const client = {
    authStore,
    collection,
    autoCancellation() {},
    // Segnaposto {:nome} sostituiti con valori già "quotati", come l'SDK.
    filter(expr, params = {}) {
      return String(expr).replace(/\{:(\w+)\}/g, (_, k) => {
        const v = params[k]
        if (v == null) return 'null'
        if (typeof v === 'number' || typeof v === 'boolean') return String(v)
        return JSON.stringify(String(v))
      })
    },
    files: {
      getURL(record, filename) {
        if (!record || !filename) return ''
        const key = fileKey(record.collectionName || 'note', record.id, filename)
        const blob = files.get(key)
        if (!blob) return ''
        let url = urls.get(key)
        if (!url) {
          url = URL.createObjectURL(blob)
          urls.set(key, url)
        }
        return url
      },
    },
    ready: null,
  }

  client.ready = (async () => {
    db = await openDb()
    const t = db.transaction([RECORDS, FILES], 'readonly')
    const recKeys = await reqP(t.objectStore(RECORDS).getAllKeys())
    const recVals = await reqP(t.objectStore(RECORDS).getAll())
    const fileKeys = await reqP(t.objectStore(FILES).getAllKeys())
    const fileVals = await reqP(t.objectStore(FILES).getAll())
    recKeys.forEach((k, i) => {
      const c = String(k).split('/')[0]
      table(c).set(recVals[i].id, recVals[i])
    })
    fileKeys.forEach((k, i) => files.set(String(k), fileVals[i]))

    // Un solo utente, creato al primo avvio: niente email né password, il
    // dispositivo stesso è la protezione.
    let user = [...table('users').values()][0]
    if (!user) {
      user = await collection('users').create({ email: '', name: '' })
      user = table('users').get(user.id)
    }
    authStore.save('local', out('users', user))

    try {
      await navigator.storage?.persist?.()
    } catch {
      // il browser decide da solo
    }
  })()

  return client
}
