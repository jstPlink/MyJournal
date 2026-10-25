"""Libreria comune per trascrivere i fogli Annales e i Docushare in note MyJournal.

Solo libreria standard + openpyxl. Nessun accesso alla rete.
"""
import json
import math
import re

import openpyxl

MESI = {
    'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4, 'maggio': 5, 'giugno': 6,
    'luglio': 7, 'agosto': 8, 'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12,
}

# Colonne (1 = A) dei vari layout dei fogli. `mood_per_row`: il mood 0-100 sta su ogni riga;
# altrimenti sta solo sulla riga del mese e vale per tutto il mese.
LAYOUTS = {
    # 2020+ : C mese (prima riga del mese), D lettera giorno, E giorno, F testo, G titolo, H mood
    'annales': dict(month=3, weekday=4, day=5, text=6, title=7, mood=8, mood_per_row=True),
    # 2016 e 2017 : B mese, C giorno, D testo, E titolo, F mood del mese
    'y2016': dict(month=2, day=3, text=4, title=5, mood=6, mood_per_row=False, old=True),
    'y2017': dict(month=2, day=3, text=4, title=5, mood=6, mood_per_row=False, old=True),
    # 2018 : A mese, B giorno settimana, C giorno, D testo, E titolo, F «sunto», G mood del mese
    'y2018': dict(month=1, weekday=2, day=3, text=4, title=5, summary=6, mood=7, mood_per_row=False, old=True),
    # 2019 : A mood, B mese, C giorno settimana, D giorno, E testo, F titolo, G appunti del mese
    'y2019': dict(mood=1, month=2, weekday=3, day=4, text=5, title=6, summary=7, mood_per_row=True, old=True),
}


def month_num(v):
    if v is None:
        return None
    s = str(v).strip().lower()
    if s in MESI:
        return MESI[s]
    for name, n in MESI.items():
        if len(s) >= 3 and name.startswith(s[:3]):
            return n
    return None


def _clean_cell(v):
    """Testo di una cella -> lista di righe (senza righe vuote). Gestisce =HYPERLINK(...)."""
    if v is None:
        return []
    s = str(v).replace('\r', '')
    m = re.match(r'^=HYPERLINK\("[^"]*","(.*)"\)$', s.strip())
    if m:
        s = m.group(1)
    return [l.rstrip() for l in s.split('\n') if l.strip()]


_SLEEP = re.compile(r'^\s*\d\d:\d\d~?\s*[<>](\s+[\d:~]+)?\s*$')
_TIME0 = re.compile(r'^\s*(\d\d):(\d\d)')


def normalize_old_lines(lines):
    """Regole per i vecchi fogli (2016-2019), decise dall'utente:
    - le righe del sonno (`02:35 <`, `10:50 > 8:15`) vengono TOLTE;
    - il suffisso `c` dopo l'orario (`23:30c`) viene tolto (significato sconosciuto);
    - se i blocchi con orario sono scritti dal più recente al più vecchio, l'ordine viene invertito
      (un blocco = riga con orario + righe senza orario che la seguono, es. i risultati W/L dei tornei).
    """
    out = [re.sub(r'(\b\d\d:\d\d)c\b', r'\1', l) for l in lines if not _SLEEP.match(l)]
    blocks = []
    for l in out:
        if _TIME0.match(l) or not blocks:
            blocks.append([l])
        else:
            blocks[-1].append(l)
    times = [int(_TIME0.match(b[0]).group(1)) * 60 + int(_TIME0.match(b[0]).group(2))
             for b in blocks if _TIME0.match(b[0])]
    down = sum(1 for a, b in zip(times, times[1:]) if a > b)
    up = sum(1 for a, b in zip(times, times[1:]) if a < b)
    if down > up:
        blocks.reverse()
    return [l for b in blocks for l in b]


def load_entries(xlsx, sheet, layout, year):
    """Elenco di voci del foglio: {row, year, month, day, weekday, lines, title, mood, summary}.

    `mood` è 0-1 oppure None. Per i layout con mood per mese, il mood del mese viene copiato su ogni voce.
    """
    cfg = LAYOUTS[layout]
    ws = openpyxl.load_workbook(xlsx, data_only=False)[sheet]
    entries, month_mood, cur_month = [], {}, None
    for r in range(1, ws.max_row + 1):
        def cell(key):
            col = cfg.get(key)
            return ws.cell(r, col).value if col else None
        m = month_num(cell('month'))
        if m:
            cur_month = m
        mood = cell('mood')
        if isinstance(mood, (int, float)) and not cfg['mood_per_row'] and cur_month and m:
            month_mood[cur_month] = float(mood) / 100
        day = cell('day')
        day = int(day) if isinstance(day, (int, float)) else None
        lines = _clean_cell(cell('text'))
        if cfg.get('old'):
            lines = normalize_old_lines(lines)
        title = ' '.join(_clean_cell(cell('title')))
        if not lines and not title and day is None:
            continue
        if not lines and not title:
            continue
        e = dict(row=r, year=year, month=cur_month, day=day, weekday=cell('weekday'),
                 lines=lines, title=title, summary=' '.join(_clean_cell(cell('summary'))),
                 mood=(float(mood) / 100 if isinstance(mood, (int, float)) and cfg['mood_per_row'] else None))
        entries.append(e)
    for e in entries:
        if e['mood'] is None:
            e['mood'] = month_mood.get(e['month'])
    return entries


def load_docushare(path, year, fixes=None):
    """{ (mese, giorno): [righe] } da un Docushare con intestazioni `yy.mm.dd`.

    `fixes`: dict "yy.mm.dd" -> "yy.mm.dd" per correggere i refusi di data (es. {"25.12.13": "25.12.03"}).
    Le righe `---`, `///---///` e `-` da sole vengono scartate.
    """
    fixes = fixes or {}
    out, cur = {}, None
    yy = year % 100
    for l in open(path, encoding='utf-8').read().replace('\r', '').split('\n'):
        s = l.strip()
        if re.match(r'^\d\d\.\d\d\.\d\d$', s):
            s = fixes.get(s, s)
            a, m, d = (int(x) for x in s.split('.'))
            cur = (m, d) if a == yy else None
            if cur:
                out.setdefault(cur, [])
            continue
        if s.startswith('///') or re.match(r'^-{4,}$', s) or s == '-':
            continue
        if cur and s:
            out[cur].append(s)
    return out


def load_people(export_json=None, extra=None):
    """name -> id e name -> id dei tag, da un export MyJournal (e/o un dict `extra` già pronto)."""
    people, tags = {}, {}
    if export_json:
        d = json.load(open(export_json, encoding='utf-8'))
        people = {p['name']: p['id'] for p in d.get('people', [])}
        tags = {t['name']: t['id'] for t in d.get('tags', [])}
    if extra:
        people.update(extra.get('people', {}))
        tags.update(extra.get('tags', {}))
    return people, tags


def to_min(hhmm):
    h, m = hhmm.split(':')
    return int(h) * 60 + int(m)


def overlaps(notes):
    """Coppie di note (titolo, titolo) con orari sovrapposti nello stesso mese.

    Le note che finiscono prima o alle ore di inizio non si sovrappongono; se fine <= inizio la nota
    passa la mezzanotte (fine + 24h).
    """
    iv = []
    for n in notes:
        s, e = to_min(n['start']), to_min(n['end'])
        if e <= s:
            e += 1440
        base = n['day'] * 1440
        iv.append((base + s, base + e, '%02d %s' % (n['day'], n['title'])))
    iv.sort()
    bad = []
    for i in range(len(iv)):
        for j in range(i + 1, len(iv)):
            if iv[j][0] < iv[i][1]:
                bad.append((iv[i][2], iv[j][2]))
    return bad


# ---- colore della targhetta (port di colorForName in src/lib/pagesSkin.js) ----
def _i32(x):
    x &= 0xFFFFFFFF
    return x - (1 << 32) if x & 0x80000000 else x


def _imul(a, b):
    return _i32((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF))


def _hash(s):
    h = 0
    for ch in s:
        h = _i32(h * 31 + ord(ch))
    h = _i32(h ^ ((h & 0xFFFFFFFF) >> 16))
    h = _imul(h, 0x85ebca6b)
    h = _i32(h ^ ((h & 0xFFFFFFFF) >> 13))
    h = _imul(h, 0xc2b2ae35)
    h = _i32(h ^ ((h & 0xFFFFFFFF) >> 16))
    return (math.fmod(h, 1e9) + 1e9) % 1e9


def _hsl(h, s, l):
    a = s * min(l, 1 - l)

    def f(n):
        k = (n + h / 30) % 12
        c = l - a * max(-1, min(k - 3, 9 - k, 1))
        return format(round(255 * c), '02x')
    return '#' + f(0) + f(8) + f(4)


def tape_color(name):
    key = (name or '').strip().lower()
    h = math.floor(_hash(key) / 4096)
    hue = (h % 24) * 15 + 6
    light = 0.5 if math.floor(h / 24) % 2 == 0 else 0.6
    return _hsl(hue, 0.5, light)
