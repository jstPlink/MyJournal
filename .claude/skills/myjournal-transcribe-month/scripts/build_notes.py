#!/usr/bin/env python
"""Trasforma il piano (JSON) in note pronte per l'importazione + riepilogo leggibile.

  python build_notes.py piano-2025-10.json --export myjournal-export.json --people-extra extra.json --outdir Note

Formato del piano (vedi draft_plan.py):
  notes[]: day, title, start, end ("HH:MM"), mood (0-1), people [nomi], tags [nomi], place ("" o JSON),
           lines [specifiche], oppure text (testo letterale).
  Specifiche di `lines`:  "x:3"  "x:2-5"  riga/e dell'xlsx del giorno (1-based, dopo aver tolto le righe vuote)
                          "d:1-4" righe del Docushare del giorno
                          "t:testo" testo letterale
                          {"x":"3-5","day":2} per prendere righe di un altro giorno (raro)

Controlli (stampati, non bloccanti salvo --strict): sovrapposizioni di orario, persone non in anagrafica,
tag sconosciuti, note senza testo, orari non validi.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mjlib  # noqa: E402


def pick(lines, rng):
    if '-' in rng:
        a, b = rng.split('-')
        a, b = int(a), int(b)
    else:
        a = b = int(rng)
    return lines[a - 1:b]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan')
    ap.add_argument('--export', help='export JSON di MyJournal (opzionale: i nomi di persone e tag vengono comunque '
                                     'risolti dallo script di import sul server; senza export non ci sono avvisi '
                                     'sulle persone mancanti)')
    ap.add_argument('--people-extra', help='JSON {"people":{nome:id},"tags":{nome:id}} con persone create dopo l\'export')
    ap.add_argument('--outdir', default='.')
    ap.add_argument('--strict', action='store_true')
    a = ap.parse_args()

    plan = json.load(open(a.plan, encoding='utf-8'))
    y, mo, layout = plan['year'], plan['month'], plan['layout']
    extra = json.load(open(a.people_extra, encoding='utf-8')) if a.people_extra else None
    people, tags = mjlib.load_people(a.export, extra)

    entries = mjlib.load_entries(plan['xlsx'], plan['sheet'], layout, y)
    xl_by_day = {}
    for e in entries:
        if e['day']:
            xl_by_day.setdefault((e['month'], e['day']), []).extend(e['lines'])
    ds = mjlib.load_docushare(plan['docushare'], y, plan.get('fixes')) if plan.get('docushare') else {}

    warnings, out, md = [], [], []
    md.append('# Note di %02d/%d (riepilogo)\n' % (mo, y))
    cur = None
    for n in plan['notes']:
        d = n['day']
        nm = n.get('month', mo)   # un piano può coprire più mesi: `month` per nota
        if 'text' in n:
            text_lines = n['text'].split('\n')
        else:
            text_lines = []
            for spec in n['lines']:
                if isinstance(spec, dict):
                    dd = spec.get('day', d)
                    text_lines += pick(xl_by_day.get((spec.get('month', nm), dd), []), spec['x'])
                elif spec.startswith('t:'):
                    text_lines.append(spec[2:])
                elif spec.startswith('x:'):
                    text_lines += pick(xl_by_day.get((nm, d), []), spec[2:])
                elif spec.startswith('d:'):
                    text_lines += pick(ds.get((nm, d), []), spec[2:])
                else:
                    warnings.append('specifica sconosciuta %r (giorno %d)' % (spec, d))
        text = '\n'.join(text_lines).strip('\n')
        if not text:
            warnings.append('nota senza testo: %02d %s' % (d, n['title']))
        for k in ('start', 'end'):
            if not re.match(r'^\d\d:\d\d$', n[k]):
                warnings.append('orario non valido %s=%r in %02d %s' % (k, n[k], d, n['title']))
        ids = []
        for p in n.get('people', []):
            if p in people:
                ids.append(people[p])
            elif a.export or extra:
                warnings.append('PERSONA NON IN ANAGRAFICA: %s (%02d %s)' % (p, d, n['title']))
        tag_ids = []
        for t in n.get('tags', []):
            if t in tags:
                tag_ids.append(tags[t])
            elif a.export or extra:
                warnings.append('TAG SCONOSCIUTO: %s (%02d %s)' % (t, d, n['title']))
        out.append(dict(content=text.replace('\n', '\r\n'),
                        date='%d-%02d-%02d 00:00:00.000Z' % (n.get('year', y), nm, d), images=[], mood=round(n['mood'], 2),
                        people=ids, place=n.get('place', ''), songs=[], tags=tag_ids,
                        timeEnd='2000-01-01 %s:00.000Z' % n['end'], timeStart='2000-01-01 %s:00.000Z' % n['start'],
                        title=n['title'].upper(),
                        _people=n.get('people', []), _tags=n.get('tags', [])))
        if (nm, d) != cur:
            cur = (nm, d)
            md.append('\n## %d/%d/%d\n' % (d, nm, y))
        md.append('### %s\n- Orario: %s → %s · Mood: %s · Persone: %s · Tag: %s\n\n```\n%s\n```\n' % (
            n['title'].upper(), n['start'], n['end'], str(n['mood']).replace('.', ','),
            ', '.join(n.get('people', [])) or '—', ', '.join(n.get('tags', [])) or '—', text))

    for x, z in mjlib.overlaps([dict(day=(n.get('month', mo) + 12 * (n.get('year', y) - y)) * 40 + n['day'], title=n['title'], start=n['start'], end=n['end'])
                                for n in plan['notes']]):
        warnings.append('SOVRAPPOSIZIONE DI ORARI: %s <-> %s' % (x, z))

    os.makedirs(a.outdir, exist_ok=True)
    base = os.path.join(a.outdir, '%d-%02d' % (y, mo))
    json.dump(out, open(base + '-note.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(base + '-riepilogo.md', 'w', encoding='utf-8').write('\n'.join(md))
    print('%d note scritte in %s-note.json e %s-riepilogo.md' % (len(out), base, base))
    for w in warnings:
        print('ATTENZIONE:', w)
    if a.strict and warnings:
        sys.exit(1)


if __name__ == '__main__':
    main()
