// Changelog dell'app, mostrato in Impostazioni -> Novità.
// Voci dalla più recente alla più vecchia. La versione in package.json e la
// voce qui sotto si aggiornano AL MOMENTO DEL COMMIT (non durante lo
// sviluppo); `date` è data + ora del commit ("YYYY-MM-DD HH:MM").
//
// Le versioni minori/di sola rifinitura vengono accorpate qui in un'unica
// voce (invece di una per ogni commit) per tenere l'elenco leggibile — il
// numero di versione riportato è quello dell'ultimo commit del gruppo.

export const CHANGELOG = [
  {
    version: '0.81.11',
    date: '2026-10-14 14:00',
    changes: [
      "Calendario: l'evidenziatore sotto il giorno della settimana torna visibile (web e telefono).",
      "Calendario su telefono: disegni di sfondo più grandi.",
    ],
  },
  {
    version: '0.81.10',
    date: '2026-10-14 13:40',
    changes: [
      "Calendario su telefono: niente scritte sugli sfondi, restano disegni (all'intensità originale) e macchie di caffè; nuvoletta del sogno più staccata dal bordo e giorno di nuovo basso.",
      "Calendario web: nuvoletta del sogno ancora più staccata dal bordo destro.",
    ],
  },
  {
    version: '0.81.9',
    date: '2026-10-14 13:05',
    changes: [
      "Calendario su telefono: i decori di sfondo (alberi, animali, frammenti di testo) si vedono sui giorni segnati e non più sui giorni senza note.",
      "Calendario web: nuvoletta del sogno più staccata dal bordo destro e meno spazio fra il giorno e il cartoncino.",
      "Calendario web: macchie di caffè più trasparenti del 20% e gli altri decori di sfondo del 15%.",
    ],
  },
  {
    version: '0.81.8',
    date: '2026-10-14 20:10',
    changes: [
      "Icona dell'app Android: lo sfondo non è più grigio scuro ma ha una leggera tinta cartoncino (grigio-kaki caldo).",
      "Calendario: la nuvoletta del sogno sta in alto a destra del foglio, sopra le foto (su telefono più piccola); più aria fra il nome del giorno e il cartoncino delle note.",
    ],
  },
  {
    version: '0.81.7',
    date: '2026-10-14 19:40',
    changes: [
      "Widget Android: ripristinata l'estetica di prima (sfondo a quadretti, quadratino di carta del mood, pulsante appeso al chiodo). Restano la larghezza 4×1 e il mood calcolato sugli ultimi 3 giorni.",
    ],
  },
  {
    version: '0.81.6',
    date: '2026-10-14 19:10',
    changes: [
      "Sogni: il segnalino della luna ora è una nuvoletta (nel Calendario e nel Giorno), con lo stesso spessore di contorno della nuvoletta col titolo; nel Calendario è più staccato dal nome del giorno.",
    ],
  },
  {
    version: '0.81.5',
    date: '2026-10-14 18:20',
    changes: [
      "Calendario: la lunetta del sogno sta accanto al nome del giorno (e non si perde più sotto foto, persone o canzoni).",
      "Giorno: testo della nuvoletta e luna +20%, contorno celeste uguale per pallino, bolle e nuvoletta, e al passaggio del mouse la nuvoletta ondeggia e il pallino pulsa per far capire che si può aprire.",
      "Sogni: nella ricerca si vede il testo e non più l'HTML; il testo incollato non porta più font e colori suoi (carattere tondeggiante e colore più chiaro); nuovo colore del titolo; «Nitidezza» su web più piccola del 30%.",
    ],
  },
  {
    version: '0.81.4',
    date: '2026-10-14 17:10',
    changes: [
      "Sogno, web: «Nitidezza» più grande e senza «sfocato» e «nitido»; giorno e orario dritti; via la scritta sull'orario; indietro, anno e «Segna il sogno» lontani dal bordo; sullo sfondo costellazioni, lune, nuvolette e stelle. Più spazio sopra ai pulsanti e righe del foglio più leggere.",
    ],
  },
  {
    version: '0.81.3',
    date: '2026-10-14 16:20',
    changes: [
      "Sogno, web: la cartella scura dietro la barra laterale ora sta sopra al cielo celeste; «Indietro» e «Segna il sogno» hanno lo stile e la misura degli altri pulsanti dell'app; anno, giorno e orario sono più grandi.",
      "Sogno, telefono: la targhetta dell'anno è più grande e il cielo va da bordo a bordo, senza la carta ai lati sugli schermi più larghi.",
    ],
  },
  {
    version: '0.81.2',
    date: '2026-10-14 15:10',
    changes: [
      "Sogno, web: il cielo celeste occupa tutta l'area, senza la carta a righe sotto; tolto il pulsante del microfono.",
      "Sogno, telefono: il microfono è un pallino celeste fisso in basso al centro (rosso e pulsante mentre registra); indietro e salva hanno la misura degli altri tasti dell'app; giorno e orario sono pendagli con l'etichetta, si toccano e i selettori si aprono dentro lo schermo; la barra della nitidezza ha la scritta «Nitidezza» al centro, senza «sfocato» e «nitido».",
    ],
  },
  {
    version: '0.81.1',
    date: '2026-10-14 13:30',
    changes: [
      "Pagina del sogno rifatta: sfondo a onde celesti, festone con i pendagli (giorno e orario storti, appesi), anno in una lunetta, foglio tondo con le Z che salgono e fascia di nuvole e stelle in basso. Niente più barra rigida.",
      "Nitidezza con una barra nuova: puntini che da sfocati diventano nitidi, con un anello giallo come cursore.",
    ],
  },
  {
    version: '0.81.0',
    date: '2026-10-14 12:30',
    changes: [
      "Sogni: nuova voce «Sogno» in «Nuova nota». La pagina è come quella della nota (data e orario, righello della nitidezza, foglio con titolo e descrizione, anche a voce) in versione celeste. Se non sai a che ora, lascia 00:00.",
      "I sogni compaiono nel Calendario (una lunetta sul giorno) e nel Giorno (pallino con la luna sull'asse e nuvoletta col titolo, senza orario). In Cerca c'è il filtro «Mostra» Note / Sogni / Tutto e in Statistiche il contatore dei sogni dell'anno. Non entrano nel mood né nei riassunti.",
      "Serve la nuova versione del server (migration dei sogni) per poterli salvare.",
    ],
  },
  {
    version: '0.80.0',
    date: '2026-10-14 10:30',
    changes: [
      "Login: la scheda è più larga del 35%, «Archivio» si chiama «Indirizzo database» e l'indirizzo, sottolineato, è direttamente il tasto per cambiarlo (via la parola «Cambia»).",
      "Attesa dell'IA: «Generando con Gemini (modello). Tentativo 1/5», anche per la dettatura; con Groq «Generando con Groq. Tentativo 1/2». L'ultimo tentativo di una nota o di un riassunto, se Gemini è intasato, passa a Groq (se c'è la chiave).",
      "«Nuova nota con Gemini» diventa «Crea una nota con IA» ovunque.",
      "Nuova sezione Impostazioni → «Istruzioni per IA»: le istruzioni per le note e per i riassunti escono dal blocco Gemini e valgono per Gemini e per Groq. Con il campo vuoto vale il testo iniziale (in inglese), che si può ripristinare.",
      "Nuova sezione Impostazioni → «Lingua»: l'IA scrive le note (nuova nota con IA, pulizia, nota da un prompt) nella lingua scelta.",
      "Riassunti: mezz'ora dopo l'ultima modifica il server prova a scriverli subito con tutti i modelli attivi (Gemini, le due riserve, Groq); se non riesce restano per le 23:00. I riassunti usano anche luoghi e persone delle note.",
      "Editor: «-» e spazio crea il punto elenco anche dalla tastiera del telefono; Backspace a inizio punto lo toglie, e si può ricrearlo subito.",
      "Widget Android: ora 4×1 su foglio a righe; mood degli ultimi 3 giorni in un cartoncino quadrato dai lati tagliuzzati, ultima nota in un cartoncino a quadretti più scuro con gli angoli stondati.",
    ],
  },
  {
    version: '0.79.1',
    date: '2026-10-14 00:10',
    changes: [
      "Attesa di Gemini più chiara: mostra «tentativo x di 5» fin dall'inizio, dice quando sta provando un altro modello Gemini e, se una richiesta non risponde per 60 secondi, la interrompe e ritenta invece di restare ferma.",
      "Impostazioni: la sezione si chiama solo «Groq».",
    ],
  },
  {
    version: '0.79.0',
    date: '2026-10-13 23:00',
    changes: [
      "Gemini intasato: se il modello principale risponde «sovraccarico», dal terzo tentativo l'app prova da sola un altro modello Gemini «flash» (l'elenco lo chiede a Google), poi torna al principale.",
      "Nuova integrazione Groq (Impostazioni → Groq): con la chiave i vocali si trascrivono con Whisper su Groq, molto più veloce; se Groq non risponde si ripiega su Gemini. Nella schermata c'è la guida «Come ottenerlo».",
      "Vocali non ancora trascritti che non appartengono a nessuna nota in sospeso: compaiono nella linguetta a destra (matitina) come «x vocali da trascrivere»; un tocco li trasforma in una nota Gemini in sospeso.",
    ],
  },
  {
    version: '0.78.10',
    date: '2026-10-13 21:40',
    changes: [
      "Impostazioni: in fondo resta solo il numero di versione (v0.x.x), senza il nome dell'app.",
    ],
  },
  {
    version: '0.78.9',
    date: '2026-10-14 10:00',
    changes: [
      "Password: bastano 5 caratteri (prima 8), sia alla registrazione sia sul server.",
      "Accesso: nuovo pulsante «Ho dimenticato la password» (solo con i dati su un server): scrivi l'email e ti arriva il link per sceglierne una nuova. Serve un server di posta (SMTP) impostato in PocketBase.",
    ],
  },
  {
    version: '0.78.8',
    date: '2026-10-14 09:00',
    changes: [
      "Impostazioni: la sezione «Archivio e account» si chiama «Account», e «Esci» è più staccato da «Cambia server».",
    ],
  },
  {
    version: '0.78.7',
    date: '2026-10-13 20:30',
    changes: [
      "Accesso: alla scelta del server si scrive solo l'indirizzo, con un interruttore https:// / http://; «Usa questo sito» è staccato dal pulsante Continua; il cartoncino del login (web) è più largo del 30% e non c'è più «Non hai un account? Registrati», perché esistono già le schede.",
      "Accesso web: se i dati sono su un server, l'indirizzo con «Cambia» sta sotto le password nel cartoncino invece che nella colonna a sinistra.",
      "Nota con Gemini: i vocali restano sul dispositivo finché non sono trascritti, anche se chiudi il pannello mentre registri o trascrivi. Salvando la nota la bozza si cancella solo quando non restano vocali da trascrivere.",
      "Impostazioni: la sezione si chiama «Gemini» (senza «IA»). Vista mese: il numero dei giorni del weekend è un po' più scuro, per staccare dall'evidenziatore.",
    ],
  },
  {
    version: '0.78.6',
    date: '2026-10-13 18:45',
    changes: [
      "Il progetto si chiama MyJournal ovunque: nome dell'app, pacchetto Android, container Docker, font del foglio e documentazione. I dati già salvati sul dispositivo vengono copiati da soli al primo avvio.",
    ],
  },
  {
    version: '0.78.5',
    date: '2026-10-12 09:38',
    changes: [
      "Impostazioni: la riga con la versione dell'app, in fondo, è alta il doppio e con scritta più grande e regular, più leggibile.",
    ],
  },
  {
    version: '0.78.4',
    date: '2026-10-09 15:26',
    changes: [
      "Editor: scrivendo «-» e uno spazio a inizio riga il punto elenco compare sulla stessa riga, senza far salire il testo su quella precedente. Backspace a inizio di un punto elenco lo toglie, e si può ricrearlo subito dopo.",
      "Vista giorno: l'anteprima del testo di ogni nota rispetta gli a capo, le righe vuote, gli spazi e gli elenchi come sono scritti nella nota.",
      "I disegnini sullo sfondo del foglio (mese e giorno) sono più visibili del 15%.",
    ],
  },
  {
    version: '0.78.3',
    date: '2026-10-08 16:59',
    changes: [
      "Vista mese (web): le targhette dei nomi non finiscono più sopra il cartoncino del mood, nemmeno con titoli lunghi: partono sempre dopo il bordo vero del cartoncino.",
      "Vista mese (web): nelle pagine con il bordo strappato l'etichetta del mood e le foto non vengono più tagliate ai lati del foglio.",
    ],
  },
  {
    version: '0.78.2',
    date: '2026-10-08 15:13',
    changes: [
      "Vista mese: quando una giornata ha tante persone le targhette non si addossano più alle altre informazioni: se sono più di 4 si vedono le prime 3 e una targhetta «+x persone» per le altre.",
      "Le targhette delle persone hanno colori più vari: ogni persona ha una tonalità diversa ricavata dal nome (prima erano poche tinte simili e spesso uguali).",
      "Versione web: i titoli delle note (mese e giorno) sono più piccoli del 10%.",
    ],
  },
  {
    version: '0.78.1',
    date: '2026-10-07 07:10',
    changes: [
      "Mood Lab su telefono sistemato: barra in alto come le altre pagine (rispetta il notch), pagina a tutta larghezza, una sola colonna, cursori e pulsanti da dito, punti della curva più facili da trascinare, prima la curva e i fattori della formula e in fondo i dati di esempio, con i tasti «Risultati/Parametri» per saltare tra le due parti.",
    ],
  },
  {
    version: '0.78.0',
    date: '2026-10-07 06:30',
    changes: [
      "Mood Lab: il banco di prova della formula del mood (da note a giorno e da giorni a mese, con dati di esempio e curve del peso trascinabili) è dentro l'app. Si apre toccando 5 volte di seguito la riga «MyJournal · versione» in fondo alle Impostazioni.",
      "Con «Applica all'app» la formula messa a punto nel Mood Lab (curva delle note, peso di durata e persone, curva dei giorni nel mese) viene salvata sul tuo account e usata in tutta l'app: mood dei giorni e dei mesi, andamento, statistiche, widget. «Formula originale» ripristina quella di prima. Ogni utente ha la sua.",
    ],
  },
  {
    version: '0.77.0',
    date: '2026-10-07 05:00',
    changes: [
      "Vista giorno: un cartoncino quadrato appeso in alto a destra del foglio mostra il mood calcolato del giorno (0–100, nel colore del mood), con la stessa media della vista mese.",
    ],
  },
  {
    version: '0.76.2',
    date: '2026-10-07 04:00',
    changes: [
      "Selettori di persone, tag e luoghi: toccando un risultato già presente la barra di ricerca si svuota, così puoi scrivere subito un nuovo nome.",
    ],
  },
  {
    version: '0.76.1',
    date: '2026-10-07 03:40',
    changes: [
      "Vocali già trascritti: il pulsante resta «Trascrivi» (niente più «Trascrivi di nuovo»).",
      "Quando scrivi il nome di una persona, un tag o un luogo da aggiungere, l'app mostra quelli già presenti che combaciano (anche in parte). Se il nome esiste già non ne crea una copia: nei selettori lo sceglie, in Impostazioni avvisa.",
    ],
  },
  {
    version: '0.76.0',
    date: '2026-10-07 03:00',
    changes: [
      "Indietro a livelli: la pagina principale è il Calendario (o Andamento/Statistiche); su questa si aprono giorno, Cerca e Impostazioni; sopra possono aprirsi la nota e i pannelli. Il tasto/gesto «indietro» di Android e le frecce dell'app chiudono prima il pannello aperto, poi risalgono di un livello (cambiare giorno o scheda non aggiunge livelli); dalla schermata principale esce dall'app.",
      "Vista mese: il recap del mese ha la targhetta «Recap del mese» dentro la card, come nel giorno.",
      "Vista mese: nomi dei giorni più grandi del 10% e titoli delle note ridotti di un altro 5%.",
      "Aggiungi luogo (nota): i luoghi salvati sono su 3 colonne e la lista si può scorrere.",
    ],
  },
  {
    version: '0.75.8',
    date: '2026-10-07 02:00',
    changes: [
      "Vista mese: con i titoli in maiuscolo la pagina diventava enorme. Ora i titoli sono il 20% più piccoli del nome del giorno (con una piccola correzione per ciascun font) e il cartoncino è largo solo quanto serve ai titoli, senza arrivare al bordo destro.",
      "Salvataggio nota: corretto l'avviso falso «il titolo salvato non corrisponde» (il titolo ora si salva in maiuscolo e il controllo lo sapeva).",
      "Tag e luoghi: targhette in due colonne sul telefono e tre sul computer, in ordine alfabetico (selettori e Impostazioni).",
      "Gemini non raggiungibile: «Il server Gemini è sovraccarico. Effettuati 5 tentativi senza successo, riprova tra poco».",
      "Vocali: premendo «Trascrivi» il pulsante «Detta un vocale» mostra l'avanzamento e i tentativi; i vocali già trascritti restano (segnati «trascritto») finché non salvi la nota creata; l'elenco dei vocali non sparisce più mentre ne registri un altro.",
    ],
  },
  {
    version: '0.75.7',
    date: '2026-10-07 00:40',
    changes: [
      "Dentellatura dei lati dei cartoncini ingrandita di un altro 35%.",
      "Linguette del mood: contorno più scuro del 20% rispetto al colore dell'etichetta.",
      "Avviso «salvata come bozza»: comparsa più fluida (livello grafico dedicato, parte a ridisegno finito).",
    ],
  },
  {
    version: '0.75.6',
    date: '2026-10-07 00:10',
    changes: [
      "Linguette del mood sui giorni: contorno molto più chiaro e forma invertita, con il taglio irregolare a sinistra invece che a destra.",
      "Dentellatura dei lati dei cartoncini ingrandita del 30%.",
      "Avviso «salvata come bozza»: dura 4 secondi e sparisce strappandosi a metà, con le due metà che escono a sinistra e a destra dello schermo.",
    ],
  },
  {
    version: '0.75.5',
    date: '2026-10-06 23:20',
    changes: [
      "Avviso «salvata come bozza»: dura 6 secondi (uno in meno).",
      "Cartoncini del mood (mese e giorno): dentellatura dei lati ingrandita del 20% e meno ripetitiva (due seghe con passo diverso).",
      "Linguette del mood sui giorni: ora hanno un contorno più scuro ben visibile.",
    ],
  },
  {
    version: '0.75.4',
    date: '2026-10-06 22:50',
    changes: [
      "Vista mese: i cartoncini del mood hanno i lati sinistro e destro con dentellature piccole e sottili (prima i tagli erano grandi, soprattutto sui cartoncini alti).",
      "Avviso «salvata come bozza»: testo più grande del 10%, cartoncino più scuro con contorno per staccarsi dallo sfondo, dura 2 secondi in più e compare cadendo dall'alto un po' storto, rimbalzando e addrizzandosi.",
    ],
  },
  {
    version: '0.75.3',
    date: '2026-10-06 22:10',
    changes: [
      "Suono quando elimini una nota o scarti una bozza (parte subito dopo la conferma, più evidente di prima).",
      "Avviso «salvata come bozza»: nuovo testo, su un foglietto a quadretti con bordo leggero e la stessa ombra marcata delle linguette a destra.",
      "Vista giorno: i lati dei cartoncini del mood hanno ora dentellature piccole e sottili, uguali su cartoncini bassi e alti.",
    ],
  },
  {
    version: '0.75.2',
    date: '2026-10-06 21:40',
    changes: [
      "Icona dell'app Android: sfondo grigio caldo meno saturato (non più marrone) e più contrasto fra i fogli, con quelli dietro più scuri.",
    ],
  },
  {
    version: '0.75.1',
    date: '2026-10-06 21:10',
    changes: [
      "Note in sospeso: una sola linguetta con la matitina per tutte, con un'icona per ogni nota (matita = iniziata a mano, scintille = iniziata con Gemini) e il giorno a cui appartiene.",
      "Avviso «salvata come bozza»: compare a centro schermo sotto l'intestazione, con un suono, sia per le note iniziate con Gemini sia per quelle a mano.",
      "Scelta dell'archivio all'avvio: pulsanti più chiari. «Istruzioni per le note» di Gemini: contorno più leggero. Tolto l'avviso «testo ripristinato».",
    ],
  },
  {
    version: '0.75.0',
    date: '2026-10-06 20:30',
    changes: [
      "Vista giorno: le note a cavallo della notte (es. dalle 22 del 26 alle 3 del 27) compaiono sia nel giorno in cui iniziano sia in quello in cui finiscono.",
      "Nuova nota con Gemini: chiudendo con la ✕ la nota resta salvata come bozza (con un avviso) e compare nella linguetta a destra con il giorno a cui appartiene, il testo e i vocali; da lì si riprende.",
      "Nuova nota con Gemini: font più leggibile, pulsante «Istruzioni per le note» ben contornato, pulsante di registrazione fino a metà schermo e, nel pannello, solo il numero di richieste delle ultime 24 ore.",
      "Vocali: finita la registrazione non si trascrive più da soli. Ogni vocale ha un titolo modificabile e si trascrive quando lo decidi tu.",
      "I titoli delle note sono sempre in maiuscolo, anche quelli già esistenti (sul server dopo l'aggiornamento).",
    ],
  },
  {
    version: '0.74.0',
    date: '2026-10-06 19:00',
    changes: [
      "Alla prima apertura scegli dove tenere il diario: su questo dispositivo (telefono o browser, senza server né account) oppure sul tuo server, scrivendo tu l'indirizzo. Nessun indirizzo è più incluso nell'app. Si cambia da Impostazioni → Archivio e account.",
      "Android: niente più backup automatico dei dati dell'app su Google Drive.",
      "Impostazioni → Supporto compare solo se la build ha un contatto configurato; tolti i contatti personali dal codice.",
    ],
  },
  {
    version: '0.73.2',
    date: '2026-10-06 10:30',
    changes: [
      "Le linguette sul bordo destro si aprono e si chiudono con un piccolo scatto animato e un suono, e hanno un'ombra molto più marcata che le stacca dal resto dell'app.",
      "Vista giorno: la targhetta «Recap del giorno» sta dentro il riquadro del recap, alla stessa altezza del tasto Genera/Rigenera.",
    ],
  },
  {
    version: '0.73.1',
    date: '2026-10-06 10:23',
    changes: [
      "Vista giorno: l'evidenziatore dei titoli su due righe resta solo sulla prima; il blocco «Recap del giorno» compare anche senza note, con la sua targhetta al posto del titolo.",
      "Recap: il mese e l'anno in corso non si aggiornano finché non finiscono; la linguetta dei recap non li elenca più e si intitola «Aggiornamento recap alle 23.00».",
      "Linguetta di notifica sul bordo destro: forma a etichetta, contorno tratteggiato più spesso (2px), 10% più grande e con più ombra.",
      "Nota da telefono: se il titolo è più lungo della larghezza dello schermo va su due righe.",
      "Gemini: tolto il concetto di limite di richieste; resta solo un contatore nelle pagine dove si scrive una nota con Gemini e nelle Impostazioni di Gemini.",
    ],
  },
  {
    version: '0.73.0',
    date: '2026-10-06 10:07',
    changes: [
      "Aptico anche sui tasti «indietro».",
      "La linguetta dei recap elenca cosa verrà aggiornato alle 23:00: prima i giorni, poi i mesi, poi gli anni.",
      "I titoli lunghi delle note vanno su due righe invece di uscire dallo spazio visibile; nella vista giorno l'evidenziatore colora entrambe le righe.",
      "Gemini: se una richiesta fallisce per un intoppo momentaneo riprova dopo 3, 5, 7 e 9 secondi (5 tentativi in tutto); tolto il tasto «Riprova la trascrizione», restano i vocali salvati.",
      "Immich: il selettore delle foto si apre sul giorno della nota, con i pulsanti per caricare i giorni successivi e precedenti.",
      "Web: le immagini della nota si aprono a schermo intero.",
      "Un giorno senza note mostra comunque tutta l'interfaccia, senza note.",
      "Statistiche: «In evidenza» subito sotto il recap dell'anno.",
    ],
  },
  {
    version: '0.72.1',
    date: '2026-10-05 09:28',
    changes: [
      "Statistiche (web): dopo le targhette c'è il recap dell'anno con la sua targhetta; sotto, le persone più presenti a sinistra e le note per mese a destra, in una colonna; poi «In evidenza» su due colonne (sinistra settimana e mese migliori/peggiori, destra giorno più su e più giù di morale, tag e luogo più frequenti).",
      "Statistiche: nuovo «Giorno più giù di morale», il giorno della settimana col mood medio più basso.",
    ],
  },
  {
    version: '0.72.0',
    date: '2026-10-05 09:20',
    changes: [
      "Dettatura vocale: ogni vocale è salvato sul dispositivo appena finisci di registrare e resta finché non viene trascritto; se Gemini è intasato compare l'elenco dei vocali da trascrivere («Trascrivi» / «Elimina»), anche dopo aver chiuso pannello o app.",
      "Web: il recap del giorno è più largo del 30%; il recap del mese è centrato e ha la stessa larghezza di quello del giorno.",
      "Statistiche: il recap dell'anno sta sotto le tre targhette (note totali, note dell'anno, mood medio).",
      "Andamento: i numeri dei giorni nella riga di ogni mese non sono più tutti addossati al primo giorno; le linee della griglia del grafico, web e mobile, hanno lo stesso colore e sono più leggere del 15%.",
    ],
  },
  {
    version: '0.71.0',
    date: '2026-10-05 08:06',
    changes: [
      "Riassunti Gemini: alle 23:00 giorni, mesi e anni da aggiornare si chiedono a Gemini in UNA sola richiesta (JSON), invece di una per recap: molte meno richieste al giorno.",
      "Gemini: contatore delle richieste fatte da questo dispositivo (ultimo minuto, ultima ora, ultime 24 ore) nei pannelli Gemini e sotto la dettatura; in Impostazioni → Gemini → «Limiti di richieste» si scrivono i limiti della chiave (da Google AI Studio) per vedere anche quante ne restano.",
      "Gemini: se il limite scattato è quello giornaliero il messaggio lo dice chiaramente (si azzera verso le 9 in Italia) e ricorda di non chiudere il pannello per ritrascrivere il vocale.",
    ],
  },
  {
    version: '0.70.0',
    date: '2026-10-05 08:01',
    changes: [
      "Riassunti Gemini: ogni modifica segna da aggiornare il recap del giorno, del mese e dell'anno, e il server li rigenera tutti in blocco ogni sera alle 23:00 (prima i giorni, poi i mesi, poi gli anni; ritentativi alle 23:20 e alle 23:40). Prima si aggiornavano uno alla volta durante il giorno e dopo la mezzanotte.",
      "La linguetta dei recap in attesa ora avvisa che l'aggiornamento è previsto per le 23:00.",
    ],
  },
  {
    version: '0.69.2',
    date: '2026-10-05 07:57',
    changes: [
      "Suoni: scorrendo di lato per cambiare mese si sente una pagina che viene sfogliata.",
    ],
  },
  {
    version: '0.69.1',
    date: '2026-10-05 07:48',
    changes: [
      "App Android: lo schermo non ruota più, resta sempre in verticale.",
    ],
  },
  {
    version: '0.69.0',
    date: '2026-10-05 07:47',
    changes: [
      "Suoni: un «tic» ai pulsanti, due note al cambio di mese e anno, un fruscio di carta aprendo giorni e note, una campanella al salvataggio e un suono diverso all'eliminazione di una nota, e i suoni della dettatura vocale (avvio, stop e avviso degli ultimi secondi). Sono sintetizzati dall'app, senza file audio.",
      "Impostazioni: «Suoni» in Aspetto per accenderli o spegnerli e una nuova sezione «Suoni» per il volume (per dispositivo).",
      "App Android: la notifica dei promemoria ha un suono proprio (campanella a due note).",
    ],
  },
  {
    version: '0.68.3',
    date: '2026-10-05 07:43',
    changes: [
      "Dettatura vocale: fino a 120 secondi. Il pulsante è la barra: mostra il tempo che cresce e si riempie da sinistra verso destra; negli ultimi 30 secondi si allarga per far spazio a «mancano Ns», diventa rosso e lampeggia.",
      "Dettatura vocale: vibrazione quando mancano 30, 20, 10 e 5 secondi.",
    ],
  },
  {
    version: '0.68.2',
    date: '2026-10-05 07:15',
    changes: [
      "Feedback aptico su tutti i pulsanti per cambiare anno o mese (frecce, etichette e voci dei menu) e al tocco di una pagina: il giorno nel mese e la nota nel giorno.",
    ],
  },
  {
    version: '0.68.1',
    date: '2026-10-05 07:06',
    changes: [
      "Impostazioni: feedback aptico quando apri o chiudi una categoria; «Istruzioni personalizzate» diventa «Istruzioni per le note».",
      "Vista del giorno: «30 ottobre 2026» nell'orologio è di nuovo leggibile (gli spazi del font digitale erano quasi nulli).",
    ],
  },
  {
    version: '0.68.0',
    date: '2026-10-05 06:44',
    changes: [
      "Riassunti Gemini: nelle Impostazioni (Integrazioni → Gemini) c'è il campo «Istruzioni per i riassunti», aggiunto a tutti i recap di giorno, mese e anno, anche a quelli scritti dal server di notte.",
      "Riassunti Gemini: modificando una nota il recap si rifà solo se cambiano la descrizione o il mood (non più per titolo, orari, persone, luogo, canzoni o immagini).",
      "App Android: icona con fondo scuro, icona dedicata nelle notifiche; nel widget l'ultima nota è espressa in «x giorni fa».",
    ],
  },
  {
    version: '0.67.1',
    date: '2026-10-04 18:00',
    changes: [
      "Widget: l'oscillazione del pulsante Nuova nota non scatta più (lobi sinusoidali continui al posto di cinque rotazioni raccordate male) e fra un'oscillazione e l'altra passano 4 secondi di quiete.",
    ],
  },
  {
    version: '0.67.0',
    date: '2026-10-04 16:53',
    changes: [
      "Promemoria: il testo della notifica si personalizza (campo sotto ogni promemoria, vuoto = testo predefinito) e la settimana parte da lunedì.",
      "Dettatura vocale: massimo 100 secondi per registrazione. Il pulsante mostra i secondi che restano e una barra che si consuma; negli ultimi 15 secondi diventa rosso, lampeggia e avvisa che sta per finire.",
      "Vista Andamento: lo sfondo a quadretti ora è parte del grafico e coincide con gli assi (due quadretti per mese, righe 0/25/50/75/100 su una linea) invece di scorrere a parte.",
      "Aptico: tornato sul cambio di scheda di vista (Calendario / Andamento / Statistiche). Dal widget, un tic leggero appena l'app si apre dal tasto toccato (il widget stesso non può far vibrare al tocco).",
      "Impostazioni → Aspetto semplificato: niente più scelta di tema (per ora solo chiaro), font (solo tondeggiante) e cursore (solo quello di sistema). Gli sfondi sono Nessuno, Puntini, Righe, Quadretti e Immagine.",
      "Statistiche: i numeri grandi non sono più attraversati dalla linea tratteggiata e hanno più aria attorno (etichetta, valore e sotto-testo di scontrini e targhette). Giroscopio: la direzione è corretta (la foto pende verso il basso del telefono, come un pendolo), prima ruotava al contrario. Giroscopio: nuova riga in Impostazioni → Permessi (Android non richiede nessun permesso, si vede se il sensore c'è) e le foto polaroid delle viste mese e giorno dondolano a destra e a sinistra quando inclini il telefono, appese al nastro. Si spegne dalla stessa riga o con le animazioni disattivate.",
    ],
  },
  {
    version: '0.66.1',
    date: '2026-10-04 07:00',
    changes: [
      "Fix app Android: aprendo l'app da un tasto del widget (Nuova nota, mood, ultima nota), dopo aver generato una nota con Gemini — o appena cambiavi pagina — l'app tornava alla scelta Gemini / a mano (o a Andamento / al giorno). Il link di avvio del widget veniva riletto a ogni cambio di pagina; ora si gestisce una volta sola.",
      "Widget: il pulsante Nuova nota è appeso a un chiodo e ondeggia attorno a quel solo punto ogni 4 secondi, con oscillazioni lente (velocità dimezzata) che si smorzano fino a fermarsi. Il pulsante non viene più tagliato ai bordi. L'anteprima nel selettore dei widget ora mostra il widget com'è davvero, con dati d'esempio, invece dei trattini e del quadratino bianco; anche i due widget Nuova nota (2×1 e 1×1) hanno ora la loro anteprima, che prima mancava.",
    ],
  },
  {
    version: '0.66.0',
    date: '2026-10-03 10:24',
    changes: [
      "Impostazioni → Permessi (app Android): cosa hai concesso all'app — microfono, notifiche, allarmi precisi e risparmio batteria — con a cosa serve ciascuno, il pulsante per concederlo o per aprire la schermata di Android giusta, e l'aggiornamento automatico quando torni nell'app. Nel browser mostra microfono e notifiche in sola lettura.",
      "Nuovo widget 3×1 per la home (app Android), in tre blocchi: a sinistra il mood dell'ultima settimana (in centesimi, da 0 a 100, con un quadratino di carta del colore del tuo gradiente, giorni e note considerati); al centro l'ultima nota, con il giorno e l'ora in cui è finita; a destra il pulsante in rilievo, leggermente storto, per scrivere una nota nuova. Testi in un carattere scritto a mano. Toccando il mood si apre Andamento, toccando l'ultima nota il suo giorno. Si aggiorna quando apri l'app, torna in primo piano o salvi/elimini una nota.",
    ],
  },
  {
    version: '0.65.0',
    date: '2026-10-03 03:22',
    changes: [
      "Bozze: se esci da una nuova nota senza salvare (ad esempio con Indietro per sbaglio) la nota resta in una linguetta Bozze sul bordo destro, da riprendere con un tocco o scartare. Si salva da sola mentre scrivi; le immagini non si conservano e vanno riaggiunte.",
      "Salvare una nota non resta più appeso: i recap di giorno, mese e anno si aggiornano in background, uno alla volta e distanziati nel tempo. Una linguetta spiega cosa sta aggiornando il server.",
      "Feedback aptico solo sui pulsanti d'azione (non su selezioni, schede, filtri e foto) e con intensità dimezzata.",
      "Dettatura vocale da telefono: messaggi più chiari se il microfono è bloccato o occupato, e se Gemini rifiuta il formato registrato dal telefono si riprova in WAV.",
    ],
  },
  {
    version: '0.64.0',
    date: '2026-10-02 18:46',
    changes: [
      "Nuova app Android (APK scaricabile da Impostazioni → App Android, da web): è MyJournal impacchettata con Capacitor, con lo stesso account e gli stessi dati. Nell'app non c'è il service worker e le vibrazioni al tocco usano il motore nativo.",
      'App Android: widget \"Nuova nota\" per la schermata home (due formati) che apre subito la scelta Gemini / a mano, e Impostazioni → Promemoria con una o più notifiche periodiche \"scrivi la nota del giorno\" (orario e giorni a scelta, anche ad app chiusa).',
      'Vista mese (telefono): tira verso il basso per aggiornare, leggendo le note direttamente dal server invece che dalla cache.',
      "Fix app Android: la dettatura vocale (\"Detta un vocale\", note con Gemini) non poteva registrare perché mancava il permesso Microfono; ora l'app lo chiede e, se negato, spiega dove concederlo. Per averlo bisogna installare il nuovo APK.",
    ],
  },
  {
    version: '0.63.1',
    date: '2026-10-02 11:44',
    changes: [
      "MyMap: i nomi dati a mano ai posti ora compaiono nel selettore luogo anche quando il centro del posto di un singolo giorno si scosta un po' da quello calcolato in MyMap (tolleranza 150 m invece di 120), e si aggiornano subito senza ricaricare MyJournal.",
      'MyMap: \"Testa connessione\" indica sempre quanti nomi dati a mano trova sul server e, se sono zero, dove controllare la sincronizzazione.',
      'MyMap: se il server non ha ancora i campi dell\'integrazione, \"Salva\" lo segnala invece di svuotare i campi.',
    ],
  },
  {
    version: '0.63.0',
    date: '2026-10-02 10:38',
    changes: [
      "Nuova integrazione MyMap (Impostazioni → Integrazioni): collega l'app che traccia i tuoi spostamenti con URL del server, email e password del suo account. Richiede la migration del database (nuovi campi sull'utente), che parte da sola al riavvio del container.",
      'Selettore luogo delle note: se MyMap è collegato compare la scelta MyJournal / MyMap. Con MyMap si vedono i posti visitati nel giorno della nota (soste di almeno 20 minuti, con orario e durata, frecce per cambiare giorno); il nome è quello dato a mano in MyMap, altrimenti OpenStreetMap, e resta modificabile.',
      "Aggiunta la documentazione dell'app (docs/GUIDA.md e ARCHITETTURA.md) e il supporto allo sviluppo in locale contro il database online (VITE_DEV_API).",
    ],
  },
  {
    version: '0.62.1',
    date: '2026-09-30 23:18',
    changes: [
      "Fix critico: la v0.62.0 impediva di salvare/modificare le note (\"Failed to create record\"), per un bug negli hook dei recap automatici lato server. Risolto: il salvataggio delle note torna a funzionare normalmente.",
    ],
  },
  {
    version: '0.62.0',
    date: '2026-09-30 22:15',
    changes: [
      "Recap automatici: ogni notte l'app prepara da sola, con Gemini, il riassunto del giorno appena finito; a fine mese quello del mese (dai recap giornalieri) e a fine anno quello dell'anno (dai recap mensili). Si aggiornano da soli se modifichi una nota di un periodo già chiuso. In cima alla vista giorno, in cima alla vista mese e nelle Statistiche (anno) compare il recap pronto, con un tasto \"Genera\"/\"Rigenera\" per i periodi passati o per un testo diverso.",
      "Dettatura vocale: se la trascrizione fallisce, il vocale registrato non si perde più — si può ritrascrivere lo stesso audio senza registrare di nuovo.",
    ],
  },
  {
    version: '0.61.3',
    date: '2026-09-29 21:41',
    changes: [
      "Pannelli Gemini (\"Scrivi con l'IA\", \"Nuova nota con Gemini\"): dopo un risultato si può chiedere una piccola correzione invece di ripartire da capo, la finestra è più grande, e se il server è sovraccarico l'app riprova da sola un paio di volte prima di segnalare l'errore (con l'attesa sempre visibile, anche nell'estrazione note da screenshot in Importa).",
      "Nuovo: dettatura vocale nei pannelli Gemini — si registra un vocale e Gemini lo trascrive direttamente, più affidabile del dettato dello smartphone su nomi e termini particolari.",
      "Corretto il pannello Gemini che restava scrollabile su mobile anche a tutto schermo.",
    ],
  },
  {
    version: '0.61.2',
    date: '2026-09-25 12:20',
    changes: [
      "Pubblicazione più veloce: la build dell'app non passa più dall'emulazione arm64, quindi gli aggiornamenti arrivano sul NAS in pochi minuti.",
    ],
  },
  {
    version: '0.61.1',
    date: '2026-09-25 11:57',
    changes: [
      "Rimosso il campo \"Server\" da pagina di accesso e Impostazioni: il database è integrato e l'app lo raggiunge da sola. L'indirizzo salvato in precedenza nel browser viene scartato, così il login torna a funzionare.",
    ],
  },
  {
    version: '0.61.0',
    date: '2026-09-25 11:36',
    changes: [
      "Il database è ora integrato nell'app: PocketBase non è più raggiungibile da fuori e il frontend lo usa in automatico dallo stesso indirizzo del diario (nessun URL del database da inserire, niente secondo hostname nel tunnel).",
    ],
  },
  {
    version: '0.60.1',
    date: '2026-09-24 22:50',
    changes: [
      "Cache offline: le miniature tornano a essere salvate così come le genera il server (300x300, senza conversione in WebP); a ogni aggiornamento vengono tolte quelle di note o immagini non più esistenti.",
    ],
  },
  {
    version: '0.60.0',
    date: '2026-09-24 22:45',
    changes: [
      "Le notifiche di connessione debole/assente e delle note in attesa di sincronizzazione sono ora piccole linguette sul bordo destro dello schermo, a metà altezza: non coprono più gli orari in alto. Toccandole si espandono mostrando il testo per intero e il pulsante per riprovare o sincronizzare.",
      "Cache offline più leggera: le miniature sono salvate in WebP a una sola dimensione (300x300) e le risposte non leggibili non vengono più conservate, così lo spazio occupato sul telefono cala molto.",
    ],
  },
  {
    version: '0.59.0',
    date: '2026-09-24 22:25',
    changes: [
      "Impostazioni (mobile e web): nuova sezione \"Uso offline\" con lo spazio occupato dalla cache locale, il numero di note e miniature salvate e l'ora dell'ultimo aggiornamento, con i pulsanti \"Aggiorna ora\" e \"Svuota cache\".",
    ],
  },
  {
    version: '0.58.1',
    date: '2026-09-24 22:21',
    changes: [
      "Corretto l'uso offline: aprendo l'app senza rete o con rete molto lenta non serve più rifare il login (la sessione salvata viene scartata solo se il server la rifiuta), così si vedono subito i dati salvati in locale.",
    ],
  },
  {
    version: '0.58.0',
    date: '2026-09-24 22:10',
    changes: [
      "Uso offline o con poca connessione: all'apertura l'app scarica in locale note, persone, tag, luoghi e miniature delle immagini; con rete assente o lenta mostra subito i dati salvati e li aggiorna in background appena arriva la risposta.",
      'Una pillola in alto avvisa quando la connessione è debole o assente (i dati potrebbero non essere aggiornati, con ora dell\'ultimo aggiornamento); toccandola si riprova ad aggiornare.',
      'Salvando una nota con connessione debole compare un avviso: il caricamento può richiedere tempo, e se non riesce subito la nota resta in coda e si sincronizza da sola.',
      'Nuova icona dell\'app: fogli a quadretti sfalsati con linguette colorate e una piccola polaroid del mare.',
    ],
  },
  {
    version: '0.57.0',
    date: '2026-09-24 20:40',
    changes: [
      'Selettore orario (mobile e web): ora e minuti in due colonne separate, con i minuti a multipli di 5, invece di un\'unica lista con tutte le combinazioni ogni 5 minuti; resta aperto finché non si clicca fuori.',
      'Barra del mood: ora è un righello di legno con tacche (e numeri 0–10 nell\'editor nota), leggermente inclinato, il cui colore segue il mood; il cursore è una placca di metallo che lo avvolge. Tolti etichetta e valore numerico.',
    ],
  },
  {
    version: '0.56.0',
    date: '2026-09-18 21:50',
    changes: [
      'Import da foglio: "Spezza qui" ora ricalcola persone e tag su ciascuna metà del testo (invece di copiare lo stesso elenco su entrambi) e completa gli orari — il primo pezzo eredita l\'inizio del blocco originale, il secondo la fine.',
    ],
  },
  {
    version: '0.55.0',
    date: '2026-09-18 15:38',
    changes: [
      'Statistiche (mobile e web): nuova lista "Note per mese" e due targhette in evidenza, "Mese più felice" e "Mese più triste" — tocca per vedere le note di quel mese.',
      'Vista giorno (mobile): la data ora è lo stesso orologio LCD del resto dell\'app, non più la vecchia targhetta.',
      'Andamento (mobile): numeri dei giorni (multipli di 5) sotto le barrette di ogni mese, come da web; barre più basse (-30%).',
      'Rimossa "Genera dalle foto di ieri" da "Nuova nota con Gemini" e "Riconosci le persone citate" dal menu Gemini della nota (mobile) — restano scrittura da prompt e ripulisci/sintetizza testo.',
      'Impostazioni: sezione "Istruzioni personalizzate" (Gemini) non più a scomparsa, sempre visibile; ordine di Immich/Spotify/Gemini uniformato tra mobile e web.',
      'Ovunque si scrive un prompt per Gemini (nuova nota, scrivi con l\'IA) è ora presente anche un box "Istruzioni personalizzate" — richiudibile, chiuso di default — per modificarle al volo senza passare da Impostazioni; si applicano subito alla generazione in corso.',
      'Corretto un taglio del cartoncino della barra superiore mobile sotto la barra di stato del telefono, nella PWA installata.',
    ],
  },
  {
    version: '0.54.0',
    date: '2026-09-16 23:01',
    changes: [
      'Statistiche: aggiunta "Settimana peggiore" alla lista "In evidenza" (web e mobile), accanto a "Settimana migliore" — tocca per vedere le note di quella settimana.',
    ],
  },
  {
    version: '0.53.0',
    date: '2026-09-16 22:21',
    changes: [
      'Import da foglio, revisione nota: gli orari Inizio/Fine sono ora staccati dalla data (spinti a destra) invece di stare tutti appiccicati; il box "Contenuto" si allarga sempre quanto serve a mostrare tutto il testo, senza più bisogno di ridimensionarlo a mano.',
      'Selettore orario (vista nota): colonna più alta (+30%) per raggiungere più valori senza scorrere così tanto.',
      'Impostazioni: i sotto-cartoncini (Colori del mood, Persone, Tag...) erano rimasti troppo scuri — sfondo più chiaro e grana meno marcata.',
    ],
  },
  {
    version: '0.52.0',
    date: '2026-09-16 20:38',
    changes: [
      'Import da foglio: colonne di default aggiornate (mese C, giorno E, testo F, titolo G, voto H); il campo "Data" in revisione mostra la data per esteso ("lunedì 09 febbraio 2026") invece del solo input, più veloce da leggere scorrendo tante note di fila.',
      'Import da foglio: i file caricati restano in una libreria personale (non più solo nel browser) — un pulsante sotto il box per richiamare ciascun file caricato in precedenza, con una × per dimenticarlo, così si riprende anche da un altro dispositivo senza ricaricarlo da capo.',
      'Selettori di immagini, canzoni, persone, tag e luogo (mobile e web): risolto un bug di posizionamento per cui lo sfondo scuro non copriva tutto lo schermo e il pannello poteva finire fuori dai bordi visibili, rendendo alcuni pulsanti non raggiungibili.',
    ],
  },
  {
    version: '0.51.0',
    date: '2026-09-16 19:21',
    changes: [
      'Import da foglio (beta): niente più Gemini per leggere il testo — uno script locale prepara subito una nota per giorno (mese e giorno letti dalla colonna del CSV, non più scelti da un menu a parte), con persone e tag già a database riconosciuti automaticamente nel testo; ordine dei campi in revisione rivisto (titolo sopra al contenuto, orari sulla riga della data) e tolta la descrizione in alto alla pagina.',
      'Barra laterale web, "Nuova nota": in vista giorno prende la data del giorno che si sta guardando, invece di andare sempre a oggi.',
      'Aggiungere persone a una nota: ogni persona mostra ora in quante note è già usata.',
      'Vista mese: risolto un bug per cui i fogli e i titoli delle note di uno stesso mese finivano quasi tutti con la stessa inclinazione invece che sparsa; il foglio sotto al mouse si solleva di più e non salta più sopra a tutti gli altri fogli del mese.',
    ],
  },
  {
    version: '0.50.0',
    date: '2026-09-16 17:01',
    changes: [
      'Vista mese: all\'apertura dell\'app va subito al mese corrente, e ogni volta che si carica il mese lo scroll è già sul giorno di oggi (mobile e web).',
      'Andamento da web: le barrette di ogni mese sono ora cliccabili una per una, con il numero del giorno sotto ciascuna, per aprire subito quel giorno.',
      'Andamento e Statistiche da web: header con titolo e anno fisso in cima scorrendo la pagina.',
      'Impostazioni, sezione Gemini (IA): più contrasto e spazio fra i campi, meno tutto appiccicato; il campo delle istruzioni personalizzate è più grande.',
      'Pannello per generare una nota con Gemini (mobile e web): stessa estetica a foglietto di cartoncino del resto dell\'app invece del vecchio pannello bianco generico; da web appare a centro schermo invece che in basso.',
      'Corretto il dropdown di mese/anno da telefono, che poteva uscire dai bordi dello schermo o comparire scentrato rispetto al pulsante; il menu del mese è anche un po\' più largo per far stare nomi lunghi come "Settembre".',
    ],
  },
  {
    version: '0.49.0',
    date: '2026-09-16 15:53',
    changes: [
      'Vista nota da web: data e orario ora sono una sveglia LCD digitale (font a segmenti dedicato), come il resto dell\'app; il calendario e il selettore orario a comparsa hanno un\'estetica coerente (calendario da tavolo "strappabile", selettore orario a rotella); pulsanti indietro/salva/elimina tornano ad essere targhette con testo e contorno tratteggiato, coerenti con la barra laterale.',
      'Vista mese e vista giorno da web: anno/mese/data ora sono lo stesso orologio LCD (con menu a tendina in stile coerente per saltare a un valore non adiacente); un foglio a quadretti leggermente storto spunta dietro ai pulsanti dell\'header, che ora resta fisso in cima allo schermo scorrendo le note del mese. Rimosso il pulsante "Oggi" e il vecchio foglio col nome del giorno/mese.',
      'Vista giorno: la data resta un testo scritto a mano con evidenziatore (qui non si può modificare direttamente, solo di un giorno alla volta) invece dell\'orologio, per non trarre in inganno.',
      'Andamento e Statistiche da web: stesso foglio a quadretti e stesso orologio LCD per l\'anno; titolo con font a mano ed evidenziatore come nel resto dell\'app; anno centrato in pagina; grafico dell\'andamento più basso e con testi coerenti col resto della pagina.',
      'Vista nota (mobile e web): tag aggiunti ora hanno la stessa targhetta in legno degli altri elementi; targhetta della tab attiva (mobile e web) con lo stesso bordo e incisione delle altre targhette in legno.',
      'Impostazioni: rimosse le descrizioni sotto ogni categoria; "Esci" ed "Elimina account" ora sono un\'unica categoria "Account" anche da web (come già in mobile).',
      'Barra laterale web: "Calendario" resta evidenziato anche nella vista giorno e nell\'editor nota.',
      'Corretti alcuni bug: dropdown di mese/anno che a volte uscivano dallo schermo da telefono, dropdown scambiati fra loro nella vista mese da telefono, popup dell\'orario che si apriva sempre ancorato al primo orologio invece di quello cliccato.',
    ],
  },
  {
    version: '0.48.0',
    date: '2026-09-16 12:00',
    changes: [
      'Vista giorno da telefono: "nuova nota" ora offre la scelta fra Gemini e manuale, come nelle altre viste. Il cartoncino della nota non copre più gli orari né la riga rossa del margine, le foto sono più grandi e il bordo strappato è meno caotico (esteso anche alla vista web).',
      'Vista giorno da web: risolto un bug per cui le targhette con i nomi delle persone potevano sovrapporsi al cartoncino della nota; ora hanno anche la stessa leggera rotazione della vista mese.',
      'Vista nota da telefono: risolto il calendario che si "schiacciava" dentro il pulsante invece di aprirsi sopra il resto; pulsanti indietro/elimina più grandi; orari e data non si troncano più; font più leggibile; foto in stile polaroid come in vista mese.',
      'Vista nota da web: il foglio ha i forellini di un raccoglitore ad anelli; i pulsanti per aggiungere foto/persone/tag/canzoni/luogo sono ora targhette rettangolari in colonna che diventano una targhetta in legno una volta aggiunto un contenuto; il contenuto aggiunto compare sotto il foglio in colonne separate, con la stessa estetica della vista mese (targhette persona, francobollo, disco, polaroid).',
      'Barra dell\'umore (mobile e web): ridisegnata più volte nel corso della giornata, ora è un bastoncino colorato semplice, senza bagliore eccessivo, uguale su entrambe le viste.',
      'Pulsanti "aggiungi" da telefono (persone/tag/canzoni/luogo/foto): una volta aggiunto un elemento diventano un dischetto in legno leggermente sfasato (non più un indicatore piccolo), con icona e conteggio.',
      'Sfondo delle viste nota (telefono e web) leggermente più scuro del foglio, per distinguerli meglio.',
    ],
  },
  {
    version: '0.47.0',
    date: '2026-09-15 19:10',
    changes: [
      'Impostazioni → Aspetto: il cursore a matitina ora è facoltativo ("Cursore del mouse: Windows / Matitina"), spento di default — resta quello di Windows finché non lo si attiva.',
      'Statistiche: meno grana di cartone sulle targhette, etichette di sezione ("Persone più presenti", "Giorni migliori"...) più leggibili, numeri di riepilogo meno marcati, recap dell\'anno spostato in fondo e colorato di giallo per segnalarlo provvisorio. Da telefono, le liste di persone/giorni/note mostrano solo le prime voci con un pulsante "Mostra altri".',
      'Ricerca da web allineata a quella da telefono: sezione "Canzoni" con filtro dedicato, "Note con luoghi" spostato dentro "Luogo", Tag ora collassabile, "Ordina per" in verticale, tolta la sezione "Contenuto" e la barra del mood.',
    ],
  },
  {
    version: '0.46.0',
    date: '2026-09-15 18:20',
    changes: [
      'Cursore del mouse a forma di matitina in tutta l\'app, con varianti diverse a seconda di cosa c\'è sotto: normale, un piccolo scintillio quando si passa su un elemento cliccabile, in verticale con la punta in basso sui campi di testo, e con un anello tratteggiato attorno alla punta sui pulsanti mentre un\'operazione è in corso.',
      'Barra laterale web: il colore della targhetta in legno della voce selezionata è più chiaro.',
    ],
  },
  {
    version: '0.45.0',
    date: '2026-09-15 15:45',
    changes: [
      'Skin "Pagine" ora è l\'unica in tutta l\'app: tolti gli stili alternativi (Disegnata, Bacheca, Elenco) sia da Impostazioni → Aspetto che dal codice — meno codice morto, un solo linguaggio visivo.',
      'Vista giorno: il colore del cartoncino di ogni nota ora segue il gradiente del mood in modo continuo, non più a scatti di 4 fasce colore.',
      'Colori del mood (Impostazioni → Dati utente): anche gli estremi ("Pessimo"/"Ottimo") si possono spostare, trascinando i pallini direttamente sul gradiente invece di scrivere un numero.',
      'Impostazioni: "Esci" ed "Elimina account" ora in un\'unica sezione "Account"; i sotto-pannelli (Persone, Tag, Luoghi...) hanno la stessa carta/grana del resto dell\'app invece del vecchio bordo colorato; tessera profilo con foto quadrata e un solo pulsante "Modifica dati" per tutti i campi insieme.',
      'Ricerca da telefono: nuovo blocco "Canzoni" con tutte le canzoni salvate come filtro, "Note con luoghi" spostato dentro "Luogo", sezioni Tag e Ordina per collassabili, contenitori più leggibili, tolti il pulsante Calendario e la barra del mood ridondanti.',
      'Pulsante "indietro" ingrandito nelle viste giorno, ricerca, nota e Impostazioni; corretto un bug grafico per cui le targhette persone/luogo/canzone in vista mese (telefono) potevano restare invisibili su alcuni schermi reali.',
      'Barra laterale web: la voce di menu attiva ora è un vetrino con cornice di legno chiaro (venatura vera) al posto del semplice sfondo più chiaro.',
    ],
  },
  {
    version: '0.44.0',
    date: '2026-09-15 13:37',
    changes: [
      'Indirizzo del server PocketBase modificabile senza ricompilare: visibile e cambiabile dalla pagina di accesso (web e mobile) e da Impostazioni → tessera profilo. Cambiarlo da Impostazioni disconnette (il token vale solo per il server precedente): si rimanda al login. Non compare nella tessera della barra laterale.',
    ],
  },
  {
    version: '0.43.0',
    date: '2026-09-15 13:29',
    changes: [
      'Vista mese da telefono, skin "Pagine": contatori persone/luogo/canzone più leggibili (testo e sfondo più marcati), numero dell\'umore spostato di un filo a sinistra così le targhette a punta non lo tagliano più, barra superiore e inferiore non sembrano più "staccate" dal cartoncino sotto (mancava l\'ombra a terra).',
      'Barra inferiore da telefono: il pulsante "nuova nota" è ora centrato con una texture di cartone chiaro e un bordo tratteggiato bianco, la lente di ricerca è tutta a sinistra e il profilo tutto a destra. Il pulsante Gemini separato è sparito: "nuova nota" ora apre una scelta fra Gemini e manuale.',
    ],
  },
  {
    version: '0.42.0',
    date: '2026-09-15 11:44',
    changes: [
      'Pagina di accesso (mobile): stesso modulo della versione web — cartoncino tenuto da nastro adesivo e una puntina, schede Accedi/Registrati "a matita" che diventano inchiostro pieno da selezionate — con un\'intestazione di carta strappata più corta al posto del pannello a due fogli, pensata per lo schermo stretto.',
    ],
  },
  {
    version: '0.41.0',
    date: '2026-09-15 11:23',
    changes: [
      'Pagina di accesso (web): rifatta in stile "Pagine" — pannello sinistro di cartoncino strappato con un assaggio di nota/foto/persone, modulo a destra tenuto da nastro adesivo e una puntina, schede Accedi/Registrati "a matita" che diventano inchiostro pieno da selezionate.',
    ],
  },
  {
    version: '0.40.0',
    date: '2026-09-14 23:55',
    changes: [
      'Statistiche (web e mobile): rifatta in stile "Pagine" — le 3 metriche in cima sono scontrini con foro e riga tratteggiata, il recap IA è un sotto-cartoncino con bordo colorato, "Persone più presenti" e le liste di giorni/note migliori e peggiori sono strisce di biglietti come in Cerca.',
      'Editor nota (web e mobile): rifatto in stile "Pagine" — la colonna con data/orario/mood/immagini/persone/tag/canzoni/luogo è una pila di sotto-cartoncini, e dove si scrive è un vero foglio con margine e righe come in vista giorno, con due nastri adesivi in alto. Da telefono, orario e data sono targhette dorate e la barra in basso riusa lo stesso materiale delle altre barre mobile.',
    ],
  },
  {
    version: '0.39.1',
    date: '2026-09-14 22:52',
    changes: [
      'Fix: rimosso il filtro decorativo rimasto su altri elementi delle note (contatori compatti persone/luogo/canzone e nastro della polaroid in vista mese e vista giorno da telefono, striscia dietro il numero del giorno, sfondo del cartoncino in vista giorno) — i due interventi precedenti (v0.35.1 e v0.37.1) avevano coperto solo bordo-cella, sfondo-nota ed etichetta-mood della vista mese, non bastava: il glitch grafico su alcune note in WebView Android dovrebbe ora sparire del tutto.',
    ],
  },
  {
    version: '0.39.0',
    date: '2026-09-14 22:36',
    changes: [
      'Cerca (vista mobile): rifatta in stile "Pagine" — stessi sotto-cartoncini per ogni filtro (Periodo, Mood, Testo, Luogo, Persone, Tag, Contenuto, Ordina per, Numero massimo) e le stesse pillole già portate sul web, con contorno a matita che diventa inchiostro nero pieno da selezionate; "Luogo" ora è un accordion chiudibile come "Persone"; i risultati sono una striscia di biglietti invece di card sciolte.',
    ],
  },
  {
    version: '0.38.0',
    date: '2026-09-14 21:24',
    changes: [
      'Impostazioni (vista mobile): rifatta in stile "Pagine" — tessera profilo identica a quella web (con nome, email e password modificabili sul posto, prima non c\'era), sezioni a cartoncino a quadretti apri/chiudi, sotto-cartoncini colorati per Persone/Tag/Luoghi/Canzoni/Immich/Gemini/Spotify, "Elimina account" ora è un cartoncino rosso sempre visibile invece di un semplice link.',
    ],
  },
  {
    version: '0.37.1',
    date: '2026-09-14 20:06',
    changes: [
      'Vista mese da telefono (skin "Pagine"): rimosso il filtro decorativo dai tre elementi che si ripetono più spesso a schermo (bordo cella, sfondo nota, etichetta mood) — il precedente intervento (v0.35.1) ne aveva tolti solo 4 sulla barra, non bastava: con fino a 25-30 note visibili insieme il numero di filtri SVG attivi contemporaneamente restava troppo alto e causava il glitch grafico su alcuni telefoni Android.',
      'Vista mese: la larghezza dell\'etichetta del mood ora tiene conto del numero di cifre, per evitare che un punteggio "100" venga tagliato dal ritaglio decorativo dell\'etichetta.',
    ],
  },
  {
    version: '0.37.0',
    date: '2026-09-14 19:44',
    changes: [
      'Cerca (vista web): rifatta in stile "Pagine" — ogni gruppo di filtri (Periodo, Mood, Testo, Luogo, Persone, Tag, Contenuto, Ordina per, Numero massimo) è un sotto-cartoncino invece di un riquadro grigio anonimo.',
      'Cerca: le pillole (luoghi/persone/tag/mood/ordinamento) sono ritagli di carta col contorno a matita, che diventano inchiostro nero pieno quando selezionate; "Applica filtri" è lo stesso cartoncino nero degli altri pulsanti principali.',
      'Cerca: i risultati sono un\'unica striscia di biglietti invece di card sciolte una sotto l\'altra.',
    ],
  },
  {
    version: '0.36.0',
    date: '2026-09-14 19:32',
    changes: [
      'Andamento (vista mobile): stessi materiali già portati sul web — foglietto a quadretti scuro sovrapposto per "Umore nell\'anno" e "Mese per mese", grafico su carta millimetrata, ogni mese come biglietto — scalati per il telefono (grafico più alto, mesi alterni, niente numeri sull\'asse, come già faceva il grafico).',
    ],
  },
  {
    version: '0.35.1',
    date: '2026-09-14 19:14',
    changes: [
      'Barre mobile: risolti due bug della v0.35.0 — i pulsanti del footer (profilo/cerca/Gemini/nuova nota) erano impilati uno sopra l\'altro invece che in riga (mancava una regola CSS), e il pulsante della lente ora è un cerchio pulito in ogni caso.',
      'Vista mese/giorno da telefono: tolto un filtro decorativo dalle nuove barre superiore e inferiore (restavano comunque un filo irregolari) — troppi filtri SVG attivi insieme causavano un artefatto grafico ("glitch") sulle note in alcuni telefoni Android.',
    ],
  },
  {
    version: '0.35.0',
    date: '2026-09-14 18:56',
    changes: [
      'Barre mobile (superiore e inferiore): rifatte in stile "Pagine" — due fogli di cartoncino sovrapposti, come la barra laterale web, con un bordo seghettato irregolare sul foglio dietro invece di un\'ombra piatta.',
      'Mese, anno e la data in vista giorno sono ora targhette uniche di plastica giallo ocra con le frecce incorporate (tocca per aprire il selettore come prima, oppure usa le frecce per spostarti di un mese/anno/giorno alla volta).',
      'Vista giorno: l\'icona per cambiare aspetto della pagina non è più una matita (sembrava "scrivi qui") — ora due foglietti sovrapposti.',
      'Selettore Calendario/Andamento/Statistiche: un\'unica striscia di cartoncino bianco, con una targhetta in metallo dorato che inquadra la scheda attiva invece di uno sfondo scuro che trasla.',
      'Footer: "Opzioni" è ora la tua foto profilo (come la tessera in barra laterale), "Filtri" una lente d\'ingrandimento in ottone; "Nuova nota"/Gemini restano cartoncino nero pieno.',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-09-14 12:22',
    changes: [
      'Andamento (vista web): rifatta in stile "Pagine" — il grafico dell\'umore e l\'elenco mese-per-mese sono ora due fogli con un\'etichetta a quadretti sovrapposta (come l\'intestazione della vista giorno), non più un riquadro semplice.',
      'Andamento: il grafico ha uno sfondo a quadretti da carta millimetrata e 3 nuovi colori per le linee (grafite/penna blu/evidenziatore corallo); ogni mese nell\'elenco è un biglietto col nome per esteso e una mini-barra per ogni giorno.',
    ],
  },
  {
    version: '0.33.0',
    date: '2026-09-11 17:33',
    changes: [
      'Skin "Pagine" (vista giorno): il foglio è largo quanto la vista mese, senza più un tetto in pixel proprio; da telefono le 24h si comprimono per stare tutte nello schermo (come da web), invece di scorrere.',
      'Impostazioni: la data di iscrizione nella tessera profilo ora è completa (giorno e mese, non solo l\'anno); la foto profilo si allunga fino alla riga "Password" e ha due nastri adesivi decorativi; nome ed email sono in grassetto invece che a mano libera, per leggerli meglio; le strisce diagonali di sfondo sono più tenui; gli header delle sezioni si sollevano leggermente al passaggio del mouse.',
      'Barra laterale web: nome ed email nella tessera un po\' più piccoli (erano cresciuti troppo con gli ultimi ritocchi).',
      'Pagina di ricerca: "Luogo" ora si può richiudere come già "Persone".',
    ],
  },
  {
    version: '0.32.0',
    date: '2026-09-11 15:44',
    changes: [
      'Impostazioni (vista web): rifatte in stile "Pagine" — l\'intestazione di ogni sezione è ora un cartoncino a quadretti a tutta larghezza (icona, titolo e descrizione insieme), e ogni gruppo di parametri (Tema, Font, Persone, Luoghi...) ha il suo sotto-cartoncino con un bordo colorato.',
      'Impostazioni: la tessera del profilo in cima ora è la stessa finta carta d\'identità della barra laterale (timbro in filigrana, firma, striscia), con nome, email e una nuova password modificabili sul posto con una matitina.',
      'Impostazioni: "Elimina account" è ora una sezione vera (cartoncino rosso, sempre visibile) invece di un semplice link in fondo alla pagina.',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-09-11 14:26',
    changes: [
      'Barra laterale web: animazioni al passaggio del mouse su card profilo, Calendario/Andamento/Statistiche e Gemini; "Nuova nota" solleva ed ingrandisce un po\' di più. Nome ed email nella tessera +50%, foto profilo con angoli arrotondati e un contorno.',
      'Skin "Pagine" (vista mese web): il cartoncino dei titoli si allarga in base a quanto testo contiene invece di una larghezza fissa uguale per ogni giorno.',
      'Skin "Pagine": rimosso il segnalino sulla mappa del francobollo (si confondeva con la puntina che lo tiene fermo), sia in vista mese che vista giorno.',
      'Skin "Pagine" (vista giorno web): foglio ancora +35%; testo del contenuto nota più chiaro (meno peso rispetto al titolo); rovinatura del cartoncino più varia (strappi profondi misti a sfilacciature).',
      'Skin "Pagine": le targhette con il nome delle persone ora hanno lo stesso colore in vista mese e vista giorno (prima la vista giorno perdeva sfondo e testo del colore, restava solo il bordo) — il colore è generato dal nome e salvato sulla persona.',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-09-11 12:29',
    changes: [
      'Barra laterale web: rifatta nello stile "Pagine" — tutta la barra è un cartoncino strappato con un secondo foglio che intravede da dietro; "Nuova nota"/Gemini sono cartoncino nero pieno, i 3 link principali ritagli di carta col contorno a matita tratteggiato, "Cerca" una lente d\'ingrandimento, "Importa" un post-it giallo.',
      'Barra laterale web: i dati utente sono su una finta carta d\'identità in basso, con un numero di tessera e una firma disegnata generati da nome+email (sempre gli stessi per te); la versione dell\'app è accanto al nome "MyJournal" in alto.',
      'Impostazioni → Colori del mood: i 6 pallini colorati sopra il gradiente sono ora cliccabili (aprono il selettore colore) e si possono spostare le 4 soglie interne con un numero percento; rimossa la legenda separata sotto.',
      'Impostazioni → Dati utente: nuova sezione "Canzoni" con l\'elenco delle canzoni collegate alle note e quante note usa ciascuna.',
      'Skin "Pagine": il colore dei cartoncini del mood è ancora più saturo (altro +15%, ora +32% sul colore originale).',
      'Skin "Pagine" (vista mese mobile): la foto è ingrandita del 15% e il cartoncino delle note spostato ancora più a sinistra per compensare lo spazio.',
    ],
  },
  {
    version: '0.29.0',
    date: '2026-09-11 09:03',
    changes: [
      'Skin "Pagine" (vista giorno web): il foglio è più largo del 35% e il cartoncino della nota più largo (40–55% invece di 32–45%), per dare più spazio a titolo e contenuti; il testo del contenuto è più scuro e leggibile, e sfuma più tardi verso il basso.',
      'Skin "Pagine" (vista giorno web): il foglio non si scorre più, sta tutto nella pagina — le 24h si comprimono nello spazio disponibile invece che in un\'altezza fissa (la vista giorno da telefono continua a scorrere).',
      'Skin "Pagine": il colore dei cartoncini del mood (vista mese e vista giorno, web e telefono) è il 15% più saturo — le fasce d\'umore si distinguono meglio.',
    ],
  },
  {
    version: '0.28.0',
    date: '2026-09-11 08:46',
    changes: [
      'Skin "Pagine" (vista giorno mobile): stesso stile appena portato per il mese. Il cartoncino della nota è spostato verso l\'estremità sinistra del foglio (esce anche un filo dalla pagina) e sta sulla stessa riga di contatori e foto invece che sopra.',
      'Vista giorno mobile: persone, luogo e canzoni diventano semplici contatori (icona + numero) impilati in verticale fra cartoncino e foto, al posto delle targhette coi nomi, del francobollo/mappa e del dischetto CD — non c\'è spazio per i nomi. Luogo in rosso, canzone in verde.',
      'Vista giorno mobile: la foto di una nota diventa sempre una sola diapositiva; con più foto nella stessa nota scorrono a carosello nella stessa, con puntini che indicano quante sono.',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-09-11 08:37',
    changes: [
      'Skin "Pagine" (vista mese mobile): il cartoncino dei titoli è spostato verso l\'estremità sinistra del foglio (esce anche un filo dalla pagina) per recuperare spazio, e sta sulla stessa riga di targhette e foto invece che sopra.',
      'Vista mese mobile: le targhette di luogo e canzone diventano semplici contatori (icona + numero), come quella delle persone, invece di mostrare nome/titolo — occupavano troppo spazio; impilate in verticale fra cartoncino e foto. Luogo in rosso, canzone in verde.',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-09-11 08:18',
    changes: [
      'Skin "Pagine" (vista mese mobile): il cartoncino dei titoli si estende a tutta larghezza invece di fermarsi all\'80%/60%.',
      'Vista mese mobile: persone, luogo e canzone diventano targhette compatte con icona (persone: numero; luogo: nome col segnaposto; canzone: titolo con una musicassetta), al posto di avatar, francobollo e dischetto — se un giorno ha più luoghi o canzoni, il nome scorre a turno nella stessa targhetta.',
      'Vista mese mobile: le foto diventano sempre una sola diapositiva (prima due polaroid affiancate); con più foto scorrono a carosello nella stessa, con puntini che indicano quante sono.',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-09-11 08:02',
    changes: [
      'Skin "Pagine" anche per la vista giorno (web e telefono): il giorno diventa un foglio di diario con una timeline 24h a sinistra (l\'altezza del blocco segue la durata della nota) e le note come cartoncini strappati del colore del mood, titolo evidenziato in nero; a destra persone, luogo, canzone e foto come nella vista mese.',
      'La skin "Pagine" per la vista giorno scorre come una vera pagina, invece di schiacciarsi in una schermata come "Normale"/"Disegnata".',
      'Aspetto → Vista giorno: il pulsante dello stile ora cicla tra Normale, Disegnata e Pagine.',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-09-11 00:17',
    changes: [
      'Skin "Pagine" ora anche da telefono: se in Aspetto → "Vista mese" scegli "Pagine", la vista mese del telefono diventa pagine di diario impilate come sul web (carta, linguetta dell\'umore, nastro "· oggi ·", decori di sfondo).',
      'Su telefono l\'impaginato della skin "Pagine" passa in verticale: cartoncino della nota a tutta larghezza, poi persone, luogo e canzone in fila sotto, foto come piccola polaroid.',
      'Aspetto: il selettore "Vista mese" non è più marcato "(web)"; "Bacheca" resta solo da web.',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-09-11 00:00',
    changes: [
      'Skin "Pagine" (vista mese web): il cartoncino della nota segue i colori del mood personalizzati in Impostazioni (prima restava sui colori predefiniti).',
      'Skin "Pagine": giorno e cartoncino ancorati saldamente in alto a sinistra, senza più il vuoto sotto che li faceva sembrare centrati; tolto il segno rosso ai lati del giorno corrente (basta il nastro "oggi").',
      'Importa "Da foglio (testo)": ogni passata elabora al massimo 10 giorni per non saturare Gemini; i restanti si lavorano rilanciando con lo stesso file (i giorni già salvati vengono saltati).',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-09-10 23:25',
    changes: [
      'Skin "Pagine" (vista mese web): giorno e cartoncino dei titoli ancorati in alto a sinistra; il giorno corrente è segnato da un nastro adesivo rosso ("· oggi ·") che attraversa il centro alto della pagina, dritta e sollevata.',
      'Skin "Pagine": decori di sfondo su tutta la pagina con animali e natura (uccelli, pesci, cervi, alberi, felci) sotto ai disegnini a tema umore; disegni più piccoli e più numerosi.',
      'Skin "Pagine": nomi delle persone in grassetto e più leggibili, con più colori (tinta stabile per persona); dischetto della canzone più grande con titolo e autore ingranditi.',
      'Skin "Pagine": i giorni futuri restano pagine vuote e semplici (niente linguetta dell\'umore né testo segnaposto); foglio e cartoncini un po\' più larghi.',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-09-10 22:55',
    changes: [
      'Impostazioni: la sezione "Elenchi personali" diventa "Dati utente" e sale sopra le Integrazioni. Raccoglie i dati legati all\'account, sincronizzati su tutti i dispositivi.',
      'Dati utente → Colori del mood: si personalizzano i sei colori con cui l\'app rappresenta l\'umore delle note — dalla barra del mood alle pagine del mese alle statistiche — con anteprima e "Ripristina predefinito". La scelta è salvata sull\'account.',
      'Dati utente → Luoghi: si modificano nome e posizione di un luogo direttamente dall\'elenco (posizione scelta sulla mappa), senza doverne creare uno nuovo e sostituire il vecchio. La modifica si propaga a tutte le note collegate.',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-09-10 22:30',
    changes: [
      'Skin "Pagine" (vista mese web) ridisegnata a colonne: giorno in alto a sinistra, titoli su un cartoncino strappato del colore dell’umore, poi le persone, poi luogo e canzone, infine le fotografie.',
      'Skin "Pagine": il luogo è un francobollo con dentini e puntina che, se la nota ha coordinate, mostra una vera mini-mappa; la canzone è un dischetto con la copertina dell’album e, sotto, titolo e autore.',
      'Skin "Pagine": giorni feriali scritti in nero (weekend in rosso), linguetta dell’umore come nastro adesivo dello stesso colore del cartoncino, segnalibro rosso "oggi" sul giorno corrente.',
      'Skin "Pagine": più disegnini e frammenti dei titoli sullo sfondo, più piccoli e "dipinti"; foglio più largo.',
    ],
  },
  {
    version: '0.19.1',
    date: '2026-09-10 22:05',
    changes: [
      'Importa (solo web): nuova modalità "Da foglio (testo)" per migrare il vecchio diario tenuto su Google Fogli — si incolla o si carica l\'export TSV/CSV e si indicano le colonne (giorno, testo, titolo, voto).',
      'Ogni giornata viene divisa in una o più note: Gemini sceglie solo dove tagliare, senza riscrivere il testo, così il contenuto originale è sempre coperto per intero. In revisione la suddivisione si corregge con "Fondi con precedente/successiva" e "Spezza qui", con avvisi per i casi dubbi (troppi blocchi, blocco senza orario, ecc.) e il testo grezzo del giorno sempre a vista.',
      'Colonna "mese" opzionale: indicandola si può incollare più mesi in una volta (anche l\'anno intero) e lavorarli uno alla volta cambiando il menu Mese.',
      'I giorni che hanno già note salvate nel diario vengono saltati in automatico: si può ridare in pasto lo stesso file senza ricreare quanto già importato.',
      'La schermata "Importa da immagine" diventa "Importa", con l\'interruttore Da foglio / Da immagine.',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-09-10 21:10',
    changes: [
      'Impostazioni → Aspetto: nuovo sfondo "Immagine" — si carica una foto personale (resta solo sul dispositivo, ridimensionata).',
      'Skin "Pagine" (vista mese web): foglio più largo, testata del giorno in tonalità oro, niente più contatore di note, foto +15%.',
      'Skin "Pagine": nomi delle persone su più colonne a misura del nome; se il giorno ha un luogo compare un francobollo con mini-mappa, se ha una canzone un dischetto con la copertina.',
      'Skin "Pagine": più disegnini a tema umore e frammenti dei titoli delle note sbiaditi sullo sfondo, con qualche macchia di caffè; bordi del foglio e linguette leggermente irregolari.',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-09-10 19:25',
    changes: [
      'Skin "Pagine" (vista mese web) rifinita: foglio più largo, carta con grana/screziatura e bordi appena irregolari, disegnini a tema umore appena accennati nella metà destra del foglio, rotazione delle pagine più contenuta.',
      'Linguetta dell’umore: solo il numero (senza scritta "umore") e forma diversa per fascia — gagliardetto, pillola, bordo ondulato o frastagliato.',
      'Giorni con foto: due polaroid affiancate quando ci sono almeno due fotografie, con nastro adesivo più visibile; angoli piegati o bordo strappato assegnati a caso ad alcune pagine.',
      'Nomi delle persone del giorno su etichette di nastro (con foto del volto se disponibile da Immich), in colonna nello spazio tra le note e le fotografie.',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-09-10 17:07',
    changes: [
      'Vista mese (web): nuova skin "Pagine" — i giorni come pagine di diario impilate, con linguetta dell’umore a lato, testata rossa nei weekend, titoli in grafie diverse e polaroid attaccate col nastro per i giorni con foto.',
      'Vista mese (web): l’interruttore nell’header è ora a tre — Elenco / Bacheca / Pagine.',
      'Impostazioni → Aspetto: tre nuovi sfondi — Filigrana (carta vergata), Sughero e Legno (assi irregolari).',
    ],
  },
  {
    version: '0.15.1',
    date: '2026-09-09 15:11',
    changes: [
      'Statistiche (web): settimana migliore, giorno più su di morale, tag più usato e luogo più frequente affiancati alla lista "Persone più presenti" invece che in fondo alla pagina.',
      'Changelog ripulito: le versioni minori sono state accorpate in voci più ampie, per un elenco più corto da scorrere.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-09-09 11:26',
    changes: [
      'Statistiche: nuove voci "Note migliori" e "Note peggiori" (le 5 note singole con mood più alto/basso); "Persone più presenti" affiancata a settimana/giorno/tag/luogo migliori (web).',
      'Impostazioni: Persone, Tag e Luoghi raggruppati sotto "Elenchi personali", come già le Integrazioni.',
      'Ricerca: il filtro Luogo mostra i luoghi salvati come targhette da scegliere, non più una barra di testo.',
      'Luoghi già scritti in note esistenti vengono importati automaticamente nell\'elenco alla prima apertura di Impostazioni.',
    ],
  },
  {
    version: '0.14.1',
    date: '2026-09-09 10:59',
    changes: [
      'Nuova nota con Gemini: prompt salvato in automatico se la generazione fallisce (recuperato riaprendo il dialog), istruzioni personalizzate impostabili in Impostazioni, placeholder vario invece di un unico esempio fisso.',
      'Impostazioni: nuova sezione "Luoghi" (creazione, cancella/sostituisci se collegato a note); "Luoghi salvati" riproposti quando ne aggiungi uno a una nota.',
      'Statistiche: rimosso "Giorno più pieno"; giorni migliori/difficili mostrano tutte le note del giorno; "Giorno più su di morale" e "Settimana migliore" cliccabili (aprono le note corrispondenti).',
      'Impostazioni → Novità: changelog collassabile per versione.',
      'Web: "Esci"/"Elimina account" spostati in fondo alle Impostazioni come su mobile; sidebar senza più il pulsante di logout nella riga profilo, avatar più grande.',
      'Nuovi default per chi non ha ancora personalizzato l\'aspetto: tema chiaro, font tondeggiante, animazioni attive, sfondo rigato.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-09-08 17:01',
    changes: [
      'Impostazioni → Aspetto: stili grafici alternativi per una singola vista (interruttore rapido anche dentro la vista).',
      'Vista giorno "Disegnata" (web + mobile): sfondo carta, font a mano, righe/cornici tracciate a mano.',
      'Vista mese "Bacheca" (solo web): i giorni con contenuti diventano cartoncini su una bacheca di sughero, uniti da filo rosso se condividono persona/tag.',
      'Statistiche: le persone più presenti mostrano l\'avatar su targhette con bordo.',
      'Impostazioni (web): si possono cambiare nome utente ed email dell\'account; versione dell\'app spostata nella colonna di sinistra.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-09-08 15:20',
    changes: [
      'Micro-animazioni in tutta l\'app (transizioni, liste a cascata, contatori che salgono, skeleton di caricamento); interruttore "Animazioni" e scelta dello sfondo (8 texture stile diario) in Impostazioni → Aspetto.',
      'Selezione persone (nota e ricerca) limitata alle 10 più frequenti con "Mostra tutte"; conteggio note accanto a ogni persona in Impostazioni.',
      'Statistiche: classifica delle 10 persone più presenti, giorni migliori/difficili estesi a 5+5 con i titoli, nuove voci "Settimana migliore" e "Giorno più su di morale".',
    ],
  },
  {
    version: '0.10.9',
    date: '2026-09-07 22:41',
    changes: [
      'Vista mese (web) ridisegnata: anno/mese in un\'unica placchetta con frecce inglobate e menu a tendina per saltare a un valore lontano, righe centrate e più strette; titoli delle note sfumano gradualmente in base al mood invece di comparire a tutto o niente.',
      'Vista giorno ridisegnata (web come mobile): giornata sempre tutta a schermo senza scorrere, sfondo e righe orarie a tutta larghezza.',
      'Selettore persone: le più frequenti separate visivamente dal resto; Scegli da Immich con calendario "Vai al giorno" e fallback ad anteprima se l\'originale di una foto non è più disponibile.',
      'Ricerca (web): filtro persone collassabile con foto, risultati su una sola colonna.',
      'Eliminazione account dalle Impostazioni con doppia conferma (cancella anche note, persone e tag).',
    ],
  },
  {
    version: '0.9.6',
    date: '2026-09-07 16:33',
    changes: [
      '"In questo giorno" in vista mese, ricerca per testo, swipe tra giorni, tema chiaro/scuro/sistema e scelta del font, import/export in JSON o Markdown, coda offline, recap dell\'anno con Gemini, "nota dalle foto di ieri".',
      'Sicurezza: note, persone e tag diventano per-utente; registrazione pubblica gestita dalle regole del database.',
      'Changelog con data/ora per versione; versione dell\'app nella pagina di login.',
    ],
  },
  {
    version: '0.4.2',
    date: '2026-09-07 14:28',
    changes: [
      'Prime versioni dell\'app: importazione note da screenshot con Gemini (selettori completi per persone/tag/luogo/canzoni), Impostazioni raggruppate in sezioni collassabili con guide per i token delle integrazioni.',
      'Selettore persone con le più usate in cima; cancellare una persona collegata a note chiede se sostituirla o rimuoverla ovunque.',
      'Vista giorno: carosello per le note con più foto. Vista mese: titoli di tutte le note del giorno, non solo quelle con umore estremo.',
    ],
  },
]
