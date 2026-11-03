import VistaPrevia from "./VistaPrevia.jsx";
import { colorStockDetallado } from "../reglasPlanilla.js";

// Columnas de Stock detallado que se pueden editar a mano.
const COLUMNAS_EDITABLES_DETALLADO = new Set([11, 13, 14, 15]);

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
  guardarCelda,
  pegarColumna,
}) {
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
              {[...COLUMNAS_EDITABLES_DETALLADO].sort((a, b) => a - b).map((indiceColumna) => {
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
              <span style={{ fontSize: 13, color: "var(--texto-suave, #666)" }}>
                En una celda editable puedes pegar una columna de Excel para rellenar hacia abajo.
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
                            onChange={(event) => actualizarCelda(fila[1], columna, event.target.value)}
                            onFocus={(event) => {
                              event.target.dataset.original = event.target.value;
                            }}
                            onPaste={(event) => {
                              const aplicado = pegarColumna(
                                indice,
                                columna,
                                nombreColumna,
                                event.clipboardData.getData("text")
                              );
                              if (aplicado == null) return;
                              event.preventDefault();
                              if (typeof aplicado === "string") event.target.dataset.original = aplicado;
                            }}
                            onBlur={(event) =>
                              guardarCelda(
                                fila[1],
                                nombreColumna,
                                columna,
                                event.target.value,
                                event.target.dataset.original ?? ""
                              )
                            }
                            style={{
                              width: "100%",
                              minWidth: 72,
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
                    {tabla.columnas.map((columna) => (
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
