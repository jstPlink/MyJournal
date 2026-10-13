/// <reference path="../pb_data/types.d.ts" />

// Scritta per PocketBase v0.28.x (la versione a cui è pinnato il pacchetto
// `pocketbase` in package.json). Aggiunge alla collection di sistema `users`
// i campi usati da MyJournal per le integrazioni opzionali (Immich, Spotify,
// Gemini), e apre l'auto-registrazione: il login dell'app ha una schermata
// di iscrizione (crea il tuo diario personale) che deve poter creare un
// nuovo utente senza essere già autenticati.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  users.fields.add(
    new Field({ type: 'text', name: 'immichUrl', max: 500 }),
  )
  users.fields.add(
    new Field({ type: 'text', name: 'immichApiKey', max: 500 }),
  )
  users.fields.add(
    new Field({ type: 'text', name: 'spotifyClientId', max: 500 }),
  )
  users.fields.add(
    new Field({ type: 'text', name: 'spotifyClientSecret', max: 500 }),
  )
  users.fields.add(
    new Field({ type: 'text', name: 'geminiApiKey', max: 500 }),
  )

  // Auto-registrazione pubblica (il resto delle regole di `users` resta
  // quello di default: ognuno legge/modifica solo il proprio record).
  users.createRule = ''

  return app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')

  users.fields.removeByName('geminiApiKey')
  users.fields.removeByName('spotifyClientSecret')
  users.fields.removeByName('spotifyClientId')
  users.fields.removeByName('immichApiKey')
  users.fields.removeByName('immichUrl')
  users.createRule = null

  return app.save(users)
})
