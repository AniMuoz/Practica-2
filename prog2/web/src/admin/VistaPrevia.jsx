import { useEffect, useRef, useState } from "react";
import Planilla from "../Planilla.jsx";

const ALTO_FILA = 36;
const FILAS_EXTRA = 12;

export default function VistaPrevia({ filas, columnas, altoMaximo = 480, className, children, renderFila, vacio, clave, alFinal }) {
  const ref = useRef(null);
  const [corte, setCorte] = useState({ inicio: 0, fin: 40 });
  const marca = clave === undefined ? filas.length : clave;

  function medir() {
    const caja = ref.current;
    if (!caja) return;
    const inicio = Math.max(0, Math.floor(caja.scrollTop / ALTO_FILA) - FILAS_EXTRA);
    const cupo = Math.ceil(caja.clientHeight / ALTO_FILA) + FILAS_EXTRA * 2;
    const fin = Math.min(filas.length, inicio + cupo);
    setCorte((actual) => (actual.inicio === inicio && actual.fin === fin ? actual : { inicio, fin }));
    if (alFinal && caja.scrollHeight - caja.scrollTop - caja.clientHeight < ALTO_FILA * 6) alFinal();
  }

  useEffect(() => {
    const caja = ref.current;
    if (caja) caja.scrollTop = 0;
    medir();
  }, [marca]);

  useEffect(() => {
    medir();
  }, [filas.length]);

  const antes = corte.inicio * ALTO_FILA;
  const despues = Math.max(0, filas.length - corte.fin) * ALTO_FILA;
  const span = Math.max(columnas, 1);

  return (
    <div ref={ref} onScroll={medir} style={{ overflow: "auto", maxHeight: altoMaximo }}>
      <Planilla className={["vista-previa", className].filter(Boolean).join(" ")}>
        {children}
        <tbody>
          {antes > 0 && (
            <tr aria-hidden="true">
              <td colSpan={span} style={{ height: antes, padding: 0, border: 0 }} />
            </tr>
          )}
          {filas.slice(corte.inicio, corte.fin).map((fila, desplazamiento) => renderFila(fila, corte.inicio + desplazamiento))}
          {despues > 0 && (
            <tr aria-hidden="true">
              <td colSpan={span} style={{ height: despues, padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </Planilla>
      {filas.length === 0 && vacio && <p style={{ margin: "12px 0 0" }}>{vacio}</p>}
    </div>
  );
}
