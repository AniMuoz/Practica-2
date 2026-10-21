import { useCallback, useEffect, useState } from "react";
import Navbar from "./Navbar.jsx";
import { iniciarRecorrido, recorridoPendiente } from "./Recorrido.jsx";

async function leer(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo leer la auditoría.");
  return data;
}

const fecha = (valor) => (valor ? new Date(valor).toLocaleString("es-CL") : "");

const ACCIONES = {
  crear_folio: "Generó el folio",
  anadir_fila: "Añadió una fila",
  editar_celda: "Editó una celda",
  subir_firma: "Subió una firma",
  quitar_firma: "Quitó una firma",
  quitar_fila: "Quitó una fila",
  eliminar_folio: "Eliminó el folio",
  descargar_excel: "Descargó la planilla",
};

const CAMPOS = {
  fecha: "FECHA", chofer: "CHOFER", rut: "RUT", patente: "PATENTE", ruta: "RUTA", h_salida: "H.SALIDA",
  h_llegada: "H.LLEGADA", km_ini: "KM/INI", km_term: "KM/TERM", observacion: "OBSERVACIÓN", firma: "FIRMA",
};

function descripcion(e) {
  const base = ACCIONES[e.accion] || e.accion;
  const donde = [e.n_fila ? `fila ${e.n_fila}` : "", e.folio ? `folio ${e.folio}` : ""].filter(Boolean).join(" del ");
  if (e.accion === "editar_celda") {
    return `${base} ${CAMPOS[e.campo] || e.campo} (${donde}): "${e.valor_anterior || "vacío"}" → "${e.valor_nuevo || "vacío"}"`;
  }
  const motivo = e.detalle && e.detalle.motivo ? ` — motivo: ${e.detalle.motivo}` : "";
  return `${base}${donde ? ` (${donde})` : ""}${motivo}`;
}

const TH = { padding: "8px 10px", textAlign: "left", background: "var(--superficie)", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap" };
const TD = { padding: "6px 10px", borderBottom: "1px solid var(--borde-suave)" };
const CAMPO = { padding: "6px 8px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 };
const BOTON = { padding: "6px 12px", border: "1px solid var(--borde)", borderRadius: 6, background: "var(--superficie)", color: "var(--texto)", cursor: "pointer", fontSize: 14 };

function TablaLog({ eventos, conFolio = true }) {
  if (eventos.length === 0) return <p>Sin actividad registrada.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={TH}>Fecha y hora</th>
            <th style={TH}>Usuario</th>
            {conFolio && <th style={TH}>Folio</th>}
            <th style={TH}>Cambio</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e.id}>
              <td style={{ ...TD, whiteSpace: "nowrap" }}>{fecha(e.creado_en)}</td>
              <td style={{ ...TD, fontWeight: 600 }}>{e.usuario || "—"}</td>
              {conFolio && <td style={TD}>{e.folio ?? ""}</td>}
              <td style={TD}>{descripcion(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Actividad({ alListo }) {
  const [filtros, setFiltros] = useState({ usuario: "", accion: "", folio: "", desde: "", hasta: "" });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ eventos: [], total: 0, por_pagina: 50 });
  const [error, setError] = useState("");

  function cargar(p, f) {
    const q = new URLSearchParams({ pagina: String(p) });
    Object.entries(f).forEach(([k, v]) => v.trim() && q.set(k, v.trim()));
    leer(`/api/bitacora/auditoria/log?${q}`)
      .then((d) => {
        setError("");
        setDatos(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => alListo?.());
  }

  useEffect(() => {
    cargar(pagina, filtros);
  }, [pagina]);

  const paginas = Math.max(1, Math.ceil(datos.total / datos.por_pagina));
  const cambiar = (k) => (ev) => setFiltros({ ...filtros, [k]: ev.target.value });

  return (
    <div data-tour="auditoria-actividad">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (pagina === 1) cargar(1, filtros);
          else setPagina(1);
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}
      >
        <input placeholder="Usuario" aria-label="Usuario" value={filtros.usuario} onChange={cambiar("usuario")} style={{ ...CAMPO, width: 120 }} />
        <select aria-label="Acción" value={filtros.accion} onChange={cambiar("accion")} style={CAMPO}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input placeholder="Folio" aria-label="Folio" inputMode="numeric" value={filtros.folio} onChange={cambiar("folio")} style={{ ...CAMPO, width: 80 }} />
        <label style={{ fontSize: 13 }}>Desde <input type="date" value={filtros.desde} onChange={cambiar("desde")} style={CAMPO} /></label>
        <label style={{ fontSize: 13 }}>Hasta <input type="date" value={filtros.hasta} onChange={cambiar("hasta")} style={CAMPO} /></label>
        <button type="submit" style={{ ...BOTON, background: "var(--boton)", color: "var(--sobre)", border: 0 }}>Filtrar</button>
      </form>
      {error ? <p style={{ color: "var(--peligro)" }}>{error}</p> : <TablaLog eventos={datos.eventos} />}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 14 }}>
        <button type="button" style={BOTON} disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {paginas} · {datos.total} eventos</span>
        <button type="button" style={BOTON} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </div>
    </div>
  );
}

function Folios({ alListo }) {
  const [folios, setFolios] = useState([]);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [errorDetalle, setErrorDetalle] = useState("");

  useEffect(() => {
    leer("/api/bitacora/auditoria")
      .then((data) => {
        const lista = data.folios || [];
        setFolios(lista);
        return lista.length ? abrir(lista[0].folio) : null;
      })
      .catch((e) => setError(e.message))
      .finally(() => alListo?.());
  }, []);

  function abrir(folio) {
    setErrorDetalle("");
    return leer(`/api/bitacora/auditoria/${folio}`)
      .then(setDetalle)
      .catch((e) => {
        setDetalle(null);
        setErrorDetalle(e.message);
      });
  }

  if (error) return <p style={{ color: "var(--peligro)" }}>{error}</p>;

  return (
    <>
      <div data-tour="auditoria-folios" style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={TH}>Folio</th>
              <th style={TH}>Alta</th>
              <th style={TH}>Estado</th>
              <th style={TH}>Eliminado</th>
            </tr>
          </thead>
          <tbody>
            {folios.map((f) => (
              <tr key={f.folio} onClick={() => abrir(f.folio)} style={{ cursor: "pointer", fontWeight: detalle && detalle.folio === f.folio ? 700 : 400 }}>
                <td style={TD}>{f.folio}</td>
                <td style={TD}>{fecha(f.creado_en)}</td>
                <td style={TD}>{f.eliminado_en ? "Eliminado" : "Activo"}</td>
                <td style={TD}>{fecha(f.eliminado_en)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {errorDetalle && <p style={{ color: "var(--peligro)" }}>{errorDetalle}</p>}
      {detalle && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18 }}>
            Folio {detalle.folio} {detalle.eliminado_en ? "(eliminado)" : ""}
          </h2>
          <h3 data-tour="auditoria-filas" style={{ fontSize: 16 }}>Filas</h3>
          {detalle.filas.length === 0 ? (
            <p>Sin filas.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
                <thead>
                  <tr>
                    {["N°", "Chofer", "RUT", "Patente", "Ruta", "Fecha", "Salida", "Llegada", "Km ini", "Km term", "Observación"].map((t) => (
                      <th key={t} style={TH}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalle.filas.map((fila) => (
                    <tr key={fila.n_fila}>
                      {[fila.n_fila, fila.chofer, fila.rut, fila.patente, fila.ruta, fila.fecha, fila.h_salida, fila.h_llegada, fila.km_ini, fila.km_term, fila.observacion].map((v, i) => (
                        <td key={i} style={TD}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 data-tour="auditoria-firmas" style={{ fontSize: 16 }}>Historial de firmas</h3>
          {detalle.historial_firmas.length === 0 ? (
            <p>Sin firmas quitadas.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
                <thead>
                  <tr>
                    {["Fila", "Firmada", "Quitada", "Motivo", "Hash"].map((t) => (
                      <th key={t} style={TH}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalle.historial_firmas.map((h) => (
                    <tr key={h.id}>
                      <td style={TD}>{h.n_fila}</td>
                      <td style={TD}>{fecha(h.firma_en)}</td>
                      <td style={TD}>{fecha(h.quitada_en)}</td>
                      <td style={TD}>{h.motivo}</td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12 }}>{String(h.firma_hash || "").slice(0, 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 data-tour="auditoria-log" style={{ fontSize: 16 }}>Historial de cambios</h3>
          <TablaLog eventos={detalle.log || []} conFolio={false} />
        </section>
      )}
    </>
  );
}

export default function Auditoria() {
  const [listos, setListos] = useState(0);
  const sumar = useCallback(() => setListos((n) => n + 1), []);

  useEffect(() => {
    if (listos < 2) return;
    const espera = setTimeout(() => {
      if (recorridoPendiente("auditoria")) iniciarRecorrido("auditoria");
    }, 300);
    return () => clearTimeout(espera);
  }, [listos]);

  return (
    <main style={{ minHeight: "100vh", boxSizing: "border-box", margin: 0, padding: 16, fontFamily: "Segoe UI, sans-serif", background: "var(--fondo)", color: "var(--texto)" }}>
      <Navbar />
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Auditoría de bitácoras</h1>
      <section style={{ background: "var(--superficie)", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Actividad</h2>
        <Actividad alListo={sumar} />
      </section>
      <section style={{ background: "var(--superficie)", borderRadius: 8, padding: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Folios</h2>
        <Folios alListo={sumar} />
      </section>
    </main>
  );
}