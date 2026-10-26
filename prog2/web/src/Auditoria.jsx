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
  const [datos, setDatos] = useState({ eventos: [], total: 0, por_pagina: 25 });
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

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ACCIONES_VENTAS = {
  crear_planilla: "Abrió la planilla del mes",
  anadir_venta: "Añadió productos",
  editar_celda: "Editó una celda",
  quitar_fila: "Quitó una fila",
  quitar_orden: "Quitó una orden completa",
  descargar_excel: "Descargó la planilla",
};

function descripcionVenta(e) {
  const base = ACCIONES_VENTAS[e.accion] || e.accion;
  const d = e.detalle || {};
  if (e.accion === "editar_celda") {
    return `${base} ${e.campo} (fila ${d.pos ?? e.fila_id}, ${d.codigo || ""}): "${e.valor_anterior || "vacío"}" → "${e.valor_nuevo || "vacío"}"`;
  }
  if (e.accion === "descargar_excel" && d.anual) return `${base} anual ${d.anio} (${d.planillas} planillas, ${d.filas} filas)`;
  if (e.accion === "anadir_venta") return `${base}: ${d.filas} filas, ${d.movimiento}, contratista ${d.contratista}, N° ${d.n_venta}`;
  if (e.accion === "quitar_orden") return `${base}: ${d.filas} filas, ${d.movimiento}, contratista ${d.contratista}, N° ${d.n_venta}`;
  if (e.accion === "quitar_fila") return `${base} ${d.pos ?? ""} (${d.codigo || ""} ${d.descripcion || ""})`;
  return base;
}

function TablaLogVentas({ eventos }) {
  if (eventos.length === 0) return <p>Sin actividad registrada.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={TH}>Fecha y hora</th>
            <th style={TH}>Usuario</th>
            <th style={TH}>Planilla</th>
            <th style={TH}>Cambio</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e.id}>
              <td style={{ ...TD, whiteSpace: "nowrap" }}>{fecha(e.creado_en)}</td>
              <td style={{ ...TD, fontWeight: 600 }}>{e.usuario || "—"}</td>
              <td style={TD}>{e.planilla_id ?? ""}</td>
              <td style={TD}>{descripcionVenta(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ventas() {
  const [planillas, setPlanillas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ usuario: "", accion: "", desde: "", hasta: "" });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ eventos: [], total: 0, por_pagina: 25 });

  function cargarLog(p, f) {
    const q = new URLSearchParams({ pagina: String(p) });
    Object.entries(f).forEach(([k, v]) => v.trim() && q.set(k, v.trim()));
    leer(`/api/ventas/auditoria/log?${q}`)
      .then((d) => {
        setError("");
        setDatos(d);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    cargarLog(pagina, filtros);
  }, [pagina]);

  useEffect(() => {
    leer("/api/ventas/auditoria")
      .then((d) => setPlanillas(d.planillas || []))
      .catch((e) => setError(e.message));
  }, []);

  function abrir(id) {
    leer(`/api/ventas/auditoria/${id}`).then(setDetalle).catch((e) => setError(e.message));
  }

  const paginas = Math.max(1, Math.ceil(datos.total / datos.por_pagina));
  const cambiar = (k) => (ev) => setFiltros({ ...filtros, [k]: ev.target.value });

  return (
    <div data-tour="auditoria-ventas">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (pagina === 1) cargarLog(1, filtros);
          else setPagina(1);
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}
      >
        <input placeholder="Usuario" aria-label="Usuario ventas" value={filtros.usuario} onChange={cambiar("usuario")} style={{ ...CAMPO, width: 120 }} />
        <select aria-label="Acción ventas" value={filtros.accion} onChange={cambiar("accion")} style={CAMPO}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES_VENTAS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label style={{ fontSize: 13 }}>Desde <input type="date" value={filtros.desde} onChange={cambiar("desde")} style={CAMPO} /></label>
        <label style={{ fontSize: 13 }}>Hasta <input type="date" value={filtros.hasta} onChange={cambiar("hasta")} style={CAMPO} /></label>
        <button type="submit" style={{ ...BOTON, background: "var(--boton)", color: "var(--sobre)", border: 0 }}>Filtrar</button>
      </form>
      {error && <p style={{ color: "var(--peligro)" }}>{error}</p>}
      <TablaLogVentas eventos={datos.eventos} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", fontSize: 14 }}>
        <button type="button" style={BOTON} disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {paginas} · {datos.total} eventos</span>
        <button type="button" style={BOTON} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </div>
      <h3 style={{ fontSize: 16 }}>Planillas por mes</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={TH}>Mes</th>
              <th style={TH}>Creada</th>
            </tr>
          </thead>
          <tbody>
            {planillas.map((p) => (
              <tr key={p.id} onClick={() => abrir(p.id)} style={{ cursor: "pointer", fontWeight: detalle && detalle.id === p.id ? 700 : 400 }}>
                <td style={TD}>{MESES[p.mes - 1]} {p.anio}</td>
                <td style={TD}>{fecha(p.creado_en)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detalle && (
        <section style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 16 }}>Planilla {MESES[detalle.mes - 1]} {detalle.anio}</h3>
          {detalle.filas.length === 0 ? (
            <p>Sin filas.</p>
          ) : (
            <div style={{ overflow: "auto", maxHeight: "50vh" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
                <thead>
                  <tr>
                    {["Pos", "Código", "Descripción", "Solicitado", "Entregar", "Contratista", "Movimiento", "N°Venta", "Fecha"].map((t) => (
                      <th key={t} style={TH}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalle.filas.map((f) => (
                    <tr key={f.id}>
                      {[f.pos, f.codigo, f.descripcion, f.solicitado, f.entregar, f.contratista, f.movimiento, f.n_venta, f.fecha].map((v, i) => (
                        <td key={i} style={TD}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 style={{ fontSize: 16 }}>Historial de cambios</h3>
          <TablaLogVentas eventos={detalle.log || []} />
        </section>
      )}
    </div>
  );
}

const ACCIONES_USUARIOS = {
  crear_usuario: "Creó un usuario",
  eliminar_usuario: "Eliminó un usuario",
  cambiar_clave: "Cambió la contraseña",
  cambiar_rol: "Cambió el rol",
};

const ROLES = { admin: "administrador", operador: "operador", desactivado: "desactivado" };
const rolLegible = (rol) => ROLES[rol] || rol || "—";

function descripcionUsuario(e) {
  const base = ACCIONES_USUARIOS[e.accion] || e.accion;
  if (e.accion === "cambiar_rol") return `${base} de ${e.objetivo}: ${rolLegible(e.rol_anterior)} → ${rolLegible(e.rol_nuevo)}`;
  if (e.accion === "crear_usuario") return `${base}: ${e.objetivo} (${rolLegible(e.rol_nuevo)})`;
  if (e.accion === "eliminar_usuario") return `${base}: ${e.objetivo} (era ${rolLegible(e.rol_anterior)})`;
  return `${base} de ${e.objetivo}`;
}

function Usuarios() {
  const [filtros, setFiltros] = useState({ actor: "", objetivo: "", accion: "", desde: "", hasta: "" });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ eventos: [], total: 0, por_pagina: 25 });
  const [error, setError] = useState("");

  function cargar(p, f) {
    const q = new URLSearchParams({ pagina: String(p) });
    Object.entries(f).forEach(([k, v]) => v.trim() && q.set(k, v.trim()));
    leer(`/api/usuarios/auditoria?${q}`)
      .then((d) => {
        setError("");
        setDatos(d);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    cargar(pagina, filtros);
  }, [pagina]);

  const paginas = Math.max(1, Math.ceil(datos.total / datos.por_pagina));
  const cambiar = (k) => (ev) => setFiltros({ ...filtros, [k]: ev.target.value });

  return (
    <div data-tour="auditoria-usuarios">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (pagina === 1) cargar(1, filtros);
          else setPagina(1);
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}
      >
        <input placeholder="Quién lo hizo" aria-label="Quién lo hizo" value={filtros.actor} onChange={cambiar("actor")} style={{ ...CAMPO, width: 140 }} />
        <input placeholder="Usuario afectado" aria-label="Usuario afectado" value={filtros.objetivo} onChange={cambiar("objetivo")} style={{ ...CAMPO, width: 150 }} />
        <select aria-label="Acción de usuario" value={filtros.accion} onChange={cambiar("accion")} style={CAMPO}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES_USUARIOS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label style={{ fontSize: 13 }}>Desde <input type="date" value={filtros.desde} onChange={cambiar("desde")} style={CAMPO} /></label>
        <label style={{ fontSize: 13 }}>Hasta <input type="date" value={filtros.hasta} onChange={cambiar("hasta")} style={CAMPO} /></label>
        <button type="submit" style={{ ...BOTON, background: "var(--boton)", color: "var(--sobre)", border: 0 }}>Filtrar</button>
      </form>
      {error ? <p style={{ color: "var(--peligro)" }}>{error}</p> : null}
      {datos.eventos.length === 0 && !error ? <p>Sin cambios de usuarios registrados.</p> : null}
      {datos.eventos.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={TH}>Fecha y hora</th>
                <th style={TH}>Quién lo hizo</th>
                <th style={TH}>Usuario</th>
                <th style={TH}>Cambio</th>
              </tr>
            </thead>
            <tbody>
              {datos.eventos.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}>{fecha(e.creado_en)}</td>
                  <td style={{ ...TD, fontWeight: 600 }}>{e.actor || "—"}</td>
                  <td style={TD}>{e.objetivo}</td>
                  <td style={TD}>{descripcionUsuario(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 14 }}>
        <button type="button" style={BOTON} disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {paginas} · {datos.total} eventos</span>
        <button type="button" style={BOTON} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </div>
    </div>
  );
}

function Seccion({ titulo, abiertaInicial = false, children }) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  return (
    <section style={{ background: "var(--superficie)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta((valor) => !valor)}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 12, margin: 0, padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", textAlign: "left" }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{titulo}</h2>
        <span style={{ fontSize: 14 }}>{abierta ? "Ocultar" : "Mostrar"}</span>
      </button>
      {abierta && <div style={{ marginTop: 12 }}>{children}</div>}
    </section>
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
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Auditoría de usuarios, ventas y bitácoras</h1>
      <Seccion titulo="Usuarios" abiertaInicial>
        <Usuarios />
      </Seccion>
      <Seccion titulo="Planilla de ventas">
        <Ventas />
      </Seccion>
      <Seccion titulo="Actividad de bitácora">
        <Actividad alListo={sumar} />
      </Seccion>
      <Seccion titulo="Folios de bitácora">
        <Folios alListo={sumar} />
      </Seccion>
    </main>
  );
}