import { useEffect, useState } from "react";
import Navbar from "./Navbar.jsx";

async function leer(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo leer la auditoría.");
  return data;
}

const fecha = (valor) => (valor ? new Date(valor).toLocaleString() : "");

export default function Auditoria() {
  const [folios, setFolios] = useState([]);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [errorDetalle, setErrorDetalle] = useState("");

  useEffect(() => {
    leer("/api/bitacora/auditoria")
      .then((data) => setFolios(data.folios || []))
      .catch((e) => setError(e.message));
  }, []);

  function abrir(folio) {
    setErrorDetalle("");
    leer(`/api/bitacora/auditoria/${folio}`)
      .then(setDetalle)
      .catch((e) => {
        setDetalle(null);
        setErrorDetalle(e.message);
      });
  }

  return (
    <main style={{ minHeight: "100vh", boxSizing: "border-box", margin: 0, padding: 16, fontFamily: "Segoe UI, sans-serif", background: "var(--fondo)", color: "var(--texto)" }}>
      <Navbar />
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Auditoría de bitácoras</h1>
      {error ? (
        <p style={{ color: "var(--peligro)" }}>{error}</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Alta</th>
                  <th>Estado</th>
                  <th>Eliminado</th>
                </tr>
              </thead>
              <tbody>
                {folios.map((f) => (
                  <tr key={f.folio} onClick={() => abrir(f.folio)} style={{ cursor: "pointer", fontWeight: detalle && detalle.folio === f.folio ? 700 : 400 }}>
                    <td>{f.folio}</td>
                    <td>{fecha(f.creado_en)}</td>
                    <td>{f.eliminado_en ? "Eliminado" : "Activo"}</td>
                    <td>{fecha(f.eliminado_en)}</td>
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
              <h3 style={{ fontSize: 16 }}>Filas</h3>
              {detalle.filas.length === 0 ? (
                <p>Sin filas.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", textAlign: "left" }}>
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th>Chofer</th>
                        <th>RUT</th>
                        <th>Patente</th>
                        <th>Ruta</th>
                        <th>Fecha</th>
                        <th>Salida</th>
                        <th>Llegada</th>
                        <th>Km ini</th>
                        <th>Km term</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.filas.map((fila) => (
                        <tr key={fila.n_fila}>
                          <td>{fila.n_fila}</td>
                          <td>{fila.chofer}</td>
                          <td>{fila.rut}</td>
                          <td>{fila.patente}</td>
                          <td>{fila.ruta}</td>
                          <td>{fila.fecha}</td>
                          <td>{fila.h_salida}</td>
                          <td>{fila.h_llegada}</td>
                          <td>{fila.km_ini}</td>
                          <td>{fila.km_term}</td>
                          <td>{fila.observacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h3 style={{ fontSize: 16 }}>Historial de firmas</h3>
              {detalle.historial_firmas.length === 0 ? (
                <p>Sin firmas quitadas.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", textAlign: "left" }}>
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Firmada</th>
                        <th>Quitada</th>
                        <th>Motivo</th>
                        <th>Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.historial_firmas.map((h) => (
                        <tr key={h.id}>
                          <td>{h.n_fila}</td>
                          <td>{fecha(h.firma_en)}</td>
                          <td>{fecha(h.quitada_en)}</td>
                          <td>{h.motivo}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{String(h.firma_hash || "").slice(0, 12)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
