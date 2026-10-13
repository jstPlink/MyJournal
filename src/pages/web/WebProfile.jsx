import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VersionTap from '../../components/VersionTap'
import ExistingMatches, { findExact } from '../../components/ExistingMatches'
import { useAuth } from '../../context/AuthContext'
import { pb, isLocal } from '../../lib/pocketbase'
import {
  describeError,
  listNotesWithPerson,
  reassignPersonInNotes,
  peopleUsageCounts,
  listNotesWithPlace,
  reassignPlaceInNotes,
  placesUsageCounts,
} from '../../lib/notes'
import {
  testImmichConnection,
  listImmichPeople,
  describeImmichError,
} from '../../lib/immich'
import {
  listPeople,
  createPerson,
  createPersonFromImmich,
  deletePerson,
} from '../../lib/people'
import { listTags, createTag, deleteTag } from '../../lib/tags'
import {
  listPlaces,
  deletePlace,
  updatePlace,
  upsertPlaceIfMissing,
  syncPlacesFromNotes,
} from '../../lib/places'
import { getSpotifyToken, describeSpotifyError } from '../../lib/spotify'
import {
  testGeminiKey,
  describeGeminiError,
  saveGeminiCustomInstructions,
} from '../../lib/gemini'
import { downloadIntegrationDoc } from '../../lib/integrationDocs'
import PersonAvatar from '../../components/PersonAvatar'
import ImmichPeoplePicker from '../../components/ImmichPeoplePicker'
import PlacePickerSheet from '../../components/PlacePickerSheet'
import AppearanceControls from '../../components/AppearanceControls'
import SoundSettings from '../../components/SoundSettings'
import MoodGradientControls from '../../components/MoodGradientControls'
import SongsUsageList from '../../components/SongsUsageList'
import ExportButtons from '../../components/ExportButtons'
import OfflineStorage from '../../components/OfflineStorage'
import RecapInstructions from '../../components/RecapInstructions'
import GeminiUsage from '../../components/GeminiUsage'
import { Capacitor } from '@capacitor/core'
import Changelog from '../../components/Changelog'
import DeleteAccount from '../../components/DeleteAccount'
import BackendInfo from '../../components/BackendInfo'
import Icon from '../../components/Icon'
import ProfileCard from '../../components/web/ProfileCard'
import SettingsSection from '../../components/SettingsSection'
import SupportSection from '../../components/SupportSection'
import { sortByName } from '../../lib/sort'
import MymapIntegration from '../../components/MymapIntegration'

// Link a una guida .md scaricabile su come ottenere il token/credenziali.
function TokenHelp({ which }) {
  return (
    <button
      type="button"
      onClick={() => downloadIntegrationDoc(which)}
      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
    >
      <Icon name="download" size={13} className="shrink-0" />
      Come ottenerlo (guida)
    </button>
  )
}

export default function WebProfile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [immichUrl, setImmichUrl] = useState(user?.immichUrl || '')
  const [immichApiKey, setImmichApiKey] = useState(user?.immichApiKey || '')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState(null)

  const immichReady = Boolean(user?.immichUrl && user?.immichApiKey)
  const [people, setPeople] = useState([])
  const [peopleUsage, setPeopleUsage] = useState(null)
  const [peopleError, setPeopleError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [creatingPerson, setCreatingPerson] = useState(false)
  const [personToDelete, setPersonToDelete] = useState(null)
  const [replacementId, setReplacementId] = useState('')
  const [cascadeBusy, setCascadeBusy] = useState(false)
  const [tags, setTags] = useState([])
  const [tagsError, setTagsError] = useState('')
  const [newTag, setNewTag] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [removingTagId, setRemovingTagId] = useState('')

  const [places, setPlaces] = useState([])
  const [placesUsage, setPlacesUsage] = useState(null)
  const [placesError, setPlacesError] = useState('')
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const [removingPlaceId, setRemovingPlaceId] = useState('')
  const [placeToDelete, setPlaceToDelete] = useState(null)
  const [placeReplacementId, setPlaceReplacementId] = useState('')
  const [placeCascadeBusy, setPlaceCascadeBusy] = useState(false)
  // Modifica di un luogo esistente (nome + posizione), con propagazione
  // automatica alle note collegate.
  const [editingPlace, setEditingPlace] = useState(null) // { ...place } in corso di modifica
  const [placeEditName, setPlaceEditName] = useState('')
  const [placeEditBusy, setPlaceEditBusy] = useState(false)
  const [placeMapOpen, setPlaceMapOpen] = useState(false)

  const [spotifyClientId, setSpotifyClientId] = useState(user?.spotifyClientId || '')
  const [spotifyClientSecret, setSpotifyClientSecret] = useState(
    user?.spotifyClientSecret || '',
  )
  const [savingSpotify, setSavingSpotify] = useState(false)
  const [testingSpotify, setTestingSpotify] = useState(false)
  const [spotifyStatus, setSpotifyStatus] = useState(null)

  const [geminiApiKey, setGeminiApiKey] = useState(user?.geminiApiKey || '')
  const [savingGemini, setSavingGemini] = useState(false)
  const [testingGemini, setTestingGemini] = useState(false)
  const [geminiStatus, setGeminiStatus] = useState(null)
  // Istruzioni fisse aggiunte a ogni richiesta di "Nuova nota con Gemini"
  // (tono, cosa evidenziare/evitare...). Salvate sull'utente: valgono sugli
  // stessi dispositivi.
  const [geminiInstructions, setGeminiInstructions] = useState(
    user?.geminiCustomInstructions || '',
  )
  const [savingGeminiInstructions, setSavingGeminiInstructions] = useState(false)
  const [geminiInstructionsStatus, setGeminiInstructionsStatus] = useState(null)

  useEffect(() => {
    setImmichUrl(user?.immichUrl || '')
    setImmichApiKey(user?.immichApiKey || '')
    setSpotifyClientId(user?.spotifyClientId || '')
    setSpotifyClientSecret(user?.spotifyClientSecret || '')
    setGeminiApiKey(user?.geminiApiKey || '')
    setGeminiInstructions(user?.geminiCustomInstructions || '')
  }, [user])

  async function saveGemini() {
    setSavingGemini(true)
    setGeminiStatus(null)
    try {
      await pb.collection('users').update(user.id, {
        geminiApiKey: geminiApiKey.trim(),
      })
      setGeminiStatus({ ok: true, message: 'Salvato.' })
    } catch (err) {
      setGeminiStatus({ ok: false, message: describeError(err) })
    } finally {
      setSavingGemini(false)
    }
  }

  async function saveGeminiInstructions() {
    setSavingGeminiInstructions(true)
    setGeminiInstructionsStatus(null)
    try {
      await saveGeminiCustomInstructions(geminiInstructions)
      setGeminiInstructionsStatus({ ok: true, message: 'Salvato.' })
    } catch (err) {
      setGeminiInstructionsStatus({ ok: false, message: describeError(err) })
    } finally {
      setSavingGeminiInstructions(false)
    }
  }

  async function testGemini() {
    setTestingGemini(true)
    setGeminiStatus(null)
    try {
      await testGeminiKey(geminiApiKey.trim())
      setGeminiStatus({ ok: true, message: 'Connessione riuscita.' })
    } catch (err) {
      setGeminiStatus({ ok: false, message: describeGeminiError(err) })
    } finally {
      setTestingGemini(false)
    }
  }

  async function saveSpotify() {
    setSavingSpotify(true)
    setSpotifyStatus(null)
    try {
      await pb.collection('users').update(user.id, {
        spotifyClientId: spotifyClientId.trim(),
        spotifyClientSecret: spotifyClientSecret.trim(),
      })
      setSpotifyStatus({ ok: true, message: 'Salvato.' })
    } catch (err) {
      setSpotifyStatus({ ok: false, message: describeError(err) })
    } finally {
      setSavingSpotify(false)
    }
  }

  async function testSpotify() {
    setTestingSpotify(true)
    setSpotifyStatus(null)
    try {
      await getSpotifyToken(spotifyClientId.trim(), spotifyClientSecret.trim())
      setSpotifyStatus({ ok: true, message: 'Connessione riuscita.' })
    } catch (err) {
      setSpotifyStatus({ ok: false, message: describeSpotifyError(err) })
    } finally {
      setTestingSpotify(false)
    }
  }

  useEffect(() => {
    listPeople()
      .then(setPeople)
      .catch((err) => setPeopleError(describeError(err)))
    listTags()
      .then(setTags)
      .catch((err) => setTagsError(describeError(err)))
    listPlaces()
      .then(async (loaded) => {
        setPlaces(loaded)
        // Sincronizzazione una tantum (idempotente): i luoghi già scritti
        // in note esistenti prima che "Luoghi" esistesse come elenco
        // curato non ci finiscono da soli — li recupera qui, silenziosa,
        // così l'elenco si autocompleta al primo giro.
        try {
          const { places: updated, created } = await syncPlacesFromNotes(loaded)
          if (created > 0) setPlaces(updated)
        } catch {
          // sincronizzazione best-effort: l'elenco già caricato resta valido
        }
      })
      .catch((err) => setPlacesError(describeError(err)))
    peopleUsageCounts()
      .then(setPeopleUsage)
      .catch(() => {})
    placesUsageCounts()
      .then(setPlacesUsage)
      .catch(() => {})
  }, [])

  async function addTag() {
    const name = newTag.trim()
    if (!name || creatingTag) return
    const dup = findExact(tags, name)
    if (dup) {
      setTagsError(`«${dup.name}» esiste già.`)
      return
    }
    setCreatingTag(true)
    setTagsError('')
    try {
      const rec = await createTag(name)
      setTags((prev) => [...prev, rec].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTag('')
    } catch (err) {
      setTagsError(describeError(err))
    } finally {
      setCreatingTag(false)
    }
  }

  async function removeTag(id) {
    setRemovingTagId(id)
    try {
      await deleteTag(id)
      setTags((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setTagsError(describeError(err))
    } finally {
      setRemovingTagId('')
    }
  }

  // Aggiunto tramite PlacePickerSheet (ricerca/mappa): l'upsert evita
  // duplicati se il luogo era già stato salvato in precedenza.
  async function addPlace(place) {
    setPlacesError('')
    try {
      const rec = await upsertPlaceIfMissing(place, places)
      if (rec && !places.some((p) => p.id === rec.id)) {
        setPlaces((prev) => [...prev, rec].sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch (err) {
      setPlacesError(describeError(err))
    }
  }

  async function removePlace(id) {
    setRemovingPlaceId(id)
    setPlacesError('')
    try {
      const place = places.find((p) => p.id === id)
      const linked = await listNotesWithPlace(place.name)
      if (linked.length === 0) {
        await deletePlace(id)
        setPlaces((prev) => prev.filter((p) => p.id !== id))
      } else {
        setPlaceReplacementId('')
        setPlaceToDelete({ place, notes: linked })
      }
    } catch (err) {
      setPlacesError(describeError(err))
    } finally {
      setRemovingPlaceId('')
    }
  }

  // mode: 'replace' (sostituisci con placeReplacementId) | 'detach' (togli e basta).
  async function confirmPlaceCascade(mode) {
    if (!placeToDelete || placeCascadeBusy) return
    const { place, notes } = placeToDelete
    const to =
      mode === 'replace' ? places.find((p) => p.id === placeReplacementId) : null
    if (mode === 'replace' && !to) return
    setPlaceCascadeBusy(true)
    setPlacesError('')
    try {
      await reassignPlaceInNotes(to, notes)
      await deletePlace(place.id)
      setPlaces((prev) => prev.filter((p) => p.id !== place.id))
      setPlaceToDelete(null)
    } catch (err) {
      setPlacesError(describeError(err))
    } finally {
      setPlaceCascadeBusy(false)
    }
  }

  function startEditPlace(place) {
    setEditingPlace({ ...place })
    setPlaceEditName(place.name)
    setPlacesError('')
  }

  function cancelEditPlace() {
    setEditingPlace(null)
    setPlaceEditName('')
  }

  // Salva nome/posizione del luogo in modifica e, se qualcosa è cambiato,
  // riscrive il campo `place` di tutte le note collegate (nome + coordinate).
  async function savePlaceEdit() {
    if (!editingPlace || placeEditBusy) return
    const newName = placeEditName.trim()
    if (!newName) return
    const orig = places.find((p) => p.id === editingPlace.id) || editingPlace
    const updated = {
      name: newName,
      lat: editingPlace.lat ?? null,
      lon: editingPlace.lon ?? null,
    }
    const changed =
      newName.toLowerCase() !== orig.name.trim().toLowerCase() ||
      (updated.lat ?? null) !== (orig.lat ?? null) ||
      (updated.lon ?? null) !== (orig.lon ?? null)
    setPlaceEditBusy(true)
    setPlacesError('')
    try {
      const linked = changed ? await listNotesWithPlace(orig.name) : []
      await updatePlace(editingPlace.id, updated)
      if (linked.length) await reassignPlaceInNotes(updated, linked)
      setPlaces((prev) =>
        prev
          .map((p) => (p.id === editingPlace.id ? { ...p, ...updated } : p))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      setEditingPlace(null)
      setPlaceEditName('')
      placesUsageCounts().then(setPlacesUsage).catch(() => {})
    } catch (err) {
      setPlacesError(describeError(err))
    } finally {
      setPlaceEditBusy(false)
    }
  }

  async function addPerson(immichPerson) {
    const rec = await createPersonFromImmich(immichPerson)
    setPeople((prev) => [...prev, rec].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function addLocalPerson() {
    const name = newPersonName.trim()
    if (!name || creatingPerson) return
    const dup = findExact(people, name)
    if (dup) {
      setPeopleError(`«${dup.name}» esiste già.`)
      return
    }
    setCreatingPerson(true)
    setPeopleError('')
    try {
      const rec = await createPerson(name)
      setPeople((prev) =>
        [...prev, rec].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setNewPersonName('')
    } catch (err) {
      setPeopleError(describeError(err))
    } finally {
      setCreatingPerson(false)
    }
  }

  async function removePerson(id) {
    setRemovingId(id)
    setPeopleError('')
    try {
      const linked = await listNotesWithPerson(id)
      if (linked.length === 0) {
        await deletePerson(id)
        setPeople((prev) => prev.filter((p) => p.id !== id))
      } else {
        setReplacementId('')
        setPersonToDelete({ person: people.find((p) => p.id === id), notes: linked })
      }
    } catch (err) {
      setPeopleError(describeError(err))
    } finally {
      setRemovingId('')
    }
  }

  // mode: 'replace' (sostituisci con replacementId) | 'detach' (togli e basta).
  async function confirmCascade(mode) {
    if (!personToDelete || cascadeBusy) return
    const { person, notes } = personToDelete
    const toId = mode === 'replace' ? replacementId : null
    if (mode === 'replace' && !toId) return
    setCascadeBusy(true)
    setPeopleError('')
    try {
      await reassignPersonInNotes(person.id, toId, notes)
      await deletePerson(person.id)
      setPeople((prev) => prev.filter((p) => p.id !== person.id))
      setPersonToDelete(null)
    } catch (err) {
      setPeopleError(describeError(err))
    } finally {
      setCascadeBusy(false)
    }
  }

  // Il nome è salvato come copia locale al momento dell'aggiunta: se viene
  // rinominata su Immich, qui va risincronizzata a mano.
  async function refreshNamesFromImmich() {
    setRefreshing(true)
    setPeopleError('')
    try {
      const immichPeople = await listImmichPeople(immichUrl, immichApiKey)
      const nameById = new Map(immichPeople.map((p) => [p.id, p.name]))
      const toUpdate = people.filter(
        (p) =>
          p.immichPersonId &&
          nameById.has(p.immichPersonId) &&
          nameById.get(p.immichPersonId) !== p.name,
      )
      for (const p of toUpdate) {
        await pb
          .collection('people')
          .update(p.id, { name: nameById.get(p.immichPersonId) })
      }
      if (toUpdate.length) {
        setPeople(await listPeople())
      }
    } catch (err) {
      setPeopleError(describeImmichError(err))
    } finally {
      setRefreshing(false)
    }
  }

  async function saveImmich() {
    setSaving(true)
    setStatus(null)
    try {
      await pb.collection('users').update(user.id, {
        immichUrl: immichUrl.trim(),
        immichApiKey: immichApiKey.trim(),
      })
      setStatus({ ok: true, message: 'Salvato.' })
    } catch (err) {
      setStatus({ ok: false, message: describeError(err) })
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setStatus(null)
    try {
      await testImmichConnection(immichUrl.trim(), immichApiKey.trim())
      setStatus({ ok: true, message: 'Connessione riuscita.' })
    } catch (err) {
      setStatus({ ok: false, message: describeImmichError(err) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 font-serif text-4xl font-semibold tracking-tight text-ink">
        Profilo
      </h1>

      <ProfileCard />

      <SettingsSection title="Aspetto" icon="settings">
        <AppearanceControls />
      </SettingsSection>

      <SettingsSection title="Suoni" icon="music">
        <SoundSettings />
      </SettingsSection>

      <SettingsSection title="Dati utente" icon="list">
        <SettingsSection nested title="Colori del mood" icon="sparkles">
          <MoodGradientControls />
        </SettingsSection>

        <SettingsSection nested title="Persone" icon="user">
        <p className="text-sm text-ink-soft">
          Elenco delle persone selezionabili nelle note. Aggiungine dal tuo
          Immich o creane una nuova qui.
        </p>

        {peopleError && <p className="mt-3 text-sm text-delete-dark">{peopleError}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Nuova persona…"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLocalPerson()}
            className="min-w-[10rem] flex-1 rounded-full border border-line bg-cream px-4 py-2 text-sm text-ink outline-none focus:border-ink-soft"
          />
          <button
            type="button"
            disabled={!newPersonName.trim() || creatingPerson}
            onClick={addLocalPerson}
            className="shrink-0 rounded-full border border-save-dark bg-save px-4 py-2 text-sm font-bold text-ink transition disabled:opacity-50"
          >
            {creatingPerson ? '…' : 'Crea'}
          </button>
          <button
            type="button"
            disabled={!immichReady}
            onClick={() => setPickerOpen(true)}
            title={immichReady ? undefined : 'Configura prima Immich'}
            className="shrink-0 rounded-full border border-line bg-cream px-4 py-2 text-sm font-bold text-ink transition hover:bg-tag disabled:opacity-50"
          >
            + Aggiungi da Immich
          </button>
          {people.length > 0 && (
            <button
              type="button"
              disabled={!immichReady || refreshing}
              onClick={refreshNamesFromImmich}
              title={
                immichReady
                  ? 'Aggiorna i nomi se sono cambiati su Immich'
                  : 'Configura prima Immich'
              }
              className="shrink-0 rounded-full border border-line bg-cream px-4 py-2 text-sm font-bold text-ink transition hover:bg-tag disabled:opacity-50"
            >
              {refreshing ? 'Aggiorno…' : 'Aggiorna nomi'}
            </button>
          )}
        </div>
        <ExistingMatches className="mt-2" query={newPersonName} items={people} label="Persone già presenti" />

        {people.length > 0 && (
          <div className="mt-4 space-y-1">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <PersonAvatar person={person} immichUrl={immichUrl} immichApiKey={immichApiKey} />
                <span className="flex-1 text-sm font-medium text-ink">{person.name}</span>
                {peopleUsage && (
                  <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                    {peopleUsage[person.id] || 0}{' '}
                    {(peopleUsage[person.id] || 0) === 1 ? 'nota' : 'note'}
                  </span>
                )}
                <button
                  type="button"
                  title="Rimuovi"
                  disabled={removingId === person.id}
                  onClick={() => removePerson(person.id)}
                  className="shrink-0 rounded-full border border-line px-2 py-0.5 text-ink-soft transition hover:border-delete-dark hover:text-delete-dark disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        </SettingsSection>

        <SettingsSection nested title="Tag" icon="tag">
        <p className="text-sm text-ink-soft">
          Elenco dei tag selezionabili nelle note.
        </p>

        {tagsError && <p className="mt-3 text-sm text-delete-dark">{tagsError}</p>}

        {tags.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {sortByName(tags).map((tag) => (
              <span
                key={tag.id}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-cream py-1.5 pl-3 pr-2 text-sm font-medium text-ink"
              >
                <Icon name="tag" size={13} className="shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                <button
                  type="button"
                  title="Rimuovi"
                  disabled={removingTagId === tag.id}
                  onClick={() => removeTag(tag.id)}
                  className="rounded-full p-1 text-ink-soft transition hover:text-delete-dark disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Nuovo tag…"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-2 text-sm text-ink outline-none focus:border-ink-soft"
          />
          <button
            type="button"
            disabled={!newTag.trim() || creatingTag}
            onClick={addTag}
            className="shrink-0 rounded-full border border-save-dark bg-save px-4 py-2 text-sm font-bold text-ink transition disabled:opacity-50"
          >
            {creatingTag ? '…' : 'Crea'}
          </button>
        </div>
        <ExistingMatches className="mt-2" query={newTag} items={tags} label="Tag già presenti" />
        </SettingsSection>

        <SettingsSection nested title="Luoghi" icon="map-pin">
        <p className="text-sm text-ink-soft">
          Elenco dei luoghi selezionabili nelle note. Vengono aggiunti anche
          automaticamente quando ne scegli uno da una nota. Modificando nome o
          posizione, l'aggiornamento si propaga a tutte le note collegate.
        </p>

        {placesError && <p className="mt-3 text-sm text-delete-dark">{placesError}</p>}

        {places.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-1">
            {sortByName(places).map((place) => {
              const editing = editingPlace?.id === place.id
              return (
                <div key={place.id} className={'min-w-0 rounded-xl px-1 py-1.5' + (editing ? ' col-span-3' : '')}>
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={placeEditName}
                        onChange={(e) => setPlaceEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && savePlaceEdit()}
                        placeholder="Nome del luogo"
                        className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPlaceMapOpen(true)}
                          className="flex items-center gap-1 rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-tag"
                        >
                          <Icon name="map-pin" size={12} />
                          {editingPlace.lat != null
                            ? 'Sposta sulla mappa'
                            : 'Posiziona sulla mappa'}
                        </button>
                        {editingPlace.lat != null && (
                          <span className="text-xs tabular-nums text-ink-soft">
                            {Number(editingPlace.lat).toFixed(4)},{' '}
                            {Number(editingPlace.lon).toFixed(4)}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={placeEditBusy || !placeEditName.trim()}
                          onClick={savePlaceEdit}
                          className="ml-auto rounded-full border border-save-dark bg-save px-4 py-1.5 text-xs font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
                        >
                          {placeEditBusy ? 'Salvo…' : 'Salva'}
                        </button>
                        <button
                          type="button"
                          disabled={placeEditBusy}
                          onClick={cancelEditPlace}
                          className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-tag disabled:opacity-50"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-cream text-ink-soft">
                        <Icon name="map-pin" size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{place.name}</span>
                      {placesUsage && (
                        <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                          {placesUsage[place.name.trim().toLowerCase()] || 0}{' '}
                          {(placesUsage[place.name.trim().toLowerCase()] || 0) === 1
                            ? 'nota'
                            : 'note'}
                        </span>
                      )}
                      <button
                        type="button"
                        title="Modifica"
                        onClick={() => startEditPlace(place)}
                        className="shrink-0 rounded-full border border-line px-2 py-0.5 text-ink-soft transition hover:border-ink hover:text-ink"
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button
                        type="button"
                        title="Rimuovi"
                        disabled={removingPlaceId === place.id}
                        onClick={() => removePlace(place.id)}
                        className="shrink-0 rounded-full border border-line px-2 py-0.5 text-ink-soft transition hover:border-delete-dark hover:text-delete-dark disabled:opacity-50"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPlaceSheetOpen(true)}
            className="shrink-0 rounded-full border border-line bg-cream px-4 py-2 text-sm font-bold text-ink transition hover:bg-tag"
          >
            + Aggiungi luogo
          </button>
        </div>
        </SettingsSection>

        <SettingsSection nested title="Canzoni" icon="music">
          <p className="text-sm text-ink-soft">
            Le canzoni collegate alle note, con quante note le usano
            ciascuna. Sola lettura: si aggiungono dalle note stesse.
          </p>
          <SongsUsageList />
        </SettingsSection>
      </SettingsSection>

      <SettingsSection
        title="Integrazioni"
        icon="link"
      >
        <SettingsSection nested title="Immich" icon="image">
        <p className="text-sm text-ink-soft">
          Collega il tuo server Immich per scegliere le foto da lì quando
          aggiungi immagini a una nota.
        </p>
        <TokenHelp which="immich" />

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              URL server
            </span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://immich.tuodominio.it"
              value={immichUrl}
              onChange={(e) => setImmichUrl(e.target.value)}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              API key
            </span>
            <input
              type="password"
              placeholder="Da Immich → Account → API Keys"
              value={immichApiKey}
              onChange={(e) => setImmichApiKey(e.target.value)}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
            />
          </label>

          {status && (
            <p
              className={
                'text-sm ' + (status.ok ? 'text-save-dark' : 'text-delete-dark')
              }
            >
              {status.message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || !immichUrl.trim() || !immichApiKey.trim()}
              className="flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-tag disabled:opacity-50"
            >
              {testing ? 'Verifico…' : 'Testa connessione'}
            </button>
            <button
              type="button"
              onClick={saveImmich}
              disabled={saving}
              className="flex-1 rounded-full border border-save-dark bg-save px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {saving ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </div>
        </SettingsSection>

        <SettingsSection nested title="MyMap" icon="map-pin">
          <MymapIntegration web />
        </SettingsSection>

        <SettingsSection nested title="Spotify" icon="music">
        <p className="text-sm text-ink-soft">
          Client ID/Secret di un'app Spotify (Client Credentials) per cercare
          canzoni da aggiungere alle note, senza incollare link a mano.
        </p>
        <TokenHelp which="spotify" />

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Client ID
            </span>
            <input
              type="text"
              value={spotifyClientId}
              onChange={(e) => setSpotifyClientId(e.target.value)}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Client Secret
            </span>
            <input
              type="password"
              value={spotifyClientSecret}
              onChange={(e) => setSpotifyClientSecret(e.target.value)}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
            />
          </label>

          {spotifyStatus && (
            <p
              className={
                'text-sm ' +
                (spotifyStatus.ok ? 'text-save-dark' : 'text-delete-dark')
              }
            >
              {spotifyStatus.message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={testSpotify}
              disabled={
                testingSpotify || !spotifyClientId.trim() || !spotifyClientSecret.trim()
              }
              className="flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-tag disabled:opacity-50"
            >
              {testingSpotify ? 'Verifico…' : 'Testa connessione'}
            </button>
            <button
              type="button"
              onClick={saveSpotify}
              disabled={savingSpotify}
              className="flex-1 rounded-full border border-save-dark bg-save px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {savingSpotify ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </div>
        </SettingsSection>

        <SettingsSection nested title="Gemini" icon="sparkles">
        <p className="text-sm text-ink-soft">
          Chiave API di Google AI Studio per ripulire il testo delle note e
          scrivere contenuti con l'IA.
        </p>
        <TokenHelp which="gemini" />

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            API key
          </span>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-ink outline-none focus:border-ink-soft"
          />
        </label>

        {geminiStatus && (
          <p
            className={
              'text-sm ' + (geminiStatus.ok ? 'text-save-dark' : 'text-delete-dark')
            }
          >
            {geminiStatus.message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={testGemini}
            disabled={testingGemini || !geminiApiKey.trim()}
            className="flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-tag disabled:opacity-50"
          >
            {testingGemini ? 'Verifico…' : 'Testa connessione'}
          </button>
          <button
            type="button"
            onClick={saveGemini}
            disabled={savingGemini}
            className="flex-1 rounded-full border border-save-dark bg-save px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
          >
            {savingGemini ? 'Salvo…' : 'Salva'}
          </button>
        </div>

        <SettingsSection nested noCollapse title="Istruzioni per le note" icon="edit">
          <p className="text-sm text-ink-soft">
            Aggiunte a ogni richiesta di "Nuova nota con Gemini" (tono da
            usare, cosa evidenziare o evitare...). Salvate sul tuo account:
            valgono su tutti i dispositivi.
          </p>
          <textarea
            rows={7}
            placeholder='Es. "scrivi in tono ironico" oppure "non menzionare mai il lavoro a meno che non sia esplicito"'
            value={geminiInstructions}
            onChange={(e) => setGeminiInstructions(e.target.value)}
            className="w-full resize-none rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-ink outline-none focus:border-ink-soft"
          />
          {geminiInstructionsStatus && (
            <p
              className={
                'text-sm ' +
                (geminiInstructionsStatus.ok ? 'text-save-dark' : 'text-delete-dark')
              }
            >
              {geminiInstructionsStatus.message}
            </p>
          )}
          <button
            type="button"
            onClick={saveGeminiInstructions}
            disabled={savingGeminiInstructions}
            className="w-full rounded-full border border-save-dark bg-save px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
          >
            {savingGeminiInstructions ? 'Salvo…' : 'Salva'}
          </button>
        </SettingsSection>

        <SettingsSection nested noCollapse title="Istruzioni per i riassunti" icon="sparkles">
          <RecapInstructions />
        </SettingsSection>

        <SettingsSection nested noCollapse title="Richieste a Gemini" icon="info">
          <GeminiUsage />
        </SettingsSection>
        </SettingsSection>
      </SettingsSection>

      {!isLocal && (
        <SettingsSection title="Uso offline" icon="cloud">
          <OfflineStorage />
        </SettingsSection>
      )}

      {!Capacitor.isNativePlatform() && (
        <SettingsSection title="App Android" icon="download">
          <p className="mb-3 text-xs text-ink-soft sm:text-sm">
            Scarica l'app per Android (file APK). Aprilo dal telefono e, se richiesto,
            consenti l'installazione da questa fonte. Si accede con lo stesso account.
          </p>
          <a
            href="/download/myjournal.apk"
            download="myjournal.apk"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-2 text-sm font-bold text-ink transition hover:brightness-105"
          >
            <Icon name="download" size={14} className="shrink-0" />
            Scarica l'app per Android
          </a>
        </SettingsSection>
      )}

      <SettingsSection
        title="Import ed export"
        icon="download"
      >
        <button
          type="button"
          onClick={() => navigate('/importa')}
          className="mb-4 flex items-center gap-2 rounded-full border border-warn-dark bg-warn px-4 py-2 text-sm font-bold text-ink transition hover:brightness-105"
        >
          <Icon name="alert-triangle" size={14} className="shrink-0" />
          Importa da immagine
        </button>
        <ExportButtons />
      </SettingsSection>

        <SupportSection />

      <SettingsSection
        title="Offrimi un caffè"
        icon="heart"
      >
        {/* Placeholder: account Buy Me a Coffee non ancora attivo. Quando sarà
            pronto, sostituire con il link reale (https://buymeacoffee.com/…). */}
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-cream px-4 py-6 text-center text-sm font-semibold text-ink-soft">
          Buy Me a Coffee · presto disponibile
        </div>
      </SettingsSection>

      <SettingsSection
        title="Novità"
        icon="list"
      >
        <Changelog />
      </SettingsSection>

      <SettingsSection title="Account" icon="user">
        <BackendInfo />

        {!isLocal && (
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-delete-dark bg-delete px-6 py-3 text-sm font-bold text-ink shadow-sm transition hover:brightness-105"
          >
            <Icon name="logout" size={18} />
            Esci
          </button>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
          <span className="text-xs text-ink-soft">
            Elimina il tuo diario e tutti i dati collegati — azione permanente.
          </span>
          <DeleteAccount />
        </div>
      </SettingsSection>

      <VersionTap className="mt-6" />

      {immichReady && (
        <ImmichPeoplePicker
          open={pickerOpen}
          baseUrl={immichUrl}
          apiKey={immichApiKey}
          existingIds={new Set(people.map((p) => p.immichPersonId))}
          onClose={() => setPickerOpen(false)}
          onPick={addPerson}
        />
      )}

      {personToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => !cascadeBusy && setPersonToDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-line bg-cream p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-semibold text-ink">
              Rimuovi {personToDelete.person?.name}
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              È collegata a {personToDelete.notes.length}{' '}
              {personToDelete.notes.length === 1 ? 'nota' : 'note'}. Scegli cosa
              fare.
            </p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Sostituisci con
            </label>
            <select
              value={replacementId}
              onChange={(e) => setReplacementId(e.target.value)}
              disabled={cascadeBusy}
              className="mt-1 w-full rounded-xl border border-line bg-tag px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
            >
              <option value="">— scegli una persona —</option>
              {people
                .filter((p) => p.id !== personToDelete.person?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!replacementId || cascadeBusy}
              onClick={() => confirmCascade('replace')}
              className="mt-2 w-full rounded-full border border-save-dark bg-save px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {cascadeBusy ? 'Aggiorno…' : 'Sostituisci nelle note e rimuovi'}
            </button>

            <div className="my-4 border-t border-line-soft" />

            <button
              type="button"
              disabled={cascadeBusy}
              onClick={() => confirmCascade('detach')}
              className="w-full rounded-full border border-delete-dark bg-delete px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {cascadeBusy
                ? 'Aggiorno…'
                : `Rimuovi da tutte le ${personToDelete.notes.length} note e cancella`}
            </button>
            <button
              type="button"
              disabled={cascadeBusy}
              onClick={() => setPersonToDelete(null)}
              className="mt-2 w-full rounded-full border border-line bg-tag px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream disabled:opacity-50"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      <PlacePickerSheet
        open={placeSheetOpen}
        onClose={() => setPlaceSheetOpen(false)}
        onAdd={addPlace}
      />

      <PlacePickerSheet
        open={placeMapOpen}
        initial={
          editingPlace
            ? {
                name: placeEditName || editingPlace.name,
                lat: editingPlace.lat,
                lon: editingPlace.lon,
              }
            : null
        }
        onClose={() => setPlaceMapOpen(false)}
        onAdd={(p) => {
          setEditingPlace((ep) => (ep ? { ...ep, lat: p.lat, lon: p.lon } : ep))
          setPlaceEditName(p.name)
        }}
      />

      {placeToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => !placeCascadeBusy && setPlaceToDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-line bg-cream p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-semibold text-ink">
              Rimuovi {placeToDelete.place?.name}
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              È collegato a {placeToDelete.notes.length}{' '}
              {placeToDelete.notes.length === 1 ? 'nota' : 'note'}. Scegli cosa
              fare.
            </p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Sostituisci con
            </label>
            <select
              value={placeReplacementId}
              onChange={(e) => setPlaceReplacementId(e.target.value)}
              disabled={placeCascadeBusy}
              className="mt-1 w-full rounded-xl border border-line bg-tag px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
            >
              <option value="">— scegli un luogo —</option>
              {places
                .filter((p) => p.id !== placeToDelete.place?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!placeReplacementId || placeCascadeBusy}
              onClick={() => confirmPlaceCascade('replace')}
              className="mt-2 w-full rounded-full border border-save-dark bg-save px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {placeCascadeBusy ? 'Aggiorno…' : 'Sostituisci nelle note e rimuovi'}
            </button>

            <div className="my-4 border-t border-line-soft" />

            <button
              type="button"
              disabled={placeCascadeBusy}
              onClick={() => confirmPlaceCascade('detach')}
              className="w-full rounded-full border border-delete-dark bg-delete px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {placeCascadeBusy
                ? 'Aggiorno…'
                : `Rimuovi da tutte le ${placeToDelete.notes.length} note e cancella`}
            </button>
            <button
              type="button"
              disabled={placeCascadeBusy}
              onClick={() => setPlaceToDelete(null)}
              className="mt-2 w-full rounded-full border border-line bg-tag px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream disabled:opacity-50"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
