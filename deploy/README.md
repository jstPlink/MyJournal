# Deploy sul NAS (immagini pre-buildate)

Flusso: **GitHub Actions builda e pubblica le immagini su GHCR** (frontend +
PocketBase bundled), il **NAS le scarica ed esegue**. Il NAS non ha bisogno
del codice sorgente né di Node, solo di [`docker-compose.yaml`](docker-compose.yaml).

## 1. Una volta sola — abilitare la pubblicazione delle immagini

1. Il workflow [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml)
   parte a ogni push su `main` (o su un tag `vX.Y.Z`, o manualmente da
   *Actions → Publish Docker image → Run workflow*) e pubblica **due** package.
2. Dopo il primo run, su GitHub compaiono i package
   **`ghcr.io/jstplink/annalesclaude`** e **`ghcr.io/jstplink/annalesclaude-pocketbase`**
   (sezione *Packages* del profilo/repo).
3. Scegliere come farli scaricare dal NAS (stessa scelta per entrambi):
   - **Package pubblico** (più semplice): *Package settings → Change visibility → Public*.
     Il NAS scarica senza autenticazione.
   - **Package privato**: creare un GitHub **Personal Access Token (classic)** con
     scope `read:packages` e fare login sul NAS:
     ```bash
     echo <TOKEN> | docker login ghcr.io -u jstPlink --password-stdin
     ```

## 2. Sul NAS

### Synology (Container Manager) / QNAP (Container Station)

1. Copiare `docker-compose.yaml` sul NAS (o incollarne il contenuto).
2. Container Manager → **Progetto** → *Crea* → sorgente: il file compose.
3. Avviare. L'app risponde su `http://<ip-nas>:8973` (la porta a sinistra in
   `ports:` — cambiala se 8973 è occupata; la `80` a destra è interna al
   container, non toccarla).

### Da riga di comando (SSH)

```bash
mkdir -p /volume1/docker/myjournal && cd /volume1/docker/myjournal
# copiare qui docker-compose.yaml
docker compose up -d
```

Al **primo avvio** il container `myjournal-pocketbase` parte con un database
vuoto (le collection vengono create da sole dalle migration): per accedere
se serve un superuser (l'admin UI non è pubblicata, vedi sotto) lo si crea dall'interno:

```bash
docker compose exec pocketbase /pb/pocketbase superuser upsert admin@tuodominio.it "una-password-lunga"
```

## 3. Aggiornare

Dopo un nuovo push su `main`, Actions ricostruisce `:latest`. Sul NAS:

```bash
docker compose pull && docker compose up -d
docker image prune -f          # opzionale, libera le vecchie immagini
```

Su Synology: *Container Manager → Progetto → Azione → Ricostruisci* (fa pull + restart).

## 4. Esporre su Internet con Cloudflare

Il compose pubblica sulla LAN **una sola porta**: `8973:80` (frontend).
PocketBase è interno: non ha porte pubblicate, lo raggiunge il container
`myjournal` (nginx) che inoltra le chiamate `/api/` dell'app. Basta quindi **un
solo hostname** (es. `myjournal.tuodominio.it`): niente secondo hostname per il
database, niente URL da configurare nell'app.

**Opzione A — Cloudflare Tunnel**: nel tunnel un solo *public hostname*
- `myjournal.tuodominio.it` → **Service = `http://localhost:8973`** (oppure
  `http://myjournal-diario:80` se `cloudflared` gira sulla stessa rete Docker).

Eventuali vecchi hostname del database si possono togliere dal tunnel.

**Opzione B — reverse proxy del NAS + DNS proxied**: un record DNS proxied
(arancione) e una regola del reverse proxy verso la porta `8973`.

Quello che colleghi è la porta host del NAS (`8973`), mai la porta interna del
container.

## Amministrazione del database

L'admin UI e il login da superuser non passano dal proxy (sono chiusi da
nginx). Per interventi a mano: `docker exec myjournal-pocketbase ...` oppure,
temporaneamente, aggiungere `ports: ["28090:8090"]` al servizio `pocketbase`
(e rimuoverlo a lavoro finito).

## Note

- **Backend PocketBase**: gira **bundled sul NAS**
  (`ghcr.io/jstplink/annalesclaude-pocketbase`) ed è interno all'app: il
  frontend lo raggiunge sulla propria origin (`/api/`, proxy nginx), non
  serve nessun URL del database nella build.
- **Dati**: vivono nel volume Docker `pb_data` (definito in
  `docker-compose.yaml`), non nel container — sopravvivono a
  `pull`/`up`/`restart`. Si perdono solo con `docker compose down -v` o
  cancellando il volume a mano.
- **Architettura**: entrambe le immagini sono multi-arch (`amd64` + `arm64`),
  funzionano sia sui NAS Intel sia su quelli ARM.
