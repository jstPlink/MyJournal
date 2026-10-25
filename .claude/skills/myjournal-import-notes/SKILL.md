---
name: myjournal-import-notes
description: Inserisce nel server MyJournal i file *-note.json generati dalla trascrizione, in modo idempotente e con verifica finale (totali, doppioni, sovrapposizioni). Due vie - script da terminale (preferita) o sessione del browser.
---

# Importare le note nell'app

L'app è su **https://myjournal.fplinio.it** (PocketBase). Mai usare l'indirizzo in `.env.local` (non esiste).
Non chiedere né digitare mai la password dell'utente: la inserisce lui.

## Via 1 (preferita): script da terminale
Lo lancia **l'utente** sul suo PC; lo script chiede email e password (la password non si vede e non viene salvata):
```
python .claude\skills\myjournal-import-notes\scripts\import_notes.py "C:\Users\plink\Desktop\Note\2025-10-note.json" "C:\Users\plink\Desktop\Note\2025-11-note.json"
```
- `--dry-run`: non scrive niente, mostra quante note creerebbe.
- `--update-existing`: aggiorna (PATCH) anche le note già presenti con stessa data e titolo.
- I file `*-note.json` contengono i **nomi** delle persone (`_people`) e dei tag (`_tags`): lo script li risolve in id leggendo il server. Le persone mancanti vengono segnalate; con `--create-missing-people` le crea (colore targhetta come l'app).
- `--create-people "Nome Cognome" ...`: crea persone in anagrafica con il colore della targhetta calcolato come l'app.
- Variabili d'ambiente opzionali `MJ_EMAIL`, `MJ_PASSWORD`, `MJ_URL`.
- Alla fine stampa per ogni mese: note sul server, **doppioni** e **sovrapposizioni di orario**.

Prima di dire all'utente di lanciarlo: esegui `build_notes.py` e leggi gli avvisi; controlla che le persone nuove esistano o vadano create (`--create-people`) e di rigenerare i JSON con i loro id (`--people-extra`).

## Via 2: sessione del browser (se l'utente ha già fatto l'accesso)
Nel browser integrato su `https://myjournal.fplinio.it` (l'utente fa il login), in `javascript_tool`:
- token e id utente: `JSON.parse(localStorage.getItem('pocketbase_auth'))` (`.token`, `.record.id`), header `Authorization: <token>`;
- elenco: `GET /api/collections/note/records?perPage=200&filter=date>="2025-10-01" && date<"2025-11-01"&fields=id,date,title,people`;
- creare: `POST /api/collections/note/records` con il JSON della nota + `user`; aggiornare: `PATCH /api/collections/note/records/<id>`;
- persone: `POST /api/collections/people/records` `{name, user, tapeColor}` (colore da `mjlib.tape_color`).
Inserisci a blocchi da ~25 note **dentro la stessa chiamata** che contiene i dati (il contesto della pagina può azzerarsi tra una chiamata e l'altra), saltando le note già presenti (data + titolo), e alla fine rielenca il mese per verificare totale, doppioni e sovrapposizioni. Un server locale (127.0.0.1) **non** è raggiungibile dalla pagina.

## Dopo l'inserimento
Riferisci: note create/saltate/errori, persone create, avvisi su sovrapposizioni o doppioni (quelle già presenti dell'utente non vanno toccate, solo segnalate). Le domande in coda.
