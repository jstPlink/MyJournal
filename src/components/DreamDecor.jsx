// Decori della pagina del sogno: onde celesti in alto, festone con le stelline sotto le onde
// (solo telefono) e fascia di nuvole e stelle in basso. Solo grafica, niente interazione.
const star = (x, y, s, f) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0-7l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"
    fill={f}
  />
)

export function DreamWaves({ height = 90 }) {
  const h = height
  return (
    <svg
      className="dream-waves"
      width="100%"
      height={h + 8}
      viewBox={`0 0 660 ${h + 8}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={`M0 0H660V${h}Q580 ${h - 16} 495 ${h}T330 ${h}T165 ${h}T0 ${h}Z`} fill="#cfe6f7" />
      <path d={`M0 0H660V${h - 16}Q580 ${h - 32} 495 ${h - 16}T330 ${h - 16}T165 ${h - 16}T0 ${h - 16}Z`} fill="#9fcbea" />
    </svg>
  )
}

export function DreamGarland() {
  return (
    <svg className="dream-garland" width="100%" height="110" viewBox="0 0 228 110" preserveAspectRatio="none" aria-hidden="true">
      <path d="M10 22 Q114 66 218 22" fill="none" stroke="#6f9fc8" strokeWidth="1.5" strokeDasharray="4 3" />
      {star(80, 46, 1.1, '#f4e7b0')}
      {star(150, 46, 1.1, '#f4e7b0')}
    </svg>
  )
}

const BOTTOM_ITEMS = (
  <>
    <g fill="#cfe6f7">
      <circle cx="24" cy="48" r="14" />
      <circle cx="44" cy="42" r="18" />
      <circle cx="68" cy="50" r="13" />
      <rect x="10" y="48" width="70" height="16" rx="8" />
      <circle cx="160" cy="50" r="16" />
      <circle cx="182" cy="44" r="19" />
      <circle cx="206" cy="52" r="13" />
      <rect x="146" y="50" width="76" height="14" rx="7" />
    </g>
    <g>
      {star(112, 34, 1.1, '#ffffff')}
      {star(130, 54, 0.8, '#bcd8ee')}
      {star(96, 52, 0.7, '#bcd8ee')}
    </g>
  </>
)

// `repeat` (web): la fascia si ripete in orizzontale invece di allargarsi
export function DreamBottom({ repeat = false }) {
  if (repeat) {
    return (
      <svg className="dream-bottom" width="100%" height="64" aria-hidden="true">
        <defs>
          <pattern id="dream-bottom-pattern" width="224" height="64" patternUnits="userSpaceOnUse">
            {BOTTOM_ITEMS}
          </pattern>
        </defs>
        <rect width="100%" height="64" fill="url(#dream-bottom-pattern)" />
      </svg>
    )
  }
  return (
    <svg
      className="dream-bottom"
      width="100%"
      height="60"
      viewBox="0 0 224 64"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <g fill="#cfe6f7">
        <circle cx="24" cy="48" r="14" />
        <circle cx="44" cy="42" r="18" />
        <circle cx="68" cy="50" r="13" />
        <rect x="10" y="48" width="70" height="16" rx="8" />
        <circle cx="160" cy="50" r="16" />
        <circle cx="182" cy="44" r="19" />
        <circle cx="206" cy="52" r="13" />
        <rect x="146" y="50" width="76" height="14" rx="7" />
      </g>
      <g>
        {star(112, 34, 1.1, '#ffffff')}
        {star(130, 54, 0.8, '#bcd8ee')}
        {star(96, 52, 0.7, '#bcd8ee')}
      </g>
    </svg>
  )
}

// Decori sparsi sullo sfondo della pagina web: costellazioni, lune, stelle e nuvolette,
// tenui, nelle zone libere attorno al foglio (il foglio li copre dove si sovrappone).
const sp = (x, y, r, f, o = 1) => (
  <path
    transform={`translate(${x} ${y}) scale(${r})`}
    d="M0-10L2.6-3.2 10 0 2.6 3.2 0 10-2.6 3.2-10 0-2.6-3.2z"
    fill={f}
    opacity={o}
  />
)
const cloud = (x, y, s, o = 0.9) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff" opacity={o}>
    <circle cx="0" cy="0" r="14" />
    <circle cx="20" cy="-8" r="18" />
    <circle cx="42" cy="0" r="14" />
    <rect x="-12" y="0" width="66" height="14" rx="7" />
  </g>
)
const crescent = (x, y, s) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0-30a30 30 0 1 0 22 52A24 24 0 0 1 0-30z"
    fill="#f4e7b0"
    stroke="#d8c470"
    strokeWidth="2"
  />
)

export function DreamScatter() {
  return (
    <svg
      className="dream-scatter"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#8fb6dc" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.8">
        <polyline points="70,420 140,380 220,425 300,370 360,410" />
        <polyline points="60,640 130,690 110,760 200,720 270,770" />
        <polyline points="640,640 720,600 800,650 880,610 960,660" />
      </g>
      <g fill="#ffffff">
        {[[70, 420], [140, 380], [220, 425], [300, 370], [360, 410], [60, 640], [130, 690], [110, 760], [200, 720], [270, 770], [640, 640], [720, 600], [800, 650], [880, 610], [960, 660]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 4.5 : 3.5} />
        ))}
      </g>
      {crescent(1090, 650, 0.9)}
      {crescent(520, 560, 0.45)}
      {cloud(380, 560, 1.0)}
      {cloud(1010, 540, 0.8, 0.85)}
      {cloud(150, 560, 0.7, 0.8)}
      {sp(420, 700, 1.2, '#ffffff')}
      {sp(560, 700, 0.9, '#bcd8ee')}
      {sp(760, 730, 1.4, '#ffffff')}
      {sp(900, 560, 1, '#f4e7b0')}
      {sp(1150, 520, 0.9, '#ffffff')}
      {sp(40, 330, 0.9, '#f4e7b0')}
      {sp(330, 300, 0.8, '#ffffff')}
      {sp(240, 560, 0.7, '#bcd8ee')}
      {sp(1120, 740, 1.1, '#bcd8ee')}
      {sp(680, 560, 0.8, '#ffffff')}
    </svg>
  )
}
