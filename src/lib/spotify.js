// Integrazione Spotify: ricerca brani (richiede Client ID/Secret configurati
// in Profilo — Client Credentials flow, nessun login personale necessario)
// e lettura titolo/copertina da un link incollato a mano (oEmbed pubblico,
// nessuna credenziale richiesta, usato come fallback).

const TRACK_RE = /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/

// Legge il messaggio d'errore reale dalla risposta Spotify (quando presente),
// per mostrare all'utente il motivo vero invece di una diagnosi indovinata.
async function readSpotifyErrorDetail(res) {
  try {
    const data = await res.json()
    return data?.error?.message || data?.error_description || ''
  } catch {
    return ''
  }
}

// { url, title, thumbnailUrl }
export async function fetchSpotifyTrack(url) {
  const clean = String(url || '').trim()
  if (!TRACK_RE.test(clean)) {
    throw new Error('Non sembra un link a un brano Spotify (open.spotify.com/track/...).')
  }
  const res = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(clean)}`,
  )
  if (!res.ok) {
    throw new Error('Impossibile leggere i dati del brano da Spotify.')
  }
  const data = await res.json()
  return {
    url: clean,
    title: data.title || 'Brano Spotify',
    thumbnailUrl: data.thumbnail_url || '',
  }
}

// Client Credentials flow: token valido solo per il catalogo pubblico,
// nessun accesso ai dati personali dell'account.
export async function getSpotifyToken(clientId, clientSecret) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    const detail = await readSpotifyErrorDetail(res)
    const err = new Error(detail || 'Client ID/Secret Spotify non validi.')
    err.status = res.status
    err.detail = detail
    throw err
  }
  const data = await res.json()
  return data.access_token
}

// [{ url, title, artist, thumbnailUrl }]
export async function searchSpotifyTracks(token, query) {
  // Le app in Development Mode sembrano ora limitate a un `limit` massimo
  // più basso di 50 sull'endpoint search: 12 dava "invalid limit" (2026-09-06).
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    const detail = await readSpotifyErrorDetail(res)
    const err = new Error(detail || 'Ricerca Spotify non riuscita.')
    err.status = res.status
    err.detail = detail
    throw err
  }
  const data = await res.json()
  return (data?.tracks?.items || []).map((t) => ({
    url: t.external_urls?.spotify || '',
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    thumbnailUrl: t.album?.images?.[t.album.images.length > 1 ? 1 : 0]?.url || '',
  }))
}

export function describeSpotifyError(err) {
  if (!err) return 'Errore sconosciuto.'
  if (err.detail) return `Spotify: ${err.detail}`
  if (err.status === 400 || err.status === 401) {
    return 'Client ID/Secret Spotify non validi.'
  }
  if (err.status) return `Errore Spotify (${err.status}).`
  if (err.name === 'TypeError') return 'Impossibile raggiungere Spotify (rete).'
  return err.message || String(err)
}
