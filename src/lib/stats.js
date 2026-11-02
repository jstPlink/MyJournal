import { dayMood, monthMoodFromDays } from './mood'
import { groupByDay, parsePlace } from './notes'
import { parseWall, MONTHS_IT } from './dates'

const WEEKDAYS_IT = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
]

// Le `limit` voci col conteggio più alto in una Map id->count.
function topEntries(counts, nameFn, limit) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ id, name: nameFn(id), count }))
}

// Chiave (YYYY-MM-DD) del lunedì della settimana che contiene `dKey`.
function mondayKey(dKey) {
  const p = parseWall(dKey)
  if (!p) return dKey
  const dt = new Date(p.y, p.mo - 1, p.d)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

// Statistiche aggregate sulle note di un anno.
export function computeYearStats(yearNotes, { allPeople = [], allTags = [], peopleLimit = 10 } = {}) {
  const byDay = groupByDay(yearNotes)
  const dayEntries = [...byDay.entries()].map(([key, notes]) => ({
    key,
    mood: dayMood(notes),
    count: notes.length,
    titles: notes.map((n) => n.title?.trim()).filter(Boolean),
  }))

  const topDays = [...dayEntries].sort((a, b) => b.mood - a.mood).slice(0, 5)
  const bottomDays = [...dayEntries].sort((a, b) => a.mood - b.mood).slice(0, 5)

  // Le 5 note singole (non giorni) con mood più alto/basso: a differenza di
  // "Giorni migliori/difficili" (media pesata di TUTTE le note del giorno,
  // vedi dayMood), qui una nota isolata con un mood estremo emerge sempre,
  // anche se il resto della giornata l'ha "diluita" nella classifica giorni.
  const byMoodDesc = [...yearNotes]
    .filter((n) => Number.isFinite(Number(n.mood)))
    .sort((a, b) => Number(b.mood) - Number(a.mood))
  const topNotes = byMoodDesc.slice(0, 5)
  const bottomNotes = [...byMoodDesc].reverse().slice(0, 5)

  // Settimana con il mood medio più alto (almeno 2 giorni scritti, se
  // possibile: evita che un singolo giorno euforico "vinca" la settimana).
  const weekMap = new Map()
  for (const d of dayEntries) {
    const wk = mondayKey(d.key)
    const e = weekMap.get(wk) || {
      week: wk,
      moodSum: 0,
      days: 0,
      notes: 0,
      first: d.key,
      last: d.key,
    }
    e.moodSum += d.mood
    e.days += 1
    e.notes += d.count
    if (d.key < e.first) e.first = d.key
    if (d.key > e.last) e.last = d.key
    weekMap.set(wk, e)
  }
  const weeks = [...weekMap.values()].map((e) => ({ ...e, mood: e.moodSum / e.days }))
  const weeksWithEnough = weeks.filter((w) => w.days >= 2)
  const bestWeek =
    weeksWithEnough.sort((a, b) => b.mood - a.mood)[0] ||
    weeks.sort((a, b) => b.mood - a.mood)[0] ||
    null
  const worstWeek =
    weeksWithEnough.sort((a, b) => a.mood - b.mood)[0] ||
    weeks.sort((a, b) => a.mood - b.mood)[0] ||
    null

  // Giorno della settimana con il mood medio più alto.
  const wdSum = Array(7).fill(0)
  const wdN = Array(7).fill(0)
  for (const d of dayEntries) {
    const p = parseWall(d.key)
    if (!p) continue
    const wd = new Date(p.y, p.mo - 1, p.d).getDay()
    wdSum[wd] += d.mood
    wdN[wd] += 1
  }
  let bestWeekday = null
  let worstWeekday = null
  for (let i = 0; i < 7; i += 1) {
    if (!wdN[i]) continue
    const m = wdSum[i] / wdN[i]
    if (!bestWeekday || m > bestWeekday.mood) {
      bestWeekday = { day: i, name: WEEKDAYS_IT[i], mood: m, count: wdN[i] }
    }
    if (!worstWeekday || m < worstWeekday.mood) {
      worstWeekday = { day: i, name: WEEKDAYS_IT[i], mood: m, count: wdN[i] }
    }
  }
  // un solo giorno della settimana con dati: non ha senso chiamarlo "peggiore"
  if (worstWeekday && bestWeekday && worstWeekday.day === bestWeekday.day) worstWeekday = null

  // Note per mese (0-11), e mese con mood medio più alto/più basso (almeno
  // un giorno scritto). Il mood di ogni mese è la media dei mood-giorno
  // (dayMood, già pesata sulla durata delle note), come per le settimane.
  const monthDayMoods = Array.from({ length: 12 }, () => [])
  const monthNoteCount = Array(12).fill(0)
  for (const d of dayEntries) {
    const p = parseWall(d.key)
    if (!p) continue
    monthDayMoods[p.mo - 1].push(d.mood)
  }
  for (const n of yearNotes) {
    const p = parseWall(n.date)
    if (p) monthNoteCount[p.mo - 1] += 1
  }
  const notesByMonth = MONTHS_IT.map((name, i) => ({
    month: i,
    name,
    count: monthNoteCount[i],
  }))
  // Note per anno (serve alla pagina «Di sempre», dove le note abbracciano
  // più anni): dal più recente.
  const yearCounts = new Map()
  for (const n of yearNotes) {
    const p = parseWall(n.date)
    if (p) yearCounts.set(p.y, (yearCounts.get(p.y) || 0) + 1)
  }
  const notesByYear = [...yearCounts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, count]) => ({ year: y, name: String(y), count }))
  let bestMonth = null
  let worstMonth = null
  for (let i = 0; i < 12; i += 1) {
    if (!monthDayMoods[i].length) continue
    const m = monthMoodFromDays(monthDayMoods[i])
    if (!bestMonth || m > bestMonth.mood) {
      bestMonth = { month: i, name: MONTHS_IT[i], mood: m, count: monthNoteCount[i] }
    }
    if (!worstMonth || m < worstMonth.mood) {
      worstMonth = { month: i, name: MONTHS_IT[i], mood: m, count: monthNoteCount[i] }
    }
  }

  const tagName = new Map(allTags.map((t) => [t.id, t.name]))

  const personCount = new Map()
  const tagCount = new Map()
  const placeCount = new Map()
  let moodSum = 0
  let moodN = 0

  for (const n of yearNotes) {
    const m = Number(n.mood)
    if (!Number.isNaN(m)) {
      moodSum += m
      moodN += 1
    }
    for (const id of n.people || []) {
      personCount.set(id, (personCount.get(id) || 0) + 1)
    }
    for (const id of n.tags || []) {
      tagCount.set(id, (tagCount.get(id) || 0) + 1)
    }
    const place = parsePlace(n.place)
    if (place?.name) {
      placeCount.set(place.name, (placeCount.get(place.name) || 0) + 1)
    }
  }

  const peopleById = new Map(allPeople.map((p) => [p.id, p]))
  const topPeople = [...personCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, peopleLimit)
    .map(([id, count]) => ({
      id,
      count,
      name: peopleById.get(id)?.name || '—',
      person: peopleById.get(id) || null,
    }))
  const topTags = topEntries(tagCount, (id) => tagName.get(id) || '—', 1)
  const topPlaces = topEntries(placeCount, (name) => name, 1)

  return {
    noteCount: yearNotes.length,
    dayCount: dayEntries.length,
    avgMood: moodN ? moodSum / moodN : null,
    topDays,
    bottomDays,
    topNotes,
    bottomNotes,
    bestWeek,
    worstWeek,
    bestWeekday,
    worstWeekday,
    notesByMonth,
    notesByYear,
    bestMonth,
    worstMonth,
    topPeople,
    topPerson: topPeople[0] || null,
    topTag: topTags[0] || null,
    topPlace: topPlaces[0] || null,
  }
}
