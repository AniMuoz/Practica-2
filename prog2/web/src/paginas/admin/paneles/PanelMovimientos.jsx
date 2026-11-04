import { useState } from "react";
import Interruptor from "./Interruptor.jsx";
import VistaPrevia from "./VistaPrevia.jsx";
import { enviarJson } from "../../../lib/api.js";

// Movimientos: planilla con alta, edicion y baja de codigos.
export default function PanelMovimientos({
  clave,
  tabla: movimientos,
  filas: filasMovimientos,
  cargando: cargandoMovimientos,
  aviso: avisoMovimientos,
  recargar: recargarMovimientos,
  hrefExcel,
  filtros: panelFiltrosUbicacion,
  colores,
  clasePlanilla,
  copiarExistencia,
  copiarInventario,
  alternarExistencia,
  alternarInventario,
  soloLectura = false,
}) {
  const [codigoMovimiento, setCodigoMovimiento] = useState("");
  const [errorCodigoMovimiento, setErrorCodigoMovimiento] = useState("");
  const [codigoEditando, setCodigoEditando] = useState(null);
  const [valorCodigoEditando, setValorCodigoEditando] = useState("");
  const [guardandoFilaMovimiento, setGuardandoFilaMovimiento] = useState(false);

  function agregarCodigoMovimientoForm(evento) {
    evento.preventDefault();
    const codigo = codigoMovimiento.trim();
    if (!codigo) return;
    setErrorCodigoMovimiento("");
    enviarJson("/api/movimientos/codigo", { clave, codigo }, "No se pudo añadir el código.")
      .then(() => {
        setCodigoMovimiento("");
        return recargarMovimientos(true);
      })
      .catch((err) => setErrorCodigoMovimiento(err.message));
  }

  function eliminarFilaMovimiento(codigo) {
    if (!window.confirm(`¿Eliminar el código ${codigo} de movimientos?`)) return;
    setErrorCodigoMovimiento("");
    setGuardandoFilaMovimiento(true);
    enviarJson("/api/movimientos/codigo", { clave, codigo }, "No se pudo eliminar el código.", "DELETE")
      .then(() => recargarMovimientos(true))
      .catch((err) => setErrorCodigoMovimiento(err.message))
      .finally(() => setGuardandoFilaMovimiento(false));
  }

  function iniciarEdicionCodigo(codigo) {
    setCodigoEditando(codigo);
    setValorCodigoEditando(codigo);
    setErrorCodigoMovimiento("");
  }

  function cancelarEdicionCodigo() {
    setCodigoEditando(null);
    setValorCodigoEditando("");
  }

  function guardarEdicionCodigo(codigoAnterior) {
    const nuevo = valorCodigoEditando.trim();
    if (!nuevo) {
      setErrorCodigoMovimiento("Escribe un código.");
      return;
    }
    if (nuevo === codigoAnterior) {
      cancelarEdicionCodigo();
      return;
    }
    setErrorCodigoMovimiento("");
    setGuardandoFilaMovimiento(true);
    enviarJson("/api/movimientos/codigo", { clave, codigoAnterior, codigoNuevo: nuevo }, "No se pudo actualizar el código.", "PUT")
      .then(() => {
        cancelarEdicionCodigo();
        return recargarMovimientos(true);
      })
      .catch((err) => setErrorCodigoMovimiento(err.message))
      .finally(() => setGuardandoFilaMovimiento(false));
  }

  return (
      <section
        style={{
          background: "var(--superficie)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Movimientos</h2>
        {panelFiltrosUbicacion}
        {cargandoMovimientos && <p style={{ margin: 0 }}>Cargando movimientos...</p>}
        {avisoMovimientos && <p style={{ margin: 0 }}>{avisoMovimientos}</p>}
        {!cargandoMovimientos && !avisoMovimientos && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              {soloLectura ? <div style={{ flex: "1 1 280px" }} /> : <form
                onSubmit={agregarCodigoMovimientoForm}
                style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: "1 1 280px", minWidth: 0 }}
              >
                <input
                  type="text"
                  value={codigoMovimiento}
                  onChange={(e) => setCodigoMovimiento(e.target.value)}
                  placeholder="Añadir código"
                  aria-label="Añadir código"
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--borde)", fontSize: 14 }}
                />
                <button
                  type="submit"
                  style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--boton)", color: "var(--sobre)", fontSize: 14, cursor: "pointer" }}
                >
                  Añadir código
                </button>
                {errorCodigoMovimiento && (
                  <span style={{ fontSize: 14, color: "var(--peligro, #d32f2f)" }}>{errorCodigoMovimiento}</span>
                )}
              </form>}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  flex: "0 0 auto",
                }}
              >
                <Interruptor activo={copiarExistencia} onClick={alternarExistencia} texto="Libre utilización" />
                <Interruptor activo={copiarInventario} onClick={alternarInventario} texto="Inventario" />
                <a
                  href={hrefExcel}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    background: "var(--boton)",
                    color: "var(--sobre)",
                    fontSize: 14,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Descargar planilla
                </a>
              </div>
            </div>
            <VistaPrevia
            filas={filasMovimientos}
            columnas={movimientos.columnas.length + 1}
            className={clasePlanilla}
            vacio="No hay movimientos cargados."
            renderFila={(fila, indice) => {
              const codigoFila = String(fila[1] ?? "");
              const estaEditando = codigoEditando === codigoFila;
              return (
                <tr key={`${fila[1]}-${indice}`}>
                  {fila.map((valor, columna) => (
                    <td
                      key={columna}
                      style={{ padding: "8px 10px", border: "1px solid var(--borde-suave)", background: "var(--superficie)" }}
                    >
                      {columna === 1 && estaEditando ? (
                        <input
                          type="text"
                          value={valorCodigoEditando}
                          autoFocus
                          disabled={guardandoFilaMovimiento}
                          onChange={(e) => setValorCodigoEditando(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              guardarEdicionCodigo(codigoFila);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelarEdicionCodigo();
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--borde)",
                            fontSize: 14,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                      ) : (
                        valor === "" || valor == null ? "" : String(valor)
                      )}
                    </td>
                  ))}
                  <td
                    style={{
                      padding: "4px 8px",
                      border: "1px solid var(--borde-suave)",
                      background: "var(--superficie)",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                    }}
                  >
                    {estaEditando ? (
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => guardarEdicionCodigo(codigoFila)}
                          disabled={guardandoFilaMovimiento}
                          style={{
                            padding: "4px 8px",
                            border: 0,
                            borderRadius: 4,
                            background: "var(--acento)",
                            color: "var(--sobre)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicionCodigo}
                          disabled={guardandoFilaMovimiento}
                          style={{
                            padding: "4px 8px",
                            border: "1px solid var(--borde)",
                            borderRadius: 4,
                            background: "var(--superficie)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : soloLectura ? null : (
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => iniciarEdicionCodigo(codigoFila)}
                          disabled={guardandoFilaMovimiento}
                          title="Editar código"
                          style={{
                            padding: "4px 8px",
                            border: "1px solid var(--borde)",
                            borderRadius: 4,
                            background: "var(--superficie)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarFilaMovimiento(codigoFila)}
                          disabled={guardandoFilaMovimiento}
                          title="Eliminar fila"
                          style={{
                            padding: "4px 8px",
                            border: 0,
                            borderRadius: 4,
                            background: "var(--peligro)",
                            color: "var(--sobre)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            }}
          >
              <thead>
                <tr>
                  {movimientos.columnas.map((columna) => (
                    <th
                      key={columna}
                      style={{
                        position: "sticky",
                        top: 0,
                        textAlign: "left",
                        padding: "8px 10px",
                        background: colores ? "#a9e5e5" : "var(--superficie)",
                        border: "1px solid var(--borde)",
                      }}
                    >
                      {columna}
                    </th>
                  ))}
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      textAlign: "center",
                      padding: "8px 10px",
                      background: colores ? "#a9e5e5" : "var(--superficie)",
                      border: "1px solid var(--borde)",
                    }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
          </VistaPrevia>
          </>
        )}
      </section>
  );
}
