/// <reference path="../pb_data/types.d.ts" />

// Password da almeno 5 caratteri (prima il minimo di PocketBase: 8) e link di
// recupero password che apre la schermata dell'app (/reset-password/<token>)
// invece dell'admin UI di PocketBase, che nginx non espone.
// Perché la mail parta serve un server SMTP e l'«Application URL» impostati
// nelle impostazioni di PocketBase (vedi ARCHITETTURA.md).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.getByName('password').min = 5
    users.resetPasswordTemplate.body =
      '<p>Ciao,</p>\n<p>Premi il pulsante per scegliere una nuova password.</p>\n<p>\n  <a class="btn" href="{APP_URL}/reset-password/{TOKEN}" target="_blank" rel="noopener">Nuova password</a>\n</p>\n<p><i>Se non l\'hai chiesto tu, ignora questa mail.</i></p>\n<p>\n  Grazie,<br/>\n  {APP_NAME}\n</p>'
    users.resetPasswordTemplate.subject = 'Nuova password per {APP_NAME}'
    return app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.getByName('password').min = 8
    return app.save(users)
  },
)
