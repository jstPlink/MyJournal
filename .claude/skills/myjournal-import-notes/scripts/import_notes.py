#!/usr/bin/env python
"""Importa nel server MyJournal i file *-note.json prodotti da build_notes.py.

L'email e la password le chiede LO SCRIPT sul terminale (la password non viene mostrata né salvata).
Solo libreria standard.

  python import_notes.py 2025-10-note.json 2025-11-note.json            # inserisce il mancante
  python import_notes.py 2025-10-note.json --dry-run                    # non scrive nulla
  python import_notes.py 2025-10-note.json --update-existing            # aggiorna anche quelle già presenti
  python import_notes.py --create-people "Mario Rossi" "Anna Bianchi"   # crea persone (con colore targhetta)

Idempotente: una nota è «già presente» se esiste con la stessa data e lo stesso titolo.
Alla fine verifica: totali per mese, doppioni e sovrapposizioni di orario nei mesi toccati.
Variabili d'ambiente opzionali: MJ_URL, MJ_EMAIL, MJ_PASSWORD (per non digitare).
"""
import argparse
import getpass
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..',
                                'myjournal-transcribe-month', 'scripts'))
import mjlib  # noqa: E402

DEFAULT_URL = 'https://myjournal.fplinio.it'


class Api:
    def __init__(self, url):
        self.url = url.rstrip('/')
        self.token = None
        self.user = None

    def call(self, method, path, body=None):
        req = urllib.request.Request(self.url + path, method=method,
                                     data=json.dumps(body).encode('utf-8') if body is not None else None)
        req.add_header('Content-Type', 'application/json')
        # Cloudflare (error code 1010) rifiuta lo User-Agent predefinito di Python-urllib
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                                     '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')
        req.add_header('Accept', 'application/json')
        if self.token:
            req.add_header('Authorization', self.token)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8') or '{}')
        except urllib.error.HTTPError as e:
            raise SystemExit('Errore %s %s: %s' % (e.code, path, e.read().decode('utf-8', 'replace')[:300]))

    def login(self, email, password):
        j = self.call('POST', '/api/collections/users/auth-with-password',
                      {'identity': email, 'password': password})
        self.token, self.user = j['token'], j['record']['id']

    def list_notes(self, d1, d2):
        out, page = [], 1
        flt = urllib.parse.quote('date>="%s 00:00:00" && date<"%s 00:00:00"' % (d1, d2))
        while True:
            j = self.call('GET', '/api/collections/note/records?perPage=500&page=%d&fields=id,date,title,'
                                 'timeStart,timeEnd&filter=%s' % (page, flt))
            out += j['items']
            if page >= j['totalPages']:
                return out
            page += 1


def month_range(date_str):
    y, m = int(date_str[:4]), int(date_str[5:7])
    ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
    return '%d-%02d-01' % (y, m), '%d-%02d-01' % (ny, nm)


def check_month(api, d1, d2):
    items = api.list_notes(d1, d2)
    keys = [i['date'][:10] + '|' + i['title'] for i in items]
    notes = []
    for i in items:
        notes.append(dict(day=int(i['date'][8:10]), title=i['title'],
                          start=i['timeStart'][11:16], end=i['timeEnd'][11:16]))
    return len(items), len(keys) - len(set(keys)), mjlib.overlaps(notes)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='*')
    ap.add_argument('--url', default=os.environ.get('MJ_URL', DEFAULT_URL))
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--update-existing', action='store_true')
    ap.add_argument('--create-people', nargs='+', metavar='NOME')
    ap.add_argument('--create-missing-people', action='store_true',
                    help='crea in anagrafica le persone citate nelle note (campo _people) che non esistono')
    a = ap.parse_args()
    if not a.files and not a.create_people:
        ap.error('indica almeno un file *-note.json oppure --create-people')

    notes = []
    for f in a.files:
        notes += json.load(open(f, encoding='utf-8'))
    print('Note nei file: %d' % len(notes))

    email = os.environ.get('MJ_EMAIL') or input('Email: ').strip()
    password = os.environ.get('MJ_PASSWORD') or getpass.getpass('Password (non viene mostrata): ')
    api = Api(a.url)
    api.login(email, password)
    print('Accesso eseguito.')

    if a.create_people:
        existing = {p['name'] for p in api.call('GET', '/api/collections/people/records?perPage=500&fields=name')['items']}
        for name in a.create_people:
            if name in existing:
                print('Persona già presente:', name)
            elif a.dry_run:
                print('[dry-run] creerei la persona', name, mjlib.tape_color(name))
            else:
                j = api.call('POST', '/api/collections/people/records',
                             {'name': name, 'user': api.user, 'tapeColor': mjlib.tape_color(name)})
                print('Persona creata: %s (%s)' % (name, j['id']))

    if not notes:
        return
    # nomi -> id letti dal server (i file contengono `_people` e `_tags` con i NOMI)
    people = {p['name']: p['id'] for p in api.call('GET', '/api/collections/people/records?perPage=500&fields=id,name')['items']}
    tags = {t['name']: t['id'] for t in api.call('GET', '/api/collections/tags/records?perPage=200&fields=id,name')['items']}
    missing = sorted({n for x in notes for n in x.get('_people', []) if n not in people})
    if missing:
        if a.create_missing_people and not a.dry_run:
            for name in missing:
                j = api.call('POST', '/api/collections/people/records',
                             {'name': name, 'user': api.user, 'tapeColor': mjlib.tape_color(name)})
                people[name] = j['id']
                print('Persona creata: %s (%s)' % (name, j['id']))
        else:
            print('PERSONE NON IN ANAGRAFICA (lasciate fuori dalle note; usa --create-missing-people):', ', '.join(missing))
    for x in notes:
        if '_people' in x:
            x['people'] = [people[n] for n in x['_people'] if n in people]
        if '_tags' in x:
            x['tags'] = [tags[t] for t in x['_tags'] if t in tags]
        x.pop('_people', None)
        x.pop('_tags', None)
    months = sorted({n['date'][:7] for n in notes})
    existing = {}
    for m in months:
        d1, d2 = month_range(m + '-01')
        for it in api.list_notes(d1, d2):
            existing[it['date'][:10] + '|' + it['title']] = it['id']
    created = updated = skipped = 0
    for n in notes:
        key = n['date'][:10] + '|' + n['title']
        if key in existing:
            if a.update_existing and not a.dry_run:
                api.call('PATCH', '/api/collections/note/records/' + existing[key], n)
                updated += 1
            else:
                skipped += 1
            continue
        if a.dry_run:
            created += 1
            continue
        api.call('POST', '/api/collections/note/records', dict(n, user=api.user))
        created += 1
    print('%s: create %d, aggiornate %d, già presenti (saltate) %d' % (
        '[dry-run]' if a.dry_run else 'Fatto', created, updated, skipped))

    if not a.dry_run:
        for m in months:
            d1, d2 = month_range(m + '-01')
            total, dupes, ov = check_month(api, d1, d2)
            print('Verifica %s: %d note sul server, doppioni %d, sovrapposizioni %d' % (m, total, dupes, len(ov)))
            for x, z in ov:
                print('   sovrapposte:', x, '<->', z)


if __name__ == '__main__':
    main()
