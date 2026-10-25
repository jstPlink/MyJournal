#!/usr/bin/env python
"""Ispeziona un foglio xlsx del diario per capire il layout e le convenzioni di scrittura.

  python inspect_sheet.py "Annales 2016 - 2019.xlsx"            # elenco fogli e dimensioni
  python inspect_sheet.py "Annales 2016 - 2019.xlsx" 2018       # riepilogo + prime righe del foglio
  python inspect_sheet.py "Annales 2016 - 2019.xlsx" 2018 --all # tutte le celle non vuote

Stampa: intestazioni, colonne usate, righe-mese, conteggio di voci/titoli, e statistiche sulle convenzioni
(`~`, `->`, `--:--`, `<`/`>` del sonno, suffisso `c`, «discussione:», «muore:», tornei...).
"""
import argparse
import collections
import re

import openpyxl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx')
    ap.add_argument('sheet', nargs='?')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--rows', type=int, default=25)
    a = ap.parse_args()
    wb = openpyxl.load_workbook(a.xlsx, data_only=False)
    if not a.sheet:
        for ws in wb:
            print(ws.title, ws.dimensions)
        return
    ws = wb[a.sheet]
    print('FOGLIO', ws.title, ws.dimensions)
    used = collections.Counter()
    for row in ws.iter_rows():
        for c in row:
            if c.value is not None:
                used[c.column_letter] += 1
    print('celle non vuote per colonna:', dict(sorted(used.items())))
    limit = ws.max_row if a.all else a.rows
    shown = 0
    for row in ws.iter_rows():
        vals = [(c.coordinate, c.value) for c in row if c.value is not None]
        if vals:
            print(vals)
            shown += 1
            if shown >= limit:
                print('... (usa --all per vedere tutto)')
                break
    text_cols = [c for c, n in used.items() if n > 5]
    stats = collections.Counter()
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and len(c.value) > 12:
                t = c.value
                stats['tilde'] += len(re.findall(r'\d\d[:.]\d\d ?~', t))
                stats['freccia ->'] += t.count('->')
                stats['--:--'] += t.count('--:--')
                stats['sonno < >'] += len(re.findall(r'\d\d:\d\d [<>]', t))
                stats['suffisso c'] += len(re.findall(r'\d\d:\d\dc', t))
                stats['orari HH:MM'] += len(re.findall(r'\b\d\d:\d\d\b', t))
                stats['orari HH.MM'] += len(re.findall(r'\b\d\d\.\d\d\b', t))
                for k in ('discussione:', 'muore:', 'torneo', 'auguri', 'test'):
                    if k in t.lower():
                        stats[k] += 1
    print('colonne con più di 5 celle:', text_cols)
    print('convenzioni:', dict(stats))


if __name__ == '__main__':
    main()
