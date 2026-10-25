---
name: myjournal-note-rules
description: Regole per trascrivere i fogli Annales (xlsx) e i Docushare in note di MyJournal: come spezzare i giorni, titoli, orari, mood, persone e alias, tag, luoghi, sovrapposizioni. Da leggere PRIMA di creare o correggere note del diario.
---

# Regole delle note MyJournal

Documento completo con gli esempi: `Note/Analisi-note-MyJournal.md` (fuori dal repo, sul Desktop dell'utente).
Questa è la versione operativa. Le decisioni qui sotto sono dell'utente: non cambiarle senza chiedere.

## Come lavorare con l'utente
- **Le domande vanno tutte in coda alla risposta**, in un elenco «Domande in coda» (l'utente risponde a tutto insieme).
- **Mai note con orari sovrapposti.** Se ne trovi (nel piano o sul server) **chiedi prima** cosa fare, non correggere da solo.
- Prima di scrivere sul server chiedi conferma («le inserisco?»), salvo che l'utente l'abbia già chiesto nella stessa richiesta.
- Dubbi su note del passato (persone, luoghi, significato di abbreviazioni): **chiedi**, non indovinare.
- Riferisci l'esito con onestà: cosa è fatto, cosa è stimato, cosa non è stato controllato.

## Anatomia di una nota
- **Contenuto**: righe copiate tali e quali dall'xlsx o dal Docushare (refusi compresi). Cambi ammessi: ordine cronologico delle righe, scarto di righe di intestazione/date (`2026.05.14 / 85`), a-capo.
- **Titolo**: MAIUSCOLO, 2–5 parole, niente punto finale. Lavoro: `LAVORO - ARGOMENTO`. Se il foglio ha già un titolo breve (colonna G/E) usalo (maiuscolo). Altrimenti descrivi l'evento (luogo, persona, attività).
- **Spezzare i giorni**: 1–4 note per giorno, una per blocco di attività (lavoro / viaggio / pasto / serata / casa), sempre su un cambio di scena, mai a metà frase. Giorno senza scene distinte = una nota.
- **Una sola nota di lavoro al giorno**, mai divisa. Il lavoro occupa il suo orario d'ufficio (default 09:00–18:00; usa arrivo/uscita del testo se ci sono).
- **Orari** (`timeStart`/`timeEnd`): inizio = prima riga con orario o inizio reale della scena; fine = inizio della nota dopo o ultima riga. Passa la mezzanotte → la `date` resta quella del giorno di inizio. `~` = circa. Orari non scritti: stimali e basta (l'utente li accetta come definitivi, non chiedere conferme una per una).
- **Mai sovrapposizioni** (vedi sopra). Le note personali non possono coprire l'orario di lavoro.
- **Mood** (0–1): è quello della scena, attorno a H/100 (colonna H) meno 0,05–0,15 per le scene piatte e di lavoro; numeri dopo l'orario nel testo (`06.00 78 parto`) sono il mood a quell'ora. Vecchi fogli: un solo mood per mese.
- **Luogo**: di norma nessuno. Solo luoghi già salvati nell'app (es. «Casa Noemi»). **Mai** locali/negozi (Nicos…) né Statte.
- **Foto e canzoni**: non si deducono dal testo.

## Fonti
- **Docushare** (`yy.mm.dd`) è la fonte **più corretta per il lavoro** (anche per i giorni in cui l'xlsx non ha testo). Dall'xlsx restano solo gli **eventi con orario** che Docushare non ha (call, pause, messaggi) e **mai** i giudizi sul lavoro («non faccio quasi nulla»).
- Refusi noti nelle date Docushare: `25.12.13` = 3 dicembre 2025; `25.01.07/08` = 2026; `28.08.12–14` = 2026.
- Il Docushare esiste per il 2023–2026; prima non c'è lavoro da Docushare.

## Persone
Si assegnano le persone **presenti o coinvolte** (incontrate, sentite, a cui si scrive). **Solo citato ≠ presente**; chi viene lasciato all'inizio di una scena non è nella scena. Persone senza scheda in anagrafica: restano solo nel testo (non crearle senza che l'utente lo chieda). **Mai assegnare**: Melissa, Annalisa, Coli, Bryan.

Alias e ambiguità (valgono finché l'utente non dice altro):
- Pier → Pierangelo Remelli · mamma → Stefania Parascandolo · papà → Leonardo D'Ignazio · Fabio (lavoro) → Fabio Brigidi · Giorgio → Giorgio Xhaxho · Leandro → Leandro Geminale.
- **Andrea**: lavoro/Bologna → Andrea D'angelo; **Puglia (sociale) → Andrea Cesari**; Andrea Marazzi e Andrea Medoro solo **dopo il 26 aprile 2026**.
- **Matteo**: lavoro → Matteo Caselli (è anche l'amico presente solo nelle note quando è in Puglia); Matteo Momigliano è l'amico di Bologna (con Gabriele Fontanelli).
- **Luca**: lavoro → Luca Appio; **Puglia → Luca Caliandro**; Torino → Luca Cicala; altro Luca di Bologna/Elena → **Luca Napoletano**; Luca Bovenzi (Just Lost).
- **Giulia**: fino al **9 maggio 2026** = Giulia Palumbo; dopo non assegnare in automatico (Passerini, Mancini…); il 9 maggio 2026 al compleanno di Elena = Giulia Passerini.
- **Salvatore**: Cervia → **Salvatore Aquilina**; il barista (17 ott 2025) → **Salvatore (barista)**. **Aurora iMasterart** è una persona in anagrafica.
- **Nicos non è Nico**: Nicos è una focacceria in Puglia (non persona, non luogo); Nico = Niccolò Ferri, di Bologna, solo da giugno 2026.
- Altri: Valerio/Vale → Valerio Sabato · Jessica → Jessica Kokki · Graziana → Graziana Corvaglia · Noemi → Noemi Marangi · Martina (Puglia/Faggiano) → Martina Rita Corvaglia · Martina (Milano) → Martina Bottiglione · Carla → Carla D'Ignazio (Christian Longo è il suo compagno) · Clara → Clara · «Elena» → Elena Celandroni · Marco in Puglia → Marco Gulino · fra/frà → Francesco Greco · Gabriele → Gabriele Fontanelli · Milena → Milena Pozzi.
- «Martina», «Statte», ecc. possono essere **paesi**: «vado a Martina» = il paese (Martina Franca), non una persona.
- «La mamma di X» non è mamma. Gruppi nominati in elenco → tutte le persone riconoscibili; nomi ambigui senza contesto → nessuna.
- Per i **soprannomi non noti o le persone nuove** → chiedi (in coda).

## Tag
`Videogioco` (videogioco giocato: Smash, Expedition, Outer Wilds…) · `Gioco` (gioco da tavolo **e di carte**: Secret Hitler, Micro Macro, scopa…) · `Film` / `Serie TV` (non disegnata) / `Anime` (disegnata) / `Fumetto` / `Libro` (letto o visto) · `Sulla Luna` (viaggi sulla luna) · `Unobravo` (Elena Laguzzi sul sito) · `Pierfania` (società PierFania). Nessun tag se non c'è niente di tutto questo.

## Layout dei fogli
Vedi la skill `myjournal-analyze-sheet` e `scripts/mjlib.py` (profili `annales`, `y2016`, `y2017`, `y2018`, `y2019`). Per i fogli 2016–2018 (registri di momenti salienti, titolo già in colonna E, sonno `<`/`>`, `->` = fino a, mood solo mensile) vedi l'ultima sezione di `Note/Analisi-note-MyJournal.md`.

## Vecchi fogli (2016–2019): decisioni dell'utente
- **Righe del sonno** (`02:35 <`, `10:50 > 8:15`): **tolte** dalle note. **Suffisso `c`** dopo l'orario (`23:30c`): **tolto**. Righe scritte dal più recente al più vecchio: **riordinate** in senso cronologico (lo fa `normalize_old_lines` in `mjlib.py`).
- **Titolo**: quello della colonna E (maiuscolo); se manca, descrivi in 2–5 parole.
- **Mood**: un solo valore al mese sul foglio: usalo come base per le note di quel mese.
- **Voci senza giorno / da datare** (decisioni date): cerca la data reale degli eventi pubblici (Napoli Comicon 2016: 22–25 aprile → 22 aprile; 2017: 28 aprile–1 maggio; Pasquetta = lunedì dopo Pasqua, 17 aprile 2017); torneo Smash senza giorno → metà mese; «Inizio Blender» (mag 2017) → inizio maggio; torneo Smash Napoli 2017 → 21 maggio; Villa Alexia → 1 giugno; diploma → 5 luglio; cena di classe → 7 giugno 20:00–01:00 dell'8; capodanno con febbre da Matteo → 31 dicembre 2017. Se manca la regola, **chiedi**.
- **Giorni di viaggio** (Berlino, Verona, Lecce…): più note per giorno se il mood trasparisce dal testo, altrimenti note grandi per luogo.
- **Tornei Smash**: tag `Videogioco`, risultati W/L trascritti com'erano. **Film citati** → tag `Film`; «i celestini su Rai Play» → `Anime`. `Videogioco` solo se giocato.
- **Persone (vecchi anni)**: Pirozzi → Valerio Pirozzi · Peppe → Elisa DeBenedettis · Annio → Annio Masella · Vales/Vale → Valerio Sabato · Miki → Michele Panarelli · Giovanni → Giovanni Genga · Pamela Verducci → Pamela Verducci · Leppe → Giuseppe Carone · Bea/Beatrice → Beatrice Prenna · Bianca → Bianca Lore · **Gian → forse Gianandrea Muia (verificare caso per caso con l'utente)** · **Eleonora, Danilo, Fabiana: chiedere ogni volta** (Eleonora potrebbe essere la cugina).
- **Chi c'è in anagrafica va segnalato nella nota; chi manca va aggiunto** (lo script di import li crea con `--create-missing-people`). Nomi senza cognome noto: crea con il solo nome (es. «Bruno», «Nicole») e segnalalo in coda.
- Il piano può coprire più mesi: usa `month` per nota (vedi `build_notes.py`).
