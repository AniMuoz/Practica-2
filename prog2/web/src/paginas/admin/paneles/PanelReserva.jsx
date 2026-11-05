import { useEffect, useRef, useState } from "react";
import { useEstadoPersistente } from "../../../lib/persistencia.js";
import VistaPrevia from "./VistaPrevia.jsx";
import { obtenerJson, enviarFormulario, descargarBlob, guardarBlob } from "../../../lib/api.js";

// Revision de stock de reserva: busqueda por numero y revision de un PDF.
// Sigue montado aunque este oculto para conservar lo buscado al cerrar y abrir el panel.
export default function PanelReserva({ visible, colores, clasePlanilla }) {
  const [archivoReserva, setArchivoReserva] = useState(null);
  const [reserva, setReserva] = useState({ columnas: [], filas: [] });
  const [revisandoReserva, setRevisandoReserva] = useState(false);
  const [avisoReserva, setAvisoReserva] = useState("");
  const [ordenReserva, setOrdenReserva] = useEstadoPersistente("admin:reserva:numero", "");
  const [buscarPorReserva, setBuscarPorReserva] = useEstadoPersistente("admin:reserva:por", "reserva");
  const [consultaGuardada, setConsultaGuardada] = useEstadoPersistente("admin:reserva:consulta", null);
  const [busquedaReserva, setBusquedaReserva] = useState({
    columnas: [],
    filas: [],
    marcadosCodigo: [],
    repeticiones: [],
    total: 0,
  });
  const [buscandoReserva, setBuscandoReserva] = useState(false);
  const [avisoBusquedaReserva, setAvisoBusquedaReserva] = useState("");
  const paginaReserva = useRef(0);
  const cargandoPaginaReserva = useRef(false);
  const hayMasReservas = useRef(false);

  function buscar(numero, por) {
    const etiqueta = por === "orden" ? "orden" : "reserva";
    setAvisoBusquedaReserva("");
    setBuscandoReserva(true);
    paginaReserva.current = 0;
    hayMasReservas.current = false;
    const params = new URLSearchParams({ reserva: numero, por, pagina: "0", tamano: "100" });
    obtenerJson(`/api/reservas?${params.toString()}`, "No se pudo buscar la reserva.")
      .then((data) => {
        const coincidencias = data.coincidencias ?? (data.filas || []).length;
        setBusquedaReserva({
          columnas: data.columnas || [],
          filas: data.filas || [],
          marcadosCodigo: data.marcadosCodigo || [],
          repeticiones: data.repeticiones || [],
          total: data.total || 0,
          consulta: numero,
          por,
        });
        hayMasReservas.current = (data.filas || []).length < coincidencias;
        if ((data.total || 0) === 0) setAvisoBusquedaReserva("Todavía no hay reservas cargadas.");
        else if (coincidencias === 0) setAvisoBusquedaReserva(`No hay reservas con ese número de ${etiqueta}.`);
      })
      .catch((err) => setAvisoBusquedaReserva(err.message))
      .finally(() => setBuscandoReserva(false));
  }

  // Al volver a la pagina, repite la ultima busqueda para recuperar los resultados.
  // Solo cuando el panel se muestra, para no consultar al servidor con el panel cerrado.
  const restaurada = useRef(false);
  useEffect(() => {
    if (!visible || restaurada.current) return;
    restaurada.current = true;
    if (consultaGuardada?.numero) buscar(consultaGuardada.numero, consultaGuardada.por);
  }, [visible]);

  if (!visible) return null;

  return (
      <section
        className="admin-reserva"
        style={{
          background: "var(--superficie)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Revisión de stock de reserva</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const numero = ordenReserva.trim();
            const etiqueta = buscarPorReserva === "orden" ? "orden" : "reserva";
            if (!numero) {
              setAvisoBusquedaReserva(`Escribe un número de ${etiqueta}.`);
              setBusquedaReserva({ columnas: [], filas: [], marcadosCodigo: [], repeticiones: [], total: 0 });
              setConsultaGuardada(null);
              return;
            }
            setConsultaGuardada({ numero, por: buscarPorReserva });
            buscar(numero, buscarPorReserva);
          }}
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}
        >
          <button
            type="button"
            aria-label={`Buscar por ${buscarPorReserva === "orden" ? "N° orden" : "N° reserva"}. Clic para cambiar`}
            title="Cambiar entre N° orden y N° reserva"
            onClick={() => {
              setBuscarPorReserva((actual) => (actual === "orden" ? "reserva" : "orden"));
              setAvisoBusquedaReserva("");
            }}
            style={{
              padding: "8px 14px",
              border: "1px solid var(--borde)",
              borderRadius: 6,
              background: "var(--pista)",
              color: "var(--texto)",
              fontSize: 14,
              cursor: "pointer",
              minWidth: 120,
            }}
          >
            {buscarPorReserva === "orden" ? "N° orden" : "N° reserva"}
          </button>
          <input
            type="search"
            aria-label={buscarPorReserva === "orden" ? "Número de orden" : "Número de reserva"}
            value={ordenReserva}
            placeholder={buscarPorReserva === "orden" ? "Buscar número de orden" : "Buscar número de reserva"}
            onChange={(event) => setOrdenReserva(event.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14, minWidth: 220 }}
          />
          <button
            type="submit"
            disabled={buscandoReserva}
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: "var(--boton)",
              color: "var(--sobre)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {buscandoReserva ? "Buscando..." : buscarPorReserva === "orden" ? "Buscar orden" : "Buscar reserva"}
          </button>
          <button
            type="button"
            disabled={busquedaReserva.filas.length === 0}
            onClick={() => {
              // Se descarga lo que se esta viendo, no lo que se escribio despues sin buscar.
              const numero = busquedaReserva.consulta;
              if (!numero) return;
              const params = new URLSearchParams({
                reserva: numero,
                por: busquedaReserva.por || "reserva",
                colores: colores ? "1" : "0",
              });
              descargarBlob(`/api/reservas/excel?${params.toString()}`)
                .then((blob) => guardarBlob(blob, "Revisión stock en reserva.xlsx"))
                .catch((err) => setAvisoBusquedaReserva(err.message));
            }}
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: busquedaReserva.filas.length === 0 ? "var(--pista)" : "var(--acento)",
              color: "var(--sobre)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Descargar planilla
          </button>
          {avisoBusquedaReserva && <p style={{ margin: 0, fontSize: 14 }}>{avisoBusquedaReserva}</p>}
        </form>
        {busquedaReserva.columnas.length > 0 && (
          <div style={{ marginBottom: 16 }}>
          <VistaPrevia
            filas={busquedaReserva.filas}
            columnas={busquedaReserva.columnas.length}
            altoMaximo={430}
            clave={`${busquedaReserva.por || "reserva"}:${busquedaReserva.consulta}`}
            alFinal={() => {
              const numero = busquedaReserva.consulta;
              const por = busquedaReserva.por || "reserva";
              if (!numero || !hayMasReservas.current || cargandoPaginaReserva.current) return;
              cargandoPaginaReserva.current = true;
              const pagina = paginaReserva.current + 1;
              const params = new URLSearchParams({
                reserva: numero,
                por,
                pagina: String(pagina),
                tamano: "100",
              });
              obtenerJson(`/api/reservas?${params.toString()}`, "No se pudo buscar la reserva.")
                .then((data) => {
                  const lote = data.filas || [];
                  paginaReserva.current = pagina;
                  const coincidencias = data.coincidencias ?? lote.length;
                  hayMasReservas.current = (pagina + 1) * 100 < coincidencias;
                  setBusquedaReserva((actual) => ({
                    ...actual,
                    columnas: data.columnas || actual.columnas,
                    filas: actual.filas.concat(lote),
                    marcadosCodigo: (actual.marcadosCodigo || []).concat(data.marcadosCodigo || []),
                    repeticiones: (actual.repeticiones || []).concat(data.repeticiones || []),
                  }));
                })
                .catch(() => {
                  hayMasReservas.current = false;
                })
                .finally(() => {
                  cargandoPaginaReserva.current = false;
                });
            }}
            className={clasePlanilla}
            renderFila={(fila, indice) => (
              <tr key={indice}>
                {busquedaReserva.columnas.map((nombre, columna) => {
                  const esEstado = nombre === "Estado";
                  const esCodigoConflicto = nombre === "Código" && busquedaReserva.marcadosCodigo?.[indice];
                  const valor = fila[columna];
                  const veces = busquedaReserva.repeticiones?.[indice] || 1;
                  return (
                    <td
                      key={columna}
                      className={colores && (esEstado || esCodigoConflicto) ? "celda-color" : undefined}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid var(--borde-suave)",
                        background:
                          colores && esCodigoConflicto
                            ? "#f9e37c"
                            : colores && esEstado
                              ? valor === "Disponible"
                                ? "#73c883"
                                : "#f9e37c"
                              : "var(--superficie)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {nombre === "N°" && veces > 1 ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {valor === "" || valor == null ? "" : String(valor)}
                          <span
                            title={`Aparece ${veces} veces en la reserva`}
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: colores ? "#f9e37c" : "var(--pista)",
                              color: colores ? "#111" : "var(--texto)",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            ×{veces}
                          </span>
                        </span>
                      ) : valor === "" || valor == null ? (
                        ""
                      ) : (
                        String(valor)
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
          >
              <thead>
                <tr>
                  {busquedaReserva.columnas.map((columna) => (
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
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!archivoReserva) {
              setAvisoReserva("Elige el PDF de la reserva.");
              return;
            }
            setAvisoReserva("");
            setRevisandoReserva(true);
            const cuerpo = new FormData();
            cuerpo.append("archivo", archivoReserva);
            enviarFormulario("/api/reserva", cuerpo, "No se pudo leer la reserva.")
              .then((data) => {
                setReserva({ columnas: data.columnas || [], filas: data.filas || [] });
              })
              .catch((err) => setAvisoReserva(err.message))
              .finally(() => setRevisandoReserva(false));
          }}
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 }}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              setArchivoReserva(event.target.files?.[0] || null);
              setReserva({ columnas: [], filas: [] });
            }}
          />
          <button
            type="submit"
            disabled={revisandoReserva}
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: "var(--boton)",
              color: "var(--sobre)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {revisandoReserva ? "Revisando..." : "Revisar reserva"}
          </button>
          <button
            type="button"
            disabled={!archivoReserva || reserva.filas.length === 0}
            onClick={() => {
              const cuerpo = new FormData();
              cuerpo.append("archivo", archivoReserva);
              cuerpo.append("colores", colores ? "1" : "0");
              descargarBlob("/api/reserva/excel", { method: "POST", body: cuerpo })
                .then((blob) => guardarBlob(blob, "Revisión stock en reserva.xlsx"))
                .catch((err) => setAvisoReserva(err.message));
            }}
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: reserva.filas.length === 0 ? "var(--pista)" : "var(--acento)",
              color: "var(--sobre)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Descargar planilla
          </button>
          {avisoReserva && <p style={{ margin: 0, fontSize: 14 }}>{avisoReserva}</p>}
        </form>
        {reserva.columnas.length > 0 && (
          <VistaPrevia
            filas={reserva.filas}
            columnas={reserva.columnas.length}
            className={clasePlanilla}
            vacio="El PDF no tiene líneas de reserva."
            renderFila={(fila) => (
              <tr key={fila[0]}>
                {fila.map((valor, columna) => (
                  <td
                    key={columna}
                    className={colores && columna === 7 ? "celda-color" : undefined}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid var(--borde-suave)",
                      background:
                        !colores || columna !== 7 ? "var(--superficie)" : valor === "Disponible" ? "#73c883" : "#f9e37c",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {valor === "" || valor == null ? "" : String(valor)}
                  </td>
                ))}
              </tr>
            )}
          >
              <thead>
                <tr>
                  {reserva.columnas.map((columna) => (
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
        )}
      </section>
  );
}
