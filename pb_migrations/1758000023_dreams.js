/// <reference path="../pb_data/types.d.ts" />

// Sogni (lib/dreams.js): collection a parte rispetto alle note, così non entrano
// nel mood del giorno, nei recap né nelle statistiche delle note.
// Campi: `date` (giorno, come per le note: mezzanotte UTC, si usa il prefisso AAAA-MM-GG),
// `time` (solo l'orario, con data segnaposto 2000-01-01 come timeStart delle note; 00:00 se
// non si sa a che ora), `title`, `content`, `clarity` (nitidezza 0–1) ed `extra` (JSON libero:
// ci si potranno aggiungere altri parametri senza una nuova migration).
// Per-utente: `user` va valorizzato in creazione, come per le altre collection.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    const collection = new Collection({
      type: 'base',
      name: 'dreams',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule:
        '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: 'user = @request.auth.id',
      deleteRule: 'user = @request.auth.id',
      fields: [
        { type: 'date', name: 'date' },
        { type: 'date', name: 'time' },
        { type: 'text', name: 'title', max: 300 },
        { type: 'text', name: 'content', max: 50000 },
        { type: 'number', name: 'clarity', min: 0, max: 1 },
        { type: 'json', name: 'extra', maxSize: 100000 },
        {
          type: 'relation',
          name: 'user',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('dreams')
    return app.delete(collection)
  },
)
