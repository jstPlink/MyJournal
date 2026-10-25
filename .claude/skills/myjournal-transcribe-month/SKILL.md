---
name: myjournal-transcribe-month
description: Trascrive un mese del diario (xlsx Annales + Docushare) in note MyJournal pronte da importare, con piano JSON, controllo sovrapposizioni e persone mancanti. Usala quando l'utente chiede di «trascrivere/fare» un mese o un anno.
---

# Trascrivere un mese in note

Prima leggi la skill **`myjournal-note-rules`** (regole e alias). Script in `scripts/` (Python 3 + openpyxl).

## Procedura
1. **Controlla cosa c'è già sul server** per quel mese (note esistenti, persone). Con la sessione del browser o con `import_notes.py --dry-run`. Non duplicare mai note esistenti (vale la chiave data + titolo).
2. **Scheletro del piano**:
   ```
   python .claude/skills/myjournal-transcribe-month/scripts/draft_plan.py \
     --xlsx "C:\Users\plink\Desktop\Note\Dati\Annales 2020 - 2025.xlsx" --sheet 2025 --layout annales \
     --year 2025 --month 10 --docushare "C:\Users\plink\Desktop\Note\Dati\Docushare 2025.txt" \
     --fix 25.12.13=25.12.03 --out piano-2025-10.json
   ```
   Stampa, per ogni giorno, le righe numerate (`x1…` xlsx, `d1…` Docushare) e scrive un piano con **una nota per giorno**.
3. **Modifica il piano** (è il lavoro di giudizio): per ogni giorno spezza in note e per ognuna scrivi
   `title`, `start`, `end`, `mood`, `people` (nomi in anagrafica), `tags`, `lines`:
   `"x:1-4"` righe xlsx · `"d:1-6"` righe Docushare · `"t:testo"` testo letterale · oppure `"text"` intero.
   Lavoro = righe `d:` (+ eventuali righe `x:` con orario). Non sovrapporre gli orari.
4. **Costruisci le note**:
   ```
   python .claude/skills/myjournal-transcribe-month/scripts/build_notes.py piano-2025-10.json \
     --export "C:\Users\plink\Desktop\Note\Dati\myjournal-export-2026-10-24.json" \
     [--people-extra extra.json] --outdir "C:\Users\plink\Desktop\Note"
   ```
   Produce `YYYY-MM-note.json` (formato import) e `YYYY-MM-riepilogo.md` (da rileggere) e **stampa gli avvisi**:
   sovrapposizioni di orario, persone non in anagrafica, tag sconosciuti, note senza testo.
   `extra.json` = `{"people":{"Nome":"id"},"tags":{}}` per le persone create dopo l'export.
5. **Riferisci all'utente**: quante note, giorni senza note, scelte di persone/alias fatte, orari stimati,
   avvisi. **Le domande in coda alla fine.** Se ci sono sovrapposizioni chiedi prima cosa fare.
6. Per l'inserimento → skill **`myjournal-import-notes`**.

## Note pratiche
- Giorni senza testo né Docushare: nessuna nota. Giorni solo Docushare: solo nota di lavoro.
- Voci senza giorno (vecchi fogli): `draft_plan.py` le stampa a parte: chiedi all'utente come datarle.
- Testo identico all'originale: le specifiche `x:`/`d:` prendono le righe già pulite (righe vuote e separatori scartati).
- Mese dopo mese conviene tenere il piano come file: serve per correggere e rigenerare senza rifare tutto.
