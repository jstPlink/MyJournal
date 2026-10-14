// Istruzioni per l'IA (Impostazioni → Istruzioni per IA) e lingua delle note.
//
// Le istruzioni valgono per qualunque modello che scrive (Gemini, le sue
// riserve, Groq): sono testo che si aggiunge al prompt. Sono in inglese perché
// i modelli le seguono meglio; chi le scrive le può cambiare nella lingua che
// preferisce. Nel database restano nei campi `geminiCustomInstructions` (note) e
// `recapCustomInstructions` (riassunti) di `users`: se un campo è vuoto vale il
// testo iniziale qui sotto. Il server (pb_hooks/recap_lib.js) ha una copia di
// DEFAULT_RECAP_INSTRUCTIONS: tienile uguali.

export const DEFAULT_NOTE_INSTRUCTIONS = `When you create a work note, write "Lavoro - " at the start of the title.
When I mention times, start a new line in the text.

Clean the content of repeated sentences and semantic errors, and summarize it in paragraphs to make it more readable.

Don't distort the text I give you too much: only clean it up and correct it.

If I comment on a mistake about a time and then correct myself, keep only the correct time in the final version.

Don't add adjectives or personal comments unless I explicitly ask or say so.

Don't insert places in the note; let me do that myself.`

export const DEFAULT_RECAP_INSTRUCTIONS = `Write the summaries based on the title and the content, the mood, the places visited and the people met.

Write the text in the first person, as if you had lived the experience yourself.

When choosing what to include in the summary, give more weight to the notes with the most extreme moods, whether the lowest or the highest.

Don't add too many adjectives or words of your own; try to use the words already present, at most paraphrase or combine concepts.

Split the recaps into paragraphs so they are easier to read.

For daily summaries use 80 words.
For monthly summaries use 110 words.
For yearly summaries use 140 words.`

// Istruzioni effettive: quelle salvate dall'utente, altrimenti il testo iniziale.
export function noteInstructionsOf(user) {
  return (user?.geminiCustomInstructions || '').trim() || DEFAULT_NOTE_INSTRUCTIONS
}
export function recapInstructionsOf(user) {
  return (user?.recapCustomInstructions || '').trim() || DEFAULT_RECAP_INSTRUCTIONS
}

// ---- lingua (per dispositivo) ----
// Per ora serve a una cosa sola: la lingua in cui l'IA scrive le note.

export const LANGUAGES = [
  { code: 'it', label: 'Italiano', name: 'Italian' },
  { code: 'en', label: 'English', name: 'English' },
  { code: 'es', label: 'Español', name: 'Spanish' },
  { code: 'fr', label: 'Français', name: 'French' },
  { code: 'de', label: 'Deutsch', name: 'German' },
  { code: 'pt', label: 'Português', name: 'Portuguese' },
]

const LANG_KEY = 'myjournal.language'

export function getLanguage() {
  try {
    const code = localStorage.getItem(LANG_KEY)
    if (LANGUAGES.some((l) => l.code === code)) return code
  } catch {
    // localStorage non disponibile: vale il predefinito
  }
  return 'it'
}

export function setLanguage(code) {
  try {
    localStorage.setItem(LANG_KEY, code)
  } catch {
    // niente da fare: la scelta non si ricorda
  }
}

// Nome inglese della lingua scelta, da mettere nei prompt ("Italian", "English"...).
export function languageName() {
  const code = getLanguage()
  return (LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]).name
}
