import { useEffect, useState } from 'react'
import Icon from './Icon'
import { useAuth } from '../context/AuthContext'
import { pb } from '../lib/pocketbase'
import { describeError } from '../lib/notes'
import { testMymapConnection, describeMymapError } from '../lib/mymap'
import { downloadIntegrationDoc } from '../lib/integrationDocs'

// Contenuto della sezione Integrazioni → MyMap (URL del server MyMap +
// email/password del suo account). Condiviso da Impostazioni mobile e web:
// `web` sceglie solo le classi (stessa convenzione delle altre integrazioni).
export default function MymapIntegration({ web = false }) {
  const { user } = useAuth()
  const [url, setUrl] = useState(user?.mymapUrl || '')
  const [email, setEmail] = useState(user?.mymapEmail || '')
  const [password, setPassword] = useState(user?.mymapPassword || '')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState(null) // { ok, message }

  // Se il server non ha ancora i campi (migration non applicata) `user.mymap*`
  // è undefined: non si azzerano gli input, altrimenti si perde quanto digitato.
  useEffect(() => {
    if (user?.mymapUrl === undefined) return
    setUrl(user.mymapUrl || '')
    setEmail(user.mymapEmail || '')
    setPassword(user.mymapPassword || '')
  }, [user])

  const complete = Boolean(url.trim() && email.trim() && password)

  async function save() {
    setSaving(true)
    setStatus(null)
    try {
      const rec = await pb.collection('users').update(user.id, {
        mymapUrl: url.trim(),
        mymapEmail: email.trim(),
        mymapPassword: password,
      })
      if (rec.mymapUrl === undefined) {
        setStatus({
          ok: false,
          message:
            'Il server non ha ancora i campi MyMap, quindi non si salva nulla: va pubblicata la nuova versione di MyJournal (migration 1758000017).',
        })
        return
      }
      setStatus({ ok: true, message: 'Salvato.' })
    } catch (err) {
      setStatus({ ok: false, message: describeError(err) })
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setStatus(null)
    try {
      const r = await testMymapConnection({
        url: url.trim(),
        email: email.trim(),
        password,
      })
      const names = r.customNames
        ? `${r.customNames} nomi dati a mano.`
        : 'nessun nome dato a mano trovato sul server: in MyMap, con l’account sul server, devono risultare "Salvate nel profilo" nelle impostazioni.'
      setStatus({
        ok: true,
        message: `Connessione riuscita: ${r.points.toLocaleString('it-IT')} punti, ${names}`,
      })
    } catch (err) {
      setStatus({ ok: false, message: describeMymapError(err) })
    } finally {
      setTesting(false)
    }
  }

  const textCls = web ? 'text-sm' : 'text-xs'
  const labelCls = web
    ? 'mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft'
    : 'mb-1 block text-xs font-semibold text-ink-soft'
  const inputCls =
    'w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none' +
    (web ? ' focus:border-ink-soft' : '')
  const testBtnCls =
    'flex-1 rounded-full border border-line px-4 font-bold text-ink transition disabled:opacity-50 ' +
    (web ? 'bg-cream py-2.5 text-sm hover:bg-tag' : 'bg-tag py-2 text-xs')
  const saveBtnCls =
    'flex-1 rounded-full border border-save-dark bg-save px-4 font-bold text-ink transition disabled:opacity-50 ' +
    (web ? 'py-2.5 text-sm' : 'py-2 text-xs')

  const body = (
    <>
      <label className="block">
        <span className={labelCls}>URL server MyMap</span>
        <input
          type="url"
          inputMode="url"
          placeholder="Lo stesso URL che usi in MyMap"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Email dell’account MyMap</span>
        <input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Password dell’account MyMap</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </label>

      {status && (
        <p className={`${textCls} ${status.ok ? 'text-save-dark' : 'text-delete-dark'}`}>
          {status.message}
        </p>
      )}

      <div className={web ? 'flex gap-3' : 'flex gap-2'}>
        <button type="button" onClick={test} disabled={testing || !complete} className={testBtnCls}>
          {testing ? 'Verifico…' : 'Testa connessione'}
        </button>
        <button type="button" onClick={save} disabled={saving} className={saveBtnCls}>
          {saving ? 'Salvo…' : 'Salva'}
        </button>
      </div>
    </>
  )

  return (
    <>
      <p className={`${textCls} text-ink-soft`}>
        Collega MyMap, l’app che traccia i tuoi spostamenti, per scegliere i
        posti visitati in un giorno quando aggiungi un luogo a una nota, senza
        scriverli a mano.
      </p>
      <button
        type="button"
        onClick={() => downloadIntegrationDoc('mymap')}
        className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft underline underline-offset-2"
      >
        <Icon name="download" size={13} className="shrink-0" />
        Come collegarlo (guida)
      </button>
      {web ? <div className="mt-4 space-y-4">{body}</div> : body}
    </>
  )
}
