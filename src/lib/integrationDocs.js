// Piccole guide scaricabili su come ottenere i token/credenziali delle
// integrazioni. Il testo è Markdown; viene scaricato come file .md dal
// pulsante "Come ottenere il token" nelle Impostazioni (web e mobile).

const GEMINI = `# Chiave API Gemini (Google AI Studio)

A cosa serve in MyJournal: ripulire e sintetizzare il testo delle note,
riconoscere le persone citate, generare bozze di note, ed estrarre note da
uno screenshot nella schermata "Importa da immagine".

## Come ottenerla

1. Apri https://aistudio.google.com/app/apikey e accedi con un account Google.
2. Premi "Create API key" (o "Crea chiave API").
3. Scegli un progetto Google Cloud esistente oppure lascia che ne crei uno nuovo.
4. Copia la chiave: è una stringa che inizia con "AIza...".
5. In MyJournal: Impostazioni -> Integrazioni -> Gemini -> incolla la chiave e premi Salva.
   Usa "Testa connessione" per verificare che funzioni.

## Note

- L'uso di base dei modelli Gemini via API ha un piano gratuito con limiti di
  richieste al minuto/giorno; oltre quei limiti servono le fatturazioni Google Cloud.
- La chiave e' personale: chiunque la possieda puo' consumare la tua quota.
  Non condividerla e non pubblicarla.
- Per revocarla o crearne un'altra torna sulla stessa pagina di Google AI Studio.
`

const SPOTIFY = `# Credenziali Spotify (Client ID e Client Secret)

A cosa servono in MyJournal: cercare i brani per titolo/artista e recuperarne
copertina e link quando aggiungi una canzone a una nota. Vengono usate solo
per la ricerca pubblica del catalogo: nessun accesso al tuo account, ai tuoi
ascolti o alle tue playlist.

## Come ottenerle

1. Apri https://developer.spotify.com/dashboard e accedi con il tuo account Spotify.
2. Premi "Create app".
3. Compila nome e descrizione a piacere (es. "MyJournal diario").
4. Come "Redirect URI" puoi mettere un valore qualsiasi, ad esempio
   http://localhost:5173 : con il flusso "Client Credentials" non viene usato.
5. Accetta i termini e crea l'app.
6. Nella pagina dell'app apri "Settings": lì trovi il "Client ID" e, cliccando
   "View client secret", il "Client Secret".
7. In MyJournal: Impostazioni -> Integrazioni -> Spotify -> incolla entrambi i
   valori e premi Salva. Usa "Testa connessione" per verificare.

## Note

- Il Client Secret e' una password: tienilo privato.
- Se lo rigeneri dalla dashboard, ricordati di aggiornarlo anche in MyJournal.
`

const IMMICH = `# Collegamento a Immich (URL server + API key)

A cosa serve in MyJournal: scegliere le foto direttamente dal tuo Immich quando
aggiungi immagini a una nota, e usare i volti riconosciuti da Immich come
elenco di persone.

Prerequisito: devi gia' avere un'istanza Immich funzionante e raggiungibile
dal dispositivo su cui usi MyJournal (stessa rete, VPN, o esposta su internet).

## URL server

E' l'indirizzo con cui apri Immich nel browser, comprensivo di http:// o
https:// e, se presente, della porta. Esempi:
- https://immich.tuodominio.it
- http://192.168.1.20:2283

## API key

1. Apri Immich nel browser e accedi.
2. Clicca sul tuo avatar in alto a destra -> "Account Settings"
   (Impostazioni account).
3. Apri la sezione "API Keys".
4. Premi "New API Key", dai un nome (es. "MyJournal") e conferma.
5. Copia subito la chiave mostrata: non sara' piu' visibile per intero dopo.
6. In MyJournal: Impostazioni -> Integrazioni -> Immich -> incolla URL e API key
   e premi Salva. Usa "Testa connessione" per verificare.

## Note

- L'API key da' accesso in lettura alle tue foto tramite l'API di Immich:
  tienila privata.
- Puoi revocarla in qualsiasi momento dalla stessa pagina "API Keys" di Immich.
- Se MyJournal non raggiunge il server, il problema e' quasi sempre di rete
  (URL sbagliato, server non esposto, HTTPS con certificato non valido).
`

const MYMAP = `# Collegamento a MyMap (URL server + email + password)

A cosa serve in MyJournal: quando aggiungi un luogo a una nota, puoi scegliere
tra i posti in cui sei stato nel giorno della nota (soste di almeno 20 minuti
registrate da MyMap) invece di cercarli o scriverli a mano.

Prerequisito: usa MyMap con un account sul TUO server (modalita' "Il mio
server"). Con il solo database locale del telefono non c'e' nulla da leggere.

## Cosa serve

1. URL server MyMap: lo stesso indirizzo che inserisci nella schermata di
   accesso di MyMap (il suo PocketBase), con https:// e senza barra finale.
   Esempio: https://pocketbase.tuodominio.it
   Deve essere HTTPS, altrimenti il browser blocca la richiesta da MyJournal.
2. Email dell'account MyMap: quella con cui accedi in MyMap.
3. Password dell'account MyMap: serve ad MyJournal per leggere i tuoi punti
   (la collection "points" e' leggibile solo dal proprietario).

## Come collegarlo

1. In MyJournal: Impostazioni -> Integrazioni -> MyMap.
2. Inserisci URL, email e password e premi "Testa connessione": se tutto va
   bene vedi quanti punti ci sono sul server.
3. Premi Salva.
4. Quando crei o modifichi una nota e tocchi il segnaposto "Luogo", in alto
   compare la scelta tra "MyJournal" e "MyMap". Con MyMap vedi i posti del
   giorno della nota (con i tasti freccia puoi cambiare giorno): toccane uno
   per sceglierlo, il nome resta modificabile prima di aggiungerlo.

## Come si trovano i nomi

- Se in MyMap hai dato un nome a mano a quel posto, viene usato quello.
- Altrimenti il nome viene cercato su OpenStreetMap (Nominatim) a partire
  dalle coordinate; se non c'e' o non ti va bene lo scrivi tu.

## Note

- La password e' salvata nel tuo profilo MyJournal, come la API key di Immich:
  non riusarla altrove se ti preoccupa.
- I posti sono calcolati da MyJournal con le stesse regole di MyMap (sosta di
  almeno 20 minuti entro 150 m); un posto puo' apparire solo se in quel giorno
  il tracking ha registrato abbastanza punti.
`

export const INTEGRATION_DOCS = {
  gemini: { filename: 'myjournal-gemini-token.md', body: GEMINI },
  spotify: { filename: 'myjournal-spotify-credenziali.md', body: SPOTIFY },
  immich: { filename: 'myjournal-immich-collegamento.md', body: IMMICH },
  mymap: { filename: 'myjournal-mymap-collegamento.md', body: MYMAP },
}

// Scarica una stringa come file di testo (client-side, nessun server).
export function downloadTextFile(
  filename,
  text,
  mime = 'text/markdown;charset=utf-8',
) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Comodo: scarica la guida di una specifica integrazione.
export function downloadIntegrationDoc(key) {
  const doc = INTEGRATION_DOCS[key]
  if (doc) downloadTextFile(doc.filename, doc.body)
}
