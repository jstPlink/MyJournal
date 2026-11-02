import WebDiary from './WebDiary'

// «Vista giorno»: come la vista diario, ma ogni giorno sta su una sola pagina
// (i testi lunghi si accorciano con «…», come la vista giorno comprime le ore).
export default function WebDayBook() {
  return <WebDiary fit />
}
