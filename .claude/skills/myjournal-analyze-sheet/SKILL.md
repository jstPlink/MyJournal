---
name: myjournal-analyze-sheet
description: Analizza un foglio xlsx del diario (Annales) di un anno nuovo o vecchio per capire layout, colonne e convenzioni di scrittura prima di trascriverlo in note. Usala quando arriva un anno mai visto.
---

# Analizzare un foglio del diario

1. **Elenco fogli**: `python .claude/skills/myjournal-analyze-sheet/inspect_sheet.py "<file>.xlsx"`
2. **Struttura di un anno**: aggiungi il nome del foglio (`... 2018`). Mostra le colonne usate, le prime righe e le statistiche sulle convenzioni (`~`, `->`, `--:--`, sonno `<`/`>`, suffisso `c`, «discussione:», «muore:», tornei). `--all` stampa tutto (i fogli vecchi sono piccoli).
3. **Identifica il layout** e confrontalo con `LAYOUTS` in `.claude/skills/myjournal-transcribe-month/scripts/mjlib.py` (`annales`, `y2016`, `y2017`, `y2018`, `y2019`). Se non coincide aggiungi un profilo: numeri di colonna di mese / giorno della settimana / giorno / testo / titolo / mood, e se il mood è per riga o per mese.
4. **Cerca i pattern** (e annotali in `Note/Analisi-note-MyJournal.md`):
   - quanti giorni hanno testo e quanti hanno titolo; ordine delle righe (crescente o dal più recente);
   - formato degli orari e significato dei simboli;
   - tipi di evento ricorrenti (tornei, compleanni, spostamenti, spese…);
   - mood per giorno o per mese; voci senza giorno; formule (`=HYPERLINK`) nelle celle;
   - nomi di persone e luoghi ricorrenti da mappare con l'anagrafica.
5. **Elenca i dubbi** e portali all'utente **tutti insieme in coda alla risposta** (significato dei simboli, persone ignote, voci senza giorno).

Layout noti: 2016–2017 (B mese, C giorno, D testo, E titolo, F mood del mese) · 2018 (A mese, B giorno settimana, C giorno, D testo, E titolo, F «sunto», G mood del mese) · 2019 (A mood, B mese, C giorno settimana, D giorno, E testo, F titolo, G appunti) · 2020+ (C mese, D lettera giorno, E giorno, F testo, G titolo, H mood 0–100; 2020 usa il layout del 2019; **2021 verificato (25/10/2026)**: A1:N367, C mese, D lettera, E giorno, F testo, G titolo, H mood 0–100 per giorno (circa l'85% dei giorni; gli altri senza valore), I mediana settimanale, J mediana mensile in prima riga del mese; sonno = orario solo a inizio giorno; orari `HH:__`, `10:??`, `~`; 2022–2024 da verificare con lo script).
I file dell'utente stanno in `C:\Users\plink\Desktop\Note\Dati\` (xlsx, Docushare 2023–2025, export JSON); non copiarli nel repo.
