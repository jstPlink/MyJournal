// «Diario»: pagina vuota, l'estetica vera arriva dopo.
export default function WebDiary() {
  return (
    <div>
      <div className="sticky top-0 z-10 mb-[50px] mt-[40px] w-full bg-cream">
        <span className="header-quadretti bleed-day" aria-hidden="true" />
        <header className="relative z-[1] px-4">
          <h1 className="wd-page-title">
            Vista diario
            <span className="hl" aria-hidden="true" />
          </h1>
        </header>
      </div>
    </div>
  )
}
