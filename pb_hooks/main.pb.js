/// <reference path="../pb_data/types.d.ts" />

// Recap automatici (giorno/mese/anno) scritti con Gemini, lato server: non
// serve aprire l'app perché restino aggiornati.
//  - Creando/cancellando una nota, o modificandone descrizione o mood, i
//    recap toccati vengono SEGNATI da aggiornare in una coda (recap_jobs): il
//    giorno della nota, e il suo mese e anno solo se già finiti (mese e anno in
//    corso si riassumono quando chiudono: il primo del mese/anno). Salvare non
//    chiama mai Gemini.
//  - Mezz'ora dopo l'ultima modifica un cron (recapAfterQuiet, ogni minuto) prova a
//    scriverli subito con tutti i modelli attivi; se non riesce restano in coda.
//  - Ogni sera alle 23:00 (ora di Roma, TZ del container) un cron li evade
//    TUTTI in blocco: prima i giorni, poi i mesi, poi gli anni, una richiesta
//    a Gemini alla volta. Due ritentativi (23:20 e 23:40) riprendono quello
//    che fosse rimasto per un errore transitorio di Gemini.
//
// Questo file registra SOLO gli handler — tutta la logica vive in
// recap_lib.js, caricato con require() dentro ciascun handler. È un vincolo
// del JSVM di PocketBase, non una scelta di stile: ogni handler di
// hook/cron gira "serializzato" in un proprio contesto isolato e non vede
// funzioni definite altrove nello stesso file (fallisce con "X is not
// defined" al primo utilizzo — capitato qui il 2026-09-30, note che non si
// salvavano più). require() invece carica il modulo da un registro
// condiviso, quindi funziona da qualunque handler — vedi
// https://pocketbase.io/docs/js-overview/.
//
// I periodi CHIUSI PRIMA che questa funzione esistesse (o mai più toccati da
// allora) non hanno un recap: il cron guarda solo avanti, non recupera il
// passato da solo (richiederebbe centinaia di chiamate a Gemini in un colpo
// solo, con la chiave personale di ciascun utente — troppo fragile per un
// cron). Per quelli l'utente genera a mano dall'app col tasto
// "Genera"/"Rigenera" (src/lib/recaps.js), che scrive qui con lo stesso
// schema.

// I tre hook sulle note NON generano niente: segnano in coda (recap_jobs) i
// recap da aggiornare e basta, così salvare una nota resta istantaneo anche se
// Gemini è lento. Chi lavora la coda è il cron "recapBatch" qui sotto.
onRecordAfterCreateSuccess((e) => {
  require(`${__hooks}/recap_lib.js`).queueFromNote($app, e.record, null)
  e.next()
}, 'note')

onRecordAfterUpdateSuccess((e) => {
  let original = null
  try {
    original = e.record.original()
  } catch {
    original = null // se non disponibile si segna comunque la data attuale
  }
  // Il recap cambia solo se cambiano la descrizione o il mood: titolo, orari,
  // persone, luogo, canzoni o immagini non lo toccano. (Se l'originale non è
  // disponibile si segna comunque, per sicurezza.)
  const changed =
    !original ||
    original.get('content') !== e.record.get('content') ||
    original.get('mood') !== e.record.get('mood')
  if (changed) {
    require(`${__hooks}/recap_lib.js`).queueFromNote($app, e.record, original)
  }
  e.next()
}, 'note')

onRecordAfterDeleteSuccess((e) => {
  require(`${__hooks}/recap_lib.js`).queueFromNote($app, e.record, null)
  e.next()
}, 'note')

// Mezz'ora dopo l'ULTIMA modifica a una nota un primo tentativo di scrivere i
// recap segnati, con tutti i modelli attivi (Gemini, le riserve, Groq): il cron
// gira ogni minuto ma, se non c'è nulla da fare, si ferma subito. Se non riesce
// i recap restano in coda per il giro delle 23:00.
cronAdd('recapAfterQuiet', '* * * * *', () => {
  require(`${__hooks}/recap_lib.js`).runQuietRecaps($app)
})

// Tutti i recap segnati da aggiornare, in blocco, alle 23:00; poi due
// ritentativi per ciò che fosse rimasto in coda (errori transitori di Gemini).
cronAdd('recapBatch', '0 23 * * *', () => {
  require(`${__hooks}/recap_lib.js`).runRecapBatch($app)
})
cronAdd('recapBatchRetry1', '20 23 * * *', () => {
  require(`${__hooks}/recap_lib.js`).runRecapBatch($app)
})
cronAdd('recapBatchRetry2', '40 23 * * *', () => {
  require(`${__hooks}/recap_lib.js`).runRecapBatch($app)
})
