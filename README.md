# MyJournal — Diario personale (PWA)

Diario personale come Progressive Web App: funziona da browser desktop e si
installa su smartphone (manifest + service worker). Tre schermate principali —
**mese → giorno → nota** — collegate a un backend **PocketBase**.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) (JavaScript)
- [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`)
- [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) — installabile su mobile
- [PocketBase JS SDK](https://github.com/pocketbase/js-sdk) (`pocketbase`)
- [React Router](https://reactrouter.com/) per la navigazione
- [`react-markdown`](https://github.com/remarkjs/react-markdown) + `remark-gfm`
  per rendere il contenuto delle note (Markdown)

## Avvio in locale

Prerequisiti: **Node.js 20+** e npm.

```bash
npm install
npm run dev
```

L'app parte su `http://localhost:5173`. La prima schermata è il **login**
(autenticazione utenti PocketBase, collection `users`).

Il dev server non ha un database proprio: inoltra `/api/` a `VITE_DEV_API`
oppure, se non impostata, a uno stack Docker locale su `http://localhost:8973`.
Per lavorare contro il server online crea `.env.local` con
`VITE_DEV_API=https://myjournal.tuodominio.it` (attenzione: sono i dati veri).

Documentazione: [docs/GUIDA.md](docs/GUIDA.md) (uso) e
[ARCHITETTURA.md](ARCHITETTURA.md) (com'è fatta, deploy, domande frequenti).

Altri comandi:

```bash
npm run build     # build di produzione in dist/
npm run preview   # serve la build (utile per testare la PWA installabile)
npm run lint      # oxlint
npm run icons     # rigenera le icone PWA da scripts/icon-source.svg
```

## Dove tieni i dati

Alla prima apertura l'app chiede dove salvare il diario:

- **Su questo dispositivo** — telefono o browser, senza server né account (i dati stanno in IndexedDB: se cancelli i dati dell'app o del
  browser li perdi, quindi usa Esporta).
- **Sul mio server** — l'indirizzo della tua istanza (vedi sotto), scritto da te: nessun indirizzo è incluso nell'app.

Si cambia da Impostazioni → Archivio e account. Dettagli in [ARCHITETTURA.md](ARCHITETTURA.md) §12.

## Fai girare la TUA istanza (il tuo diario, il tuo database)

Ogni installazione di MyJournal è **autosufficiente**: `docker compose up` avvia
sia il backend PocketBase (con lo schema — collection `note`/`people`/`tags` e
i campi delle integrazioni su `users` — creato automaticamente al primo avvio
dalle migration in [`pb_migrations/`](pb_migrations)) sia il frontend. Non
serve nessun PocketBase esterno da configurare a mano.

```bash
docker compose up -d --build
```

Poi apri `http://localhost:8973` e usa **"Crea il tuo diario personale"**
nella schermata di login: è una registrazione normale, non serve toccare
PocketBase a mano. Il primo account che crei è il tuo, isolato in questa
istanza (un'istanza = un database SQLite tutto suo, nel volume Docker
`pb_data`).

Il database è **interno all'app**: il container PocketBase non pubblica nessuna
porta, lo raggiunge solo il container del frontend (`myjournal-diario`, nginx)
sulla rete Docker. L'app chiama `/api/...` sulla **propria origin** e nginx
inoltra a PocketBase solo gli endpoint che servono all'app (record, login e
registrazione, file, realtime); l'admin UI (`/_/`), il login da superuser,
impostazioni, backup e gestione delle collection non sono raggiungibili da
fuori.

Per metterla online con un dominio tuo (Cloudflare Tunnel, reverse proxy...)
basta pubblicare **un solo hostname** verso la porta del frontend (8973):
niente URL del database da configurare, niente CORS.

Solo per puntare a un backend esterno, rifai la build con
`VITE_PB_URL=https://pb.tuodominio.it docker compose up -d --build`.

> Il proxy raggiunge PocketBase come `pocketbase:8090` (nome del servizio
> compose). Con `docker run` separati, o nomi diversi, imposta la variabile
> d'ambiente `PB_UPSTREAM=<nome-container>:8090` sul container del frontend.

> La versione di PocketBase è pinnata (`PB_VERSION` in
> [`pocketbase.Dockerfile`](pocketbase.Dockerfile)) alla stessa serie 0.28.x
> del pacchetto `pocketbase` in `package.json`. Aggiornandone uno, aggiorna
> anche l'altro.

Interventi amministrativi (superuser, ispezione dei dati) si fanno dall'interno
del container, senza esporre nulla:

```bash
docker compose exec pocketbase /pb/pocketbase superuser upsert admin@tuodominio.it "una-password-lunga"
```

Se ti serve l'**admin UI** (`/_/`), pubblica TEMPORANEAMENTE la porta aggiungendo
`ports: ["28090:8090"]` al servizio `pocketbase` (e togliendola a lavoro finito).

### Oppure con docker puro

```bash
docker build -t myjournal-diario:latest .
docker build -f pocketbase.Dockerfile -t myjournal-pocketbase:latest .
docker network create myjournal 2>/dev/null || true
docker run -d --name myjournal-pocketbase --network myjournal -v pb_data:/pb/pb_data --restart unless-stopped myjournal-pocketbase:latest
docker run -d --name myjournal-diario --network myjournal -e PB_UPSTREAM=myjournal-pocketbase:8090 -p 8973:80 --restart unless-stopped myjournal-diario:latest
```

### Deploy sul NAS (immagini pre-buildate)

Modo consigliato: GitHub Actions builda e pubblica **entrambe** le immagini su
GHCR, il NAS le scarica ed esegue — nessun sorgente né build sul NAS.

- Workflow: [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)
  (push su `main` → `ghcr.io/jstplink/myjournal:latest` +
  `ghcr.io/jstplink/myjournal-pocketbase:latest`, multi-arch amd64/arm64).
- Compose per il NAS: [`deploy/docker-compose.yaml`](deploy/docker-compose.yaml).
- Istruzioni passo-passo: [`deploy/README.md`](deploy/README.md).

I container espongono solo HTTP: metterli dietro il reverse proxy del NAS (o
Cloudflare Tunnel) per HTTPS.

> Se la build su Alpine dovesse fallire per binari nativi (rollup/lightningcss),
> cambiare `node:22-alpine` in `node:22-slim` nel `Dockerfile`.

## Configurazione backend

Istanza PocketBase usata di default: quella **bundled**, avviata insieme al
frontend (vedi sopra). In produzione l'app la raggiunge sulla propria origin
(`/api/...`, inoltrato da nginx); con `npm run dev` tramite il proxy di Vite verso lo
stack Docker locale (`docker compose up -d`, porta 8973; `VITE_DEV_API` per un altro
indirizzo). Endpoint note: `/api/collections/note/records`.

L'indirizzo del server si sceglie nell'app alla prima apertura. Per precompilarlo
nella tua build copia `.env.example` in `.env` e imposta `VITE_PB_URL` (in produzione: build-arg del Dockerfile).
I contatti di supporto in Impostazioni compaiono solo se imposti `VITE_SUPPORT_EMAIL` / `VITE_SUPPORT_TELEGRAM`.

### Collection `note`

Schema definito come codice in [`pb_migrations/`](pb_migrations) — quella è la
fonte di verità; qui un riepilogo:

| Campo       | Tipo               | Note                                          |
| ----------- | ------------------ | ---------------------------------------------- |
| `title`     | testo               | titolo della nota                              |
| `content`   | testo               | corpo (HTML dall'editor rich text)             |
| `mood`      | numero (0–1)        | umore                                          |
| `date`      | data                | giorno a cui è assegnata la nota               |
| `timeStart` | data                | solo l'orario è significativo (vedi `lib/dates.js`) |
| `timeEnd`   | data                | solo l'orario è significativo                  |
| `place`     | testo               | JSON `{name, lat, lon}` (vedi `parsePlace`)     |
| `songs`     | json                | array `{url, title, thumbnailUrl}`             |
| `images`    | file (multipli)     | immagini allegate                              |
| `people`    | relation (multipla) | → collection `people`                          |
| `tags`      | relation (multipla) | → collection `tags`                            |

`people` e `tags` sono collection separate (`name`, più `immichPersonId` su
`people`); `users` ha in più `immichUrl`, `immichApiKey`, `spotifyClientId`,
`spotifyClientSecret`, `geminiApiKey` (tutte opzionali, impostabili da Profilo).

### CORS / Cloudflare Access

Con il proxy integrato (stessa origin) il CORS non entra in gioco. Se invece
usi `VITE_PB_URL` verso un altro host, il browser deve poter chiamare quell'URL
(PocketBase gestisce da solo gli header CORS necessari).
Se in produzione metti PocketBase dietro Cloudflare Access o un WAF, ricordati
che è **il frontend stesso** (il browser di chi usa l'app) a chiamarlo
direttamente: un challenge o una policy troppo restrittiva bloccherebbero
l'app, non solo l'accesso umano diretto. Se compaiono errori di rete sulle
chiamate API (status 0, CORS), **è una configurazione lato server**, non un
problema del codice — l'app mostra comunque un messaggio d'errore esplicito.

## Comportamento delle schermate

- **Login** — email + password, `pb.collection('users').authWithPassword`.
  Sessione persistita in `localStorage`; le rotte sono protette.
- **Vista mensile** (`/`) — pillola anno (tap → cambio anno rapido), nome mese in
  italiano, **navigazione tra mesi via swipe** (o frecce ← → da tastiera). Una
  riga per ogni giorno con almeno una nota: numero + giorno abbreviato (rosso nei
  weekend), barra verticale con la **media dei mood** (gradiente rosso→bianco),
  titoli delle note con `mood > 0.675`, carosello automatico delle immagini del
  giorno. Tap su una riga → vista giornaliera. Footer: solo il pulsante in basso
  a destra è attivo (nuova nota con data odierna).
- **Vista giornaliera** (`/day/:date`) — note del giorno ordinate per orario;
  l'altezza di ogni blocco è **proporzionale alla durata** (`timeEnd - timeStart`)
  sulle 24 ore. Tap su una nota → vista nota in modifica. Footer: nuova nota in
  quel giorno.
- **Vista nota** (`/note/new?date=YYYY-MM-DD` o `/note/:id`) — orari inizio/fine
  editabili, pillola anno/data (anno modificabile), slider `mood`, titolo, editor
  Markdown con anteprima, persone, immagini. Pulsante in alto a destra:
  **verde** = salva (nota nuova o con modifiche), **rosso** = elimina (nota
  esistente non modificata). Footer: solo "aggiungi immagini" è attivo.

## Struttura

```
src/
  lib/         pocketbase.js (client: server o locale), backend.js, localPocketBase.js,
               notes.js, mood.js (formula del mood), navStack.js, dates.js, gemini.js, ...
  context/     AuthContext.jsx, NavContext.jsx
  hooks/       useIsWide, useBack (indietro a pila), useAutoDraft, ...
  components/  PhoneShell, DraftsTab, NavStack, Toaster, ExistingMatches, selettori (persone,
               tag, luoghi, immagini), Gemini, ...
  pages/       Login, BackendChooser, MonthView, DayView, NoteView, DataView, StatsView,
               FilterView, Profile, MoodLab; pages/web/ = varianti desktop
public/
  mood-lab.html  banco di prova della formula del mood (aperto da /mood-lab)
pb_migrations/ schema di PocketBase (campi, regole)
pb_hooks/      recap con Gemini (cron serale)
scripts/       icone PWA e Android, suoni
```

Per i dettagli (formule, navigazione, backend locale, deploy) vedi [ARCHITETTURA.md](ARCHITETTURA.md).

## Non incluso (fasi successive)

Pubblicazione su Play Store (l'app Android è un APK di debug, vedi `ARCHITETTURA.md` §8); HTTPS/reverse proxy (demandato all'infrastruttura del NAS).
