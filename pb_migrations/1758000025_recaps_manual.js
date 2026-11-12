/// <reference path="../pb_data/types.d.ts" />

// Riassunto scritto a mano (giorno/mese/anno): se `manual` è vero il server non lo
// rigenera mai in automatico (pb_hooks/recap_lib.js). Il riassunto dell'anno non
// si compila più da solo in nessun caso.
migrate((app) => {
  const recaps = app.findCollectionByNameOrId('recaps')

  recaps.fields.add(new Field({ type: 'bool', name: 'manual' }))

  return app.save(recaps)
}, (app) => {
  const recaps = app.findCollectionByNameOrId('recaps')

  recaps.fields.removeByName('manual')

  return app.save(recaps)
})
