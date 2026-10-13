/// <reference path="../pb_data/types.d.ts" />

// Chiave API di Groq (Impostazioni → Groq): serve per trascrivere i vocali con
// Whisper quando Gemini è intasato. Salvata sull'utente come geminiApiKey.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  users.fields.add(new Field({ type: 'text', name: 'groqApiKey', max: 500 }))

  return app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')

  users.fields.removeByName('groqApiKey')

  return app.save(users)
})
