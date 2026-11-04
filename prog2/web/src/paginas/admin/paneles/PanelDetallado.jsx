import { useState } from "react";
import VistaPrevia from "./VistaPrevia.jsx";
import { colorStockDetallado } from "../../../lib/reglasPlanilla.js";

// Columnas de Stock detallado que se pueden editar a mano.
// 5 Caracteristica, 11 Cons.Prom.Mensual, 12 Stock critico, 13 Stock Max, 14 INDICADOR
const COLUMNAS_EDITABLES_DETALLADO = new Set([5, 11, 12, 13, 14]);
const COLUMNA_INDICADOR = 14;

// Stock detallado: planilla editable. La logica de edicion vive en useDetallado.
export default function PanelDetallado({
  tabla,
  filtrado,
  cargando,
  aviso,
  error,
  hrefExcel,
  filtros,
  colores,
  oscuro,
  clasePlanilla,
  limpiarColumna,
  actualizarCelda,
  pegarColumna,
  pendientes = 0,
  guardando = false,
  onGuardar,
}) {
  const [limpiarVisible, setLimpiarVisible] = useState(false);

  return (
      <section
        style={{
          background: "var(--superficie)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Stock detallado</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={onGuardar}
              disabled={!pendientes || guardando}
              style={{
                padding: "8px 14px",
                border: 0,
                borderRadius: 6,
                background: pendientes && !guardando ? "#2e7d32" : "var(--borde-suave, #ccc)",
                color: pendientes && !guardando ? "#fff" : "var(--texto-suave, #666)",
                fontSize: 14,
                fontWeight: 700,
                cursor: pendientes && !guardando ? "pointer" : "default",
              }}
            >
              {guardando ? "Guardando..." : pendientes ? `Guardar cambios (${pendientes})` : "Guardar cambios"}
            </button>
            <a
              href={hrefExcel}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: "var(--boton)",
                color: "var(--sobre)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Descargar planilla
            </a>
          </div>
        </div>
        {filtros}
        {cargando && <p style={{ margin: 0 }}>Cargando stock...</p>}
        {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
        {error && <p style={{ margin: "0 0 8px", color: "var(--peligro, #b00020)" }}>{error}</p>}
        {!cargando && !aviso && (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
                alignItems: "center",
              }}
            >
              {limpiarVisible &&
                [...COLUMNAS_EDITABLES_DETALLADO].sort((a, b) => a - b).map((indiceColumna) => {
                  const columna = tabla.columnas[indiceColumna];
                  if (!columna) return null;
                  return (
                    <button
                      key={columna}
                      type="button"
                      onClick={() => limpiarColumna(columna, indiceColumna)}
                      style={{
                        padding: "6px 12px",
                        border: 0,
                        borderRadius: 4,
                        background: "#c62828",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      limpiar {columna}
                    </button>
                  );
                })}
              <button
                type="button"
                aria-label={limpiarVisible ? "Ocultar botones de limpiar" : "Mostrar botones de limpiar"}
                title={limpiarVisible ? "Ocultar botones de limpiar" : "Mostrar botones de limpiar"}
                aria-expanded={limpiarVisible}
                onClick={() => setLimpiarVisible((v) => !v)}
                style={{
                  padding: "6px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: "var(--boton)",
                  color: "var(--sobre)",
                  cursor: "pointer",
                  lineHeight: 0,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{
                    transform: limpiarVisible ? "rotate(-90deg)" : "rotate(90deg)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <span style={{ fontSize: 13, color: "var(--texto-suave, #666)" }}>
                Los cambios se guardan solo al pulsar Guardar. En una celda editable puedes pegar una columna de Excel.
              </span>
            </div>
            <VistaPrevia
              filas={filtrado.filas}
              columnas={tabla.columnas.length}
              className={clasePlanilla}
              vacio="No hay stock detallado cargado."
              renderFila={(fila, indice) => (
                <tr key={`${fila[1]}-${indice}`}>
                  {fila.map((valor, columna) => {
                    const editable = COLUMNAS_EDITABLES_DETALLADO.has(columna);
                    const fondo = colorStockDetallado(columna, valor, filtrado.marcados?.[indice], oscuro, fila);
                    // celda-color en oscuro fuerza texto #111; solo aplica si el fondo no es la superficie oscura.
                    const usaColorCelda = Boolean(colores && fondo && fondo !== "var(--superficie)");
                    const nombreColumna = tabla.columnas[columna];
                    return (
                      <td
                        key={columna}
                        className={usaColorCelda ? "celda-color" : undefined}
                        style={{
                          padding: editable ? "4px 6px" : "8px 10px",
                          border: "1px solid var(--borde-suave)",
                          background: colores ? fondo : "var(--superficie)",
                          fontWeight: columna === 10 ? 700 : 400,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {editable ? (
                          <input
                            aria-label={`${nombreColumna} ${fila[1]}`}
                            value={valor == null ? "" : String(valor)}
                            onChange={(event) =>
                              actualizarCelda(fila[1], columna, nombreColumna, event.target.value)
                            }
                            onPaste={(event) => {
                              const aplicado = pegarColumna(
                                indice,
                                columna,
                                nombreColumna,
                                event.clipboardData.getData("text")
                              );
                              if (aplicado == null) return;
                              event.preventDefault();
                            }}
                            style={{
                              width: "100%",
                              minWidth: columna === COLUMNA_INDICADOR ? 180 : 72,
                              boxSizing: "border-box",
                              padding: "4px 6px",
                              border: "1px solid var(--borde)",
                              borderRadius: 4,
                              background: "var(--campo)",
                              color: "var(--texto)",
                              font: "inherit",
                            }}
                          />
                        ) : (
                          valor === "" || valor == null ? "" : String(valor)
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            >
                <thead>
                  <tr>
                    {tabla.columnas.map((columna, indice) => (
                      <th
                        key={columna}
                        style={{
                          position: "sticky",
                          top: 0,
                          textAlign: "left",
                          padding: "8px 10px",
                          background: colores ? "#a9e5e5" : "var(--superficie)",
                          border: "1px solid var(--borde)",
                          whiteSpace: "nowrap",
                          minWidth: indice === COLUMNA_INDICADOR ? 180 : undefined,
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
            </VistaPrevia>
          </>
        )}
      </section>
  );
}
