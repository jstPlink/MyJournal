# syntax=docker/dockerfile:1
#
# Backend PocketBase per un'istanza MyJournal self-hosted: scarica il binario
# ufficiale e applica lo schema in pb_migrations/ al primo avvio (note,
# people, tags + i campi custom su users), più gli hook JS in pb_hooks/ (cron
# dei recap automatici giorno/mese/anno — vedi pb_hooks/main.pb.js). Versione
# pinnata alla stessa serie (0.28.x) del pacchetto `pocketbase` in
# package.json — se aggiorni l'SDK, aggiorna anche PB_VERSION qui.

FROM alpine:3.20

ARG PB_VERSION=0.28.4

# tzdata: i cron di pb_hooks (es. "ogni notte alle 00:30") vanno letti
# nell'ora locale, non UTC — serve il database dei fusi orari sull'immagine
# perché Go/goja possano risolvere TZ qui sotto.
RUN apk add --no-cache ca-certificates tzdata unzip curl \
  && ARCH="$(uname -m)" \
  && case "$ARCH" in \
       x86_64) PB_ARCH=amd64 ;; \
       aarch64) PB_ARCH=arm64 ;; \
       *) echo "Architettura non supportata: $ARCH" >&2; exit 1 ;; \
     esac \
  && curl -fsSL -o /tmp/pb.zip \
       "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" \
  && unzip /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip \
  && apk del unzip curl

ENV TZ=Europe/Rome

WORKDIR /pb
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks

EXPOSE 8090
VOLUME /pb/pb_data

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/api/health || exit 1

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
