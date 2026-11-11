import { useState } from "react";
import { BODEGAS, elegirBodega, nombreBodega } from "../lib/bodega.js";
import { useClickFuera } from "../lib/useClickFuera.js";

// Botón de la barra con la bodega activa; los admins despliegan la lista para cambiarla.
export default function SelectorBodega({ rol, bodegaActiva }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useClickFuera(() => setAbierto(false));
  const esAdmin = rol === "admin" || rol === "admin_ext";

  return (
    <div ref={caja} data-tour="bodega" className="selector-bodega">
      <button
        type="button"
        className={`barra-bodega${esAdmin ? " barra-bodega--editable" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Bodega principal: ${bodegaActiva}`}
        onClick={() => esAdmin && setAbierto(!abierto)}
        style={{ cursor: esAdmin ? "pointer" : "default" }}
      >
        <span aria-hidden="true" className="barra-bodega__icono">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21V8l9-5 9 5v13" />
            <path d="M9 21V12h6v9" />
          </svg>
        </span>
        <span className="barra-bodega__texto">
          <span className="barra-bodega__rotulo">Bodega</span>
          <span className="barra-bodega__nombre">
            <span>{bodegaActiva}</span>
            <span className="barra-bodega__sede">{nombreBodega(bodegaActiva)}</span>
          </span>
        </span>
        {esAdmin && (
          <svg
            className="barra-bodega__flecha"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ transform: abierto ? "rotate(180deg)" : "none" }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>
      {abierto && esAdmin && (
        <ul role="listbox" aria-label="Bodegas" className="barra-bodega__lista">
          {BODEGAS.map((bodega) => {
            const activa = bodega === bodegaActiva;
            return (
              <li key={bodega} role="option" aria-selected={activa}>
                <button
                  type="button"
                  className={`barra-bodega__opcion${activa ? " barra-bodega__opcion--activa" : ""}`}
                  aria-label={bodega}
                  onClick={() => {
                    setAbierto(false);
                    elegirBodega(bodega);
                  }}
                >
                  <span className="barra-bodega__nombre">
                    <span>{bodega}</span>
                    <span className="barra-bodega__sede">{nombreBodega(bodega)}</span>
                  </span>
                  {activa && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
