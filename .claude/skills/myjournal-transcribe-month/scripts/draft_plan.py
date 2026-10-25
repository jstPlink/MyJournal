#!/usr/bin/env python
"""Stampa le righe numerate di un mese (xlsx + Docushare) e crea lo scheletro del piano.

Esempio (2025, ottobre):
  python draft_plan.py --xlsx "Annales 2020 - 2025.xlsx" --sheet 2025 --layout annales \
      --year 2025 --month 10 --docushare "Docushare 2025.txt" --out piano-2025-10.json

Lo scheletro ha UNA nota per ogni giorno con tutte le righe xlsx: poi si modifica a mano (o con Claude):
si spezza il giorno in più note, si scelgono i titoli, le persone, i tag, gli orari.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mjlib  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--xlsx', required=True)
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--layout', required=True, choices=sorted(mjlib.LAYOUTS))
    ap.add_argument('--year', type=int, required=True)
    ap.add_argument('--month', type=int, required=True)
    ap.add_argument('--docushare')
    ap.add_argument('--fix', action='append', default=[],
                    help='correzione refuso data Docushare "yy.mm.dd=yy.mm.dd" (ripetibile)')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    entries = [e for e in mjlib.load_entries(a.xlsx, a.sheet, a.layout, a.year) if e['month'] == a.month]
    fixes = dict(f.split('=', 1) for f in a.fix)
    ds = mjlib.load_docushare(a.docushare, a.year, fixes) if a.docushare else {}

    by_day = {}
    for e in entries:
        by_day.setdefault(e['day'], []).append(e)
    days = sorted(set(d for d in by_day if d) | {d for (m, d) in ds if m == a.month})

    notes = []
    for d in days:
        print('=' * 70)
        print('GIORNO %d/%d/%d' % (d, a.month, a.year))
        xl = [l for e in by_day.get(d, []) for l in e['lines']]
        titles = [e['title'] for e in by_day.get(d, []) if e['title']]
        mood = next((e['mood'] for e in by_day.get(d, []) if e['mood'] is not None), None)
        if titles:
            print('  titolo xlsx:', ' | '.join(titles), '| mood:', mood)
        for i, l in enumerate(xl, 1):
            print('  x%d: %s' % (i, l))
        dl = ds.get((a.month, d), [])
        for i, l in enumerate(dl, 1):
            print('  d%d: %s' % (i, l))
        spec = []
        if dl:
            spec.append('d:1-%d' % len(dl))
        if xl:
            spec.append('x:1-%d' % len(xl))
        notes.append(dict(day=d, title=(titles[0].upper() if titles else ''), start='10:00', end='19:00',
                          mood=mood if mood is not None else 0.7, people=[], tags=[], lines=spec))
    for e in entries:
        if not e['day']:
            print('=' * 70)
            print('VOCE SENZA GIORNO (riga %d):' % e['row'], e['title'], e['lines'])

    plan = dict(year=a.year, month=a.month, xlsx=a.xlsx, sheet=a.sheet, layout=a.layout,
                docushare=a.docushare, fixes=fixes, notes=notes)
    json.dump(plan, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\nScheletro scritto in', a.out)


if __name__ == '__main__':
    main()
