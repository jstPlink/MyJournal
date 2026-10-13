// Filtro SVG condiviso per l'effetto "disegnato a mano" delle skin: sposta
// leggermente i pixel con del rumore, così bordi e righe risultano tremolanti
// e irregolari. Montato una volta in App, invisibile e senza impatto sul
// layout. Il CSS lo richiama con `filter: url(#myjournal-wob)`.
export default function SketchDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <filter
          id="myjournal-wob"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.022"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* Variante a onda più larga: deforma i bordi di un intero foglio
            (skin "pagine") per farlo sembrare tagliato a mano e un po'
            vissuto. Richiamata con `filter: url(#myjournal-paper)`. */}
        <filter
          id="myjournal-paper"
          x="-6%"
          y="-6%"
          width="112%"
          height="112%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.015"
            numOctaves="2"
            seed="4"
            result="warp"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warp"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* Variante più mossa, per lo strappo del cartoncino della barra
            laterale (src/components/web/Sidebar.jsx): due filtri con semi
            diversi, uno per il foglio davanti e uno per quello che
            intravede da dietro, così non sembrano stampati dallo stesso
            timbro. Richiamati con `filter: url(#myjournal-tear)` /
            `url(#myjournal-tear-2)`. */}
        <filter
          id="myjournal-tear"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02 0.05"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          id="myjournal-tear-2"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.024 0.04"
            numOctaves="3"
            seed="21"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
