# MyJournal – Guida all'uso

Guida per chi usa l'app. Per com'è fatta dentro e per rispondere a domande tecniche vedi [ARCHITETTURA.md](../ARCHITETTURA.md);
la cronologia delle versioni è in `src/lib/changelog.js` (visibile in app: Impostazioni → Novità).

## 1. Cos'è

MyJournal è un **diario personale** (PWA: funziona dal browser e si installa su telefono). Ogni giorno può avere più **note**, ognuna con
titolo, testo, **umore** (mood), orario di inizio e fine, immagini, persone, tag, luogo e canzoni. L'app mostra le note per mese, per
giorno, in statistiche e in una ricerca. Non c'è nessuna parte social: i dati sono **tuoi**: alla prima apertura scegli se tenerli
**su questo dispositivo** (nessun server, nessun account) o **sul tuo server** (scrivi tu l'indirizzo, per esempio quello di casa tua sul NAS).
Si cambia da Impostazioni → Account. Sul dispositivo, se cancelli i dati dell'app o del browser li perdi: usa ogni tanto Esporta.

Ogni schermata ha due versioni: **mobile** (schermo stretto) e **web/desktop** (con barra laterale). Il contenuto è lo stesso; il
passaggio è automatico in base alla larghezza della finestra.

## 2. Accesso

- Pagina di **Accedi / Registrati** (le due schede in alto) con email e password. La password deve avere almeno **5 caratteri**. Ogni account vede solo i propri dati.
- **Ho dimenticato la password** (sotto «Entra», solo con i dati su un server): scrivi l'email e ricevi un link che apre la pagina «Nuova password». Funziona solo se chi gestisce il server ha configurato l'invio delle mail (SMTP in PocketBase).
- Alla scelta del server scrivi solo l'indirizzo (per esempio `myjournal.tuodominio.it`) e scegli `https://` o `http://` con l'interruttore; «Usa questo sito» compila l'indirizzo della pagina in cui sei. Nella versione web, con i dati su un server, l'indirizzo e «Cambia» stanno sotto le password.
- La sessione resta salvata; senza rete l'app si apre comunque con i dati in locale (vedi §9).

## 3. Le schermate

| Schermata | Percorso | Cosa fa |
|---|---|---|
| **Calendario** (mese) | `/` | Un foglio per ogni giorno con note: umore medio, titoli, persone, luogo, canzone, foto. Le persone sono targhette di colori diversi (uno per persona); se in un giorno sono più di 4 se ne vedono 3 e una targhetta «+x persone» per le altre. Si cambia mese con le frecce o scorrendo; l'app apre sul mese corrente. In cima "In questo giorno" (note degli anni passati) e il recap del mese. |
| **Giorno** | `/day/AAAA-MM-GG` | Le note del giorno su una timeline di 24 ore (altezza del blocco = durata; l'anteprima del testo di ogni nota rispetta gli a capo, le righe vuote, gli spazi e gli elenchi come sono scritti nella nota); un giorno senza note mostra comunque la timeline, vuota, e il blocco «Recap del giorno». I titoli lunghi vanno su due righe (nell'editor della nota il titolo va a capo da solo). Recap del giorno in cima. |
| **Nota** | `/note/new?date=…` e `/note/:id` | Editor: data, orari, mood, titolo, testo, e i pulsanti per immagini, persone, tag, canzoni, luogo. Salva (verde) o elimina (rosso). |
| **Andamento** | `/dati` | Grafico dell'umore nell'anno e mese per mese; da web ogni barretta apre quel giorno. |
| **Statistiche** | `/statistiche` | Persone più presenti, giorni/settimane/mesi migliori e peggiori, note migliori e peggiori, tag e luogo più usati, note per mese, recap dell'anno. Ogni voce cliccabile apre le note corrispondenti. |
| **Cerca** | `/filtri` | Filtri per periodo, mood, testo, luogo, persone, tag, canzoni; ordinamento e numero massimo di risultati. |
| **Importa** (solo web) | `/importa` | Migrazione di note da uno screenshot (Gemini) o da un foglio di calcolo esportato (TSV/CSV). |
| **Impostazioni** | `/profilo` | Aspetto, dati utente, integrazioni, uso offline, novità, archivio e account. |
| **Mood Lab** (nascosto) | `/mood-lab` | Banco di prova della formula del mood; vedi §5. |

**Indietro.** Il tasto/gesto «indietro» di Android e le frecce dell'app risalgono a livelli: nota → giorno (o Cerca/Impostazioni) → schermata principale (Calendario, Andamento o Statistiche); prima si chiude l'eventuale pannello aperto. Cambiare giorno con le frecce non aggiunge livelli. Dalla schermata principale il tasto di Android esce dall'app.

## 4. Scrivere una nota

- **Data e orari:** la data si sceglie dal calendario; inizio e fine con il selettore a rotella (minuti a multipli di 5). Gli orari
  sono "da orologio", senza fusi.
- **Mood:** un righello da 0 a 10 (salvato come 0–1). Il colore della nota, nel mese e nel giorno, segue il gradiente del mood.
- **Elenchi puntati:** scrivendo «-» e uno spazio a inizio riga compare un punto elenco, sulla stessa riga (Invio aggiunge un altro punto, Invio su un punto vuoto esce dall'elenco).
- **Testo:** editor con Markdown/anteprima. Dal menu Gemini si può ripulire/sintetizzare il testo o scriverlo da un prompt; si può
  anche **dettare a voce** (la registrazione la trascrive Gemini, fino a **120 secondi** per registrazione: il pulsante è la barra, mostra il tempo che passa e si riempie da sinistra; negli ultimi 30 secondi si allarga mostrando quanto manca, diventa rosso e lampeggia, e il telefono vibra a 30, 20, 10 e 5 secondi dalla fine; ogni vocale viene **salvato sul dispositivo** appena finisci di registrare e si cancella solo quando la trascrizione riesce: se Gemini è intasato o ha finito le richieste, sotto il pulsante compare l'elenco dei vocali non ancora trascritti, con «Trascrivi» ed «Elimina», anche dopo aver chiuso il pannello o l'app).
- **Immagini:** dal dispositivo oppure da **Immich** (se collegato). Il selettore di Immich si apre sul **giorno della nota** che stai scrivendo; in cima il pulsante «Giorni successivi» e in fondo «Giorni precedenti» caricano altri 3 giorni per volta, nel caso le foto siano state caricate dopo o prima. Il campo «Vai al giorno» salta a un altro giorno e «Mostra tutte» torna all'elenco delle più recenti. Toccando una foto della nota (anche da web) si apre a schermo intero.
- **Persone, tag, canzoni:** si scelgono da elenchi (le persone più usate sono in cima); persone e tag nuovi si creano al volo. Le
  canzoni si cercano su Spotify (se collegato) o si incolla un link.
- **Luogo:** vedi §6.
- **Nuova nota con Gemini:** dal pulsante "nuova nota" si può scegliere tra manuale e Gemini: scrivi un prompt e la bozza arriva già con
  titolo, testo, tag, persone e luogo, tutto da rivedere prima di salvare.
- **Note in sospeso:** una nota nuova che chiudi senza salvare (ad esempio con Indietro per sbaglio, o con la ✕ del pannello Gemini) non va persa: si salva da sola, compare un
  avviso a centro schermo e la nota appare nella linguetta con la **matitina** sul bordo destro (icona matita = a mano, scintille = Gemini, con testo e vocali), da riprendere con un tocco o scartare col cestino. Sono sul dispositivo; le immagini non si conservano e vanno
  riaggiunte. Spariscono quando la nota viene salvata.
- **Persone, tag, luoghi:** mentre scrivi il nome da aggiungere compaiono quelli già presenti che combaciano; se il nome esiste già non si crea una copia (nei selettori viene scelto). Tag e luoghi sono in ordine alfabetico su 2 colonne (3 da web).
- **Bollino del mood:** nella vista giorno un cartoncino quadrato in alto a destra mostra il mood calcolato del giorno (0–100).
- **Vocali:** dopo la registrazione il vocale resta salvato con un titolo e lo trascrivi quando vuoi con «Trascrivi»; nella nota con Gemini i vocali già trascritti restano finché non salvi la nota.
- **Senza rete:** il salvataggio va in coda e si sincronizza da solo (vedi §9).

## 5. Impostazioni

- **Suoni:** in Aspetto si accendono o spengono (sì/no); nella sezione **Suoni** si regola il volume (con un tasto per provarlo). Sono per dispositivo e comprendono il «tic» dei pulsanti, il cambio mese/anno, l'apertura di giorni e note, il salvataggio e l'eliminazione delle note e la dettatura vocale. Il suono della notifica dei promemoria è una campanella a parte e segue il volume delle notifiche del telefono.
- **Aspetto:** animazioni (sì/no/sistema), suoni (sì/no) e sfondo: **Nessuno, Puntini, Righe, Quadretti** oppure **Immagine** (una tua foto, che resta solo sul dispositivo). Sono preferenze **per dispositivo**. Per ora l'app è solo **chiara**, col carattere **tondeggiante** e il cursore di sistema: non si scelgono più.
- **Dati utente** (sincronizzati sull'account): **Colori del mood** (sei colori e le soglie), **Persone**, **Tag**, **Luoghi** (anche
  modifica di nome e posizione, che si propaga alle note), **Canzoni** (sola lettura, con quante note le usano). Cancellare una persona
  o un luogo collegato a delle note chiede se sostituirlo o toglierlo ovunque.
- **Integrazioni:** Immich, **MyMap**, Spotify, Gemini (vedi §6–§8).
- **Account:** dice dove sono i tuoi dati (su questo dispositivo o sul tuo server) e permette di cambiare; «Esci» c'è solo con un server.
- **Mood Lab (nascosto):** in fondo alle Impostazioni, toccando 5 volte di seguito la riga «MyJournal · versione», si apre il Mood Lab: un banco di prova per la formula del mood con dati di esempio (non tocca le tue note). Con **Applica all'app** la formula che hai impostato (curva delle note, peso di durata e persone, curva dei giorni nel mese) diventa quella di tutto il tuo account; **Formula originale** la ripristina.
- **Uso offline**, **Novità** (changelog), **Esporta** (JSON o Markdown di tutto il diario) e **Account** (cambio nome, email e password;
  esci; elimina account con doppia conferma, che cancella anche note, persone e tag).

## 6. Luoghi e integrazione MyMap

Il luogo di una nota è un nome con coordinate. Dal pulsante "Luogo" si apre il selettore:

- **MyJournal:** cerchi un posto per nome (OpenStreetMap), tocchi un punto sulla mappa (anche senza indirizzo, il nome lo scrivi tu) o
  riusi un **luogo salvato**. Il luogo scelto finisce anche nell'elenco in Impostazioni → Luoghi.
- **MyMap:** (compare solo se l'integrazione è configurata) propone i **posti visitati nel giorno della nota**, cioè le soste di almeno
  20 minuti registrate da MyMap, con orario e durata. Le frecce cambiano giorno. Tocchi un posto: compare sulla mappa col nome
  modificabile, poi "Aggiungi". Il nome è quello che hai dato a mano in MyMap, altrimenti viene cercato su OpenStreetMap.
  L'ultima sorgente usata viene ricordata.

**Collegare MyMap** (Impostazioni → Integrazioni → MyMap): servono **URL del server MyMap** (HTTPS, senza barra finale: è lo stesso
indirizzo che inserisci nell'accesso di MyMap, ad esempio `https://pocketbase.tuodominio.it`), **email** e **password** dell'account
MyMap. Presuppone che MyMap sia usata con un account sul tuo server (non solo "su questo telefono"). C'è una guida scaricabile nella
sezione stessa.

- **Testa connessione** verifica l'accesso e mostra quanti **punti** ci sono sul server e quanti **nomi dati a mano** (i nomi dei posti
  che hai assegnato in MyMap). Funziona anche prima di salvare.
- **Salva** scrive i dati sul tuo profilo MyJournal. Se il server non ha ancora i campi MyMap (versione dell'app non ancora pubblicata),
  lo segnala e non svuota gli input.

**Problemi comuni**

| Sintomo | Causa e rimedio |
|---|---|
| "Impossibile raggiungere il server MyMap" | URL sbagliato o non raggiungibile (deve esistere nel DNS ed essere HTTPS). Usa l'indirizzo che hai in MyMap. |
| "Email o password di MyMap non valide" | Sono quelle dell'account **MyMap**, che può avere una password diversa da quella di MyJournal. |
| Salvando i campi si svuotano / errore sui campi | Il database di produzione non ha ancora la migration dei campi MyMap: pubblica la nuova versione (push su `main`, poi `docker compose pull && docker compose up -d` sul NAS). |
| Nel selettore vedo i nomi di OpenStreetMap e non i miei | I tuoi nomi non sono arrivati sul server: in MyMap devi essere collegato al server e le impostazioni risultare "Salvate nel profilo" (dare di nuovo un nome forza il salvataggio). "Testa connessione" dice quanti nomi trova. Il nome si abbina al posto entro 150 m. |
| "Nessun posto registrato" in un giorno | Servono soste di almeno 20 minuti con il tracking attivo; prova a cambiare giorno con le frecce. |

## 7. Immich e Spotify

- **Immich:** URL del server + API key (Immich → Account → API Keys). Serve per scegliere foto e importare le persone riconosciute.
- **Spotify:** Client ID e Client Secret di un'app creata su developer.spotify.com (solo ricerca nel catalogo). Se li rimuovi **le canzoni già aggiunte restano**: stanno dentro ogni nota (titolo, link e copertina) e non dipendono dalle credenziali; perdi solo la ricerca dei brani — l'aggiunta incollando il link di un brano continua a funzionare, perché non richiede nessuna chiave.
Entrambe hanno una guida scaricabile nella rispettiva sezione.

## 8. Gemini (IA)

Serve una **chiave API** di Google AI Studio (Impostazioni → Integrazioni → Gemini). Abilita: ripulire/sintetizzare il testo, scrivere da
un prompt, "Nuova nota con Gemini", dettatura vocale, estrazione note da screenshot (Importa) e i **recap automatici**:

- Quando scrivi, modifichi (descrizione o mood) o elimini una nota, i recap toccati vengono **segnati da aggiornare**: il giorno e, se sono già
  finiti, anche il suo mese e il suo anno (il mese e l'anno in corso si riassumono quando finiscono: il primo del mese o dell'anno).
  Ogni sera alle **23:00** il server li rigenera tutti insieme, con **una sola richiesta a Gemini**: così consuma poche richieste. Se Gemini non
  risponde, riprova alle 23:20 e alle 23:40.
- I periodi chiusi **prima** che la funzione esistesse non hanno recap: si generano a mano col tasto "Genera/Rigenera" nelle viste.
- Se una richiesta a Gemini fallisce per un intoppo momentaneo (server sovraccarico, rete, limite al minuto) l'app riprova da sola dopo 3, 5, 7 e 9 secondi: in tutto 5 tentativi prima di mostrare l'errore. Non riprova se la chiave non è valida o se il limite giornaliero è esaurito.
- Una linguetta sul bordo destro («Aggiornamento recap alle 23.00») ricorda che i recap sono in attesa e, toccandola, li elenca: prima i giorni, poi i mesi, poi gli anni. Se non vuoi aspettare, il tasto "Genera/Rigenera" nelle viste
  lo fa subito.
- **Vocali di «Nuova nota con Gemini».** I vocali restano sul dispositivo finché non li trascrivi, anche se chiudi il pannello (anche mentre registri o trascrivi). Salvando la nota la bozza sparisce solo quando non restano vocali da trascrivere; altrimenti resta nella linguetta a destra con i vocali rimasti.
- **Gemini intasato.** Dopo due tentativi falliti sul modello principale l'app prova da sola un altro modello Gemini «flash» (l'elenco lo chiede a Google), poi un secondo, poi torna al principale. Non serve fare nulla.
- **Groq per i vocali (Impostazioni → Groq).** Con una chiave Groq i vocali si trascrivono con Whisper (`whisper-large-v3-turbo`, in italiano), molto più veloce e quasi mai intasato; se Groq non risponde si ripiega su Gemini (se c'è la chiave). Come ottenere la chiave: `console.groq.com` → API Keys → Create API Key (piano gratuito, nessuna carta); nell'app il pulsante «Come ottenerlo (guida)» scarica i passaggi. Note, recap e il resto restano a Gemini. Non è «Grok» di X: serve Groq, con la Q.
- **Vocali senza nota.** I vocali registrati e non ancora trascritti che non appartengono a una nota in sospeso compaiono nella linguetta a destra come «x vocali da trascrivere»: un tocco li trasforma in una nota Gemini in sospeso (di oggi) e apre il pannello.
- **Contatore richieste.** L'app conta le richieste a Gemini partite da questo telefono/computer (ultimo minuto, ultima ora, ultime 24 ore) e le mostra sotto il pulsante del vocale, nei pannelli dove scrivi una nota con Gemini e in Impostazioni → Gemini → «Richieste a Gemini». Non include i recap delle 23:00 né altri dispositivi con la stessa chiave.
- Le "Istruzioni per i riassunti" (Impostazioni → Gemini) valgono per tutti i recap di giorno, mese e anno, anche per quelli scritti dal server. Modificando una nota il recap si rifà solo se cambiano descrizione o mood.
- Le "Istruzioni per le note" (tono, cosa evidenziare) valgono per tutte le richieste e si modificano anche al volo nei pannelli.

## 9. Uso offline e connessione debole

All'apertura l'app scarica in locale note, persone, tag, luoghi e miniature. Con rete assente o lenta mostra subito i dati salvati e li
aggiorna in background. Le **linguette** sul bordo destro avvisano di connessione debole/assente e di modifiche in coda (toccandole si
riprova), dei recap in aggiornamento e delle bozze. Le note salvate offline restano in coda e si inviano da sole al ritorno della rete. **Nell'app Android** note, persone, tag e luoghi si salvano nell'archivio privato dell'app sul telefono (sopravvivono alla chiusura e al riavvio), e così le note in coda; le **foto** invece no: senza service worker le miniature non vengono servite dalla cache, quindi offline non si vedono. In Impostazioni → Uso offline: spazio
occupato, numero di note e miniature, "Aggiorna ora" e "Svuota cache".

## 10. App Android

Oltre alla PWA esiste un'app Android (file **APK**) con lo stesso account e gli stessi dati.

- **Installazione:** da web, Impostazioni → **App Android** → "Scarica l'app per Android". Apri il file dal telefono e, se richiesto,
  consenti l'installazione da questa fonte. L'APK è "di debug", firmato con la chiave di debug del PC su cui è compilato: per aggiornare
  l'app installa il nuovo APK sopra il vecchio. Se Android rifiuta l'aggiornamento (firma diversa) disinstalla prima l'app.
- **Permessi:**
  - **Microfono:** serve per "Detta un vocale" nelle note con Gemini. Android lo chiede alla prima registrazione; se l'hai negato:
    Impostazioni del telefono → App → MyJournal → Autorizzazioni → Microfono. Un APK vecchio, senza il permesso nel manifest, non lo
    chiede mai: va reinstallata la versione nuova.
  - **Notifiche:** servono per i promemoria (Android 13+ le chiede alla prima attivazione).
- **Widget "Nuova nota":** aggiungilo dalla schermata home (due formati). Un tocco apre l'app sulla scelta Gemini / a mano. Tutti e tre i widget (2×1, 1×1 e il 3×1 "MyJournal") hanno la loro anteprima nel selettore dei widget.
- **Widget 3×1 "MyJournal":** tre blocchi. **A sinistra** il mood dell'ultima settimana (in centesimi, da 0 a 100, con un quadratino di carta del colore del tuo gradiente e quanti giorni e note ha considerato; toccandolo si apre Andamento); **al centro** l'ultima nota: il giorno ("oggi", "ieri" o la data) e l'ora in cui è finita (toccandola si apre quel giorno); **a destra** il pulsante giallo in rilievo, un po' storto, per scrivere una nota nuova: è appeso a un chiodo e ondeggia piano, senza scatti, con 4 secondi di pausa fra un'oscillazione e l'altra. Nel selettore dei widget l'anteprima mostra il widget con dati d'esempio. Si aggiorna quando apri l'app, la riporti in primo piano o salvi/elimini una nota: una nota scritta da un altro dispositivo compare alla prossima apertura.
- **Statistiche più ariose:** i numeri grandi delle schede in cima non sono più attraversati dalla linea tratteggiata.
- **Foto che dondolano:** nelle viste Calendario e Giorno le polaroid oscillano a destra e a sinistra quando inclini il telefono (sono appese al nastro). Si spegne da Impostazioni → Permessi → Giroscopio, o disattivando le animazioni.
- **Permessi:** Impostazioni → **Permessi** mostra cosa hai concesso all'app (microfono, notifiche, allarmi precisi, risparmio batteria) e se il giroscopio c'è (Android non chiede nessun permesso per quello), a cosa serve, e ha il pulsante per concederlo o per aprire la schermata di Android dove si cambia. Si aggiorna da solo quando torni nell'app.
- **Promemoria:** Impostazioni → **Promemoria** (solo nell'app). Uno o più orari con i giorni della settimana (da lunedì) e, per ciascuno, il **testo della notifica** che preferisci (vuoto = quello predefinito); la notifica "scrivi la nota
  del giorno" arriva anche ad app chiusa e senza rete, e toccandola si apre la scelta Gemini / a mano. Sono salvati sul dispositivo.
- **Vibrazione:** un tocco leggero sui pulsanti d'azione e sui tasti «indietro» (non su schede, filtri e selezioni).
- **Linguette sul bordo destro:** toccandole si aprono (o si chiudono) con un piccolo scatto e un suono, se i suoni sono accesi.
- **Vibrazione:** anche cambiando scheda di vista (Calendario / Andamento / Statistiche); dal widget un tic leggero appena l'app si apre dal tasto toccato.
- **Aggiorna tirando:** nella vista mese (telefono) tira verso il basso per rileggere le note dal server.
- Dentro l'app non c'è service worker: l'interfaccia è nell'APK e si aggiorna installando un nuovo APK; i dati arrivano sempre dal
  server che hai scelto (o dal dispositivo, in modalità locale).

## 11. Importare vecchie note (solo web)

- **Da immagine:** screenshot di un vecchio diario; Gemini estrae le note, tu le rivedi e salvi.
- **Da foglio (testo):** export TSV/CSV di Google Fogli (una riga = un giorno). Si indicano le colonne (mese, giorno, testo, titolo,
  voto 0–100). Uno script locale prepara una nota per giorno, riconoscendo persone e tag già presenti. I giorni che hanno già note
  vengono saltati, quindi si può ridare lo stesso file. I file caricati restano in una libreria personale.

## Novità della serie 0.74–0.75 in breve

- **Dove tieni i dati:** alla prima apertura scegli «Su questo dispositivo» o «Sul mio server» (vedi §1).

- **Note a cavallo della notte:** una nota che inizia alle 22 e finisce alle 3 del giorno dopo compare in entrambi i giorni (nel secondo parte da mezzanotte, con la scritta «continua dalla notte»).
- **Nuova nota con Gemini:** se chiudi il pannello con la ✕ il testo e i vocali restano come **bozza** (te lo dice un avviso). La linguetta a destra elenca le note Gemini in sospeso con il giorno a cui appartengono (il giorno aperto quando hai premuto «nuova nota», altrimenti oggi): tocca per riprenderle.
- **Vocali:** finita la registrazione il vocale resta salvato con un titolo (modificabile) e lo trascrivi quando vuoi con «Trascrivi».
- **Titoli:** le note hanno sempre il titolo in maiuscolo.
- **Mood Lab (nascosto):** in fondo alle Impostazioni, toccando 5 volte di seguito la riga «MyJournal · versione», si apre un banco di prova per la formula del mood con dati di esempio (non tocca le tue note). Con **Applica all'app** la formula che hai impostato (curva delle note, peso di durata e persone, curva dei giorni nel mese) diventa quella di tutto il tuo account; **Formula originale** la ripristina.

## Novità della serie 0.78 in breve

- **Calendario, persone:** le targhette dei nomi hanno colori diversi (una tonalità per persona); se in un giorno le persone sono più di 4 se ne vedono 3 e una targhetta «+x persone» per le altre. Le targhette non finiscono più sopra il cartoncino del mood, nemmeno con titoli lunghi.
- **Calendario (web):** l'etichetta del mood e le foto non sono più tagliate ai lati nelle pagine con il bordo strappato; i titoli delle note sono più piccoli del 10%.
