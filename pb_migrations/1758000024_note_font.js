/// <reference path="../pb_data/types.d.ts" />

// Carattere con cui è scritta la nota (editor web): JSON `{ ff, fs }` = stile
// (0 Kalam, 1 Caveat, 2 Gochi) e dimensione (0 piccolo, 1 medio, 2 grande),
// vedi src/lib/noteFont.js. Vuoto = carattere predefinito.
migrate((app) => {
  const notes = app.findCollectionByNameOrId('note')

  notes.fields.add(new Field({ type: 'json', name: 'font', maxSize: 200 }))

  return app.save(notes)
}, (app) => {
  const notes = app.findCollectionByNameOrId('note')

  notes.fields.removeByName('font')

  return app.save(notes)
})
