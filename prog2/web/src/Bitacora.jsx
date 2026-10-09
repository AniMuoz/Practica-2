import { useEffect, useRef, useState } from "react";

const COLUMNAS = [
  { campo: "fecha", titulo: "FECHA", ancho: 140 },
  { campo: "chofer", titulo: "CHOFER", ancho: 130 },
  { campo: "rut", titulo: "RUT", ancho: 110 },
  { campo: "patente", titulo: "PATENTE", ancho: 90 },
  { campo: "ruta", titulo: "RUTA", ancho: 130 },
  { campo: "h_salida", titulo: "H.SALIDA", ancho: 80 },
  { campo: "h_llegada", titulo: "H.LLEGADA", ancho: 80 },
  { campo: "km_ini", titulo: "KM/INI", ancho: 90 },
  { campo: "km_term", titulo: "KM/TERM", ancho: 90 },
  { campo: "km_reco", titulo: "KM/RECO", ancho: 90 },
  { campo: "observacion", titulo: "OBSERVACION", ancho: 240 },
  { campo: "firma", titulo: "FIRMA", ancho: 130 },
];

const CAMPOS_EDITABLES = COLUMNAS.map((columna) => columna.campo).filter((campo) => campo !== "km_reco");

function filaVacia(n) {
  const fila = { n_fila: n };
  COLUMNAS.forEach((columna) => {
    fila[columna.campo] = "";
  });
  return fila;
}

function numero(valor) {
  const texto = String(valor ?? "").trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(texto) ? Number(texto) : null;
}

function recorrido(fila) {
  const inicio = numero(fila.km_ini);
  const termino = numero(fila.km_term);
  if (inicio === null || termino === null) return "";
  return String(Math.round((termino - inicio) * 1000) / 1000);
}

function datosDe(fila) {
  const datos = {};
  CAMPOS_EDITABLES.forEach((campo) => {
    datos[campo] = String(fila[campo] ?? "").trim();
  });
  return datos;
}

const PREFIJO_IMAGEN = "img:";
const LADO_MAXIMO_FIRMA = { ancho: 600, alto: 200 };

function imagenDeFirma(valor) {
  const texto = String(valor ?? "");
  return texto.startsWith(PREFIJO_IMAGEN) ? texto.slice(PREFIJO_IMAGEN.length) : "";
}

function firmaComoPng(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO_MAXIMO_FIRMA.ancho / imagen.width, LADO_MAXIMO_FIRMA.alto / imagen.height);
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.max(1, Math.round(imagen.width * escala));
      lienzo.height = Math.max(1, Math.round(imagen.height * escala));
      lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      lienzo.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo preparar la imagen."))), "image/png");
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El archivo no es una imagen válida."));
    };
    imagen.src = url;
  });
}

const BOTON = { padding: "8px 14px", border: 0, borderRadius: 6, color: "var(--sobre)", fontSize: 14, cursor: "pointer" };

export default function Bitacora({ clave, colores, alPendiente }) {
  const [consulta, setConsulta] = useState("");
  const [folio, setFolio] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [estado, setEstado] = useState("");
  const [resumen, setResumen] = useState({ ultimo: null, total: 0 });
  const [generando, setGenerando] = useState(false);
  const [eliminando, setEliminando] = useState(null);
  const filasRef = useRef([]);
  const folioRef = useRef(null);
  const guardadas = useRef(new Map());
  const cola = useRef(Promise.resolve());
  const pendientes = useRef(0);

  filasRef.current = folio ? folio.filas : [];
  folioRef.current = folio ? folio.folio : null;

  function recordarGuardadas(filas) {
    guardadas.current = new Map(filas.map((fila) => [fila.n_fila, JSON.stringify(datosDe(fila))]));
  }

  function hayPendiente() {
    if (pendientes.current > 0) return true;
    return filasRef.current.some((fila) => guardadas.current.get(fila.n_fila) !== JSON.stringify(datosDe(fila)));
  }

  function encolar(tarea) {
    pendientes.current += 1;
    setEstado("guardando");
    alPendiente?.(true);
    cola.current = cola.current
      .then(tarea)
      .catch((err) => setAviso(err.message))
      .finally(() => {
        pendientes.current -= 1;
        if (pendientes.current > 0) return;
        const sinGuardar = hayPendiente();
        setEstado(sinGuardar ? "error" : "guardado");
        alPendiente?.(sinGuardar);
      });
  }

  useEffect(() => () => alPendiente?.(false), []);

  function cargarResumen() {
    return fetch("/api/bitacora/folios/ultimo", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo leer el último folio.");
        setResumen(data);
      })
      .catch((err) => setAviso(err.message));
  }

  useEffect(() => {
    cargarResumen();
  }, []);

  function mostrarFolio(data) {
    recordarGuardadas(data.filas || []);
    setFolio({ folio: data.folio, filas: data.filas || [] });
    setConsulta(String(data.folio));
    setEstado("");
  }

  function consultarFolio(event) {
    event.preventDefault();
    const texto = consulta.trim();
    if (!/^\d+$/.test(texto) || Number(texto) < 1) {
      setAviso("Escribe un número de folio desde 1.");
      return;
    }
    setAviso("");
    setCargando(true);
    fetch(`/api/bitacora/folios/${texto}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo leer el folio.");
        mostrarFolio(data);
      })
      .catch((err) => {
        setFolio(null);
        setAviso(err.message);
      })
      .finally(() => setCargando(false));
  }

  function generarFolio() {
    if (!window.confirm("¿Generar un nuevo folio de bitácora?")) return;
    setAviso("");
    setGenerando(true);
    fetch("/api/bitacora/folios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo generar el folio.");
        mostrarFolio(data);
        cargarResumen();
      })
      .catch((err) => setAviso(err.message))
      .finally(() => setGenerando(false));
  }

  function cambiar(n, campo, valor) {
    setFolio((actual) => ({
      ...actual,
      filas: actual.filas.map((fila) => (fila.n_fila === n ? { ...fila, [campo]: valor } : fila)),
    }));
  }

  function guardarFila(n) {
    const numeroFolio = folioRef.current;
    const actual = filasRef.current.find((fila) => fila.n_fila === n);
    if (!actual || guardadas.current.get(n) === JSON.stringify(datosDe(actual))) return;
    encolar(async () => {
      const fila = filasRef.current.find((item) => item.n_fila === n);
      if (!fila || folioRef.current !== numeroFolio) return;
      const datos = datosDe(fila);
      const res = await fetch(`/api/bitacora/folios/${numeroFolio}/filas/${n}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, datos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la fila.");
      guardadas.current.set(n, JSON.stringify(datos));
      setFolio((previo) =>
        previo && previo.folio === numeroFolio
          ? { ...previo, filas: previo.filas.map((item) => (item.n_fila === n ? { ...item, km_reco: data.fila.km_reco } : item)) }
          : previo
      );
    });
  }

  async function subirFirma(n, archivo) {
    if (!archivo) return;
    setAviso("");
    let png;
    try {
      png = await firmaComoPng(archivo);
    } catch (err) {
      setAviso(err.message);
      return;
    }
    const numeroFolio = folioRef.current;
    encolar(async () => {
      const cuerpo = new FormData();
      cuerpo.append("clave", clave);
      cuerpo.append("archivo", png, "firma.png");
      const res = await fetch(`/api/bitacora/folios/${numeroFolio}/filas/${n}/firma`, { method: "POST", body: cuerpo });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la imagen de la firma.");
      if (folioRef.current !== numeroFolio) return;
      const valor = data.fila.firma;
      const previa = guardadas.current.get(n);
      if (previa) guardadas.current.set(n, JSON.stringify({ ...JSON.parse(previa), firma: valor }));
      filasRef.current = filasRef.current.map((fila) => (fila.n_fila === n ? { ...fila, firma: valor } : fila));
      setFolio((actual) => ({
        ...actual,
        filas: actual.filas.map((fila) => (fila.n_fila === n ? { ...fila, firma: valor } : fila)),
      }));
    });
  }

  function quitarFirmaImagen(n) {
    cambiar(n, "firma", "");
    filasRef.current = filasRef.current.map((fila) => (fila.n_fila === n ? { ...fila, firma: "" } : fila));
    guardarFila(n);
  }

  function anadirFila() {
    const n = filasRef.current.length + 1;
    setAviso("");
    setFolio((actual) => ({ ...actual, filas: [...actual.filas, filaVacia(n)] }));
    filasRef.current = [...filasRef.current, filaVacia(n)];
    guardarFila(n);
  }

  function quitarFila(n) {
    if (!window.confirm(`¿Quitar la fila ${n} del folio ${folioRef.current}?`)) return;
    const numeroFolio = folioRef.current;
    setAviso("");
    encolar(async () => {
      const res = await fetch(`/api/bitacora/folios/${numeroFolio}/filas/${n}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo quitar la fila.");
      if (folioRef.current !== numeroFolio) return;
      recordarGuardadas(data.filas || []);
      filasRef.current = data.filas || [];
      setFolio({ folio: data.folio, filas: data.filas || [] });
    });
  }

  function eliminarFolio() {
    const numeroFolio = folioRef.current;
    const escrito = (eliminando?.escrito ?? "").trim();
    if (!eliminando || eliminando.paso !== 2 || escrito !== String(numeroFolio)) return;
    setEliminando(null);
    setAviso("");
    encolar(async () => {
      const res = await fetch(`/api/bitacora/folios/${numeroFolio}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, confirmacion: escrito.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar el folio.");
      guardadas.current = new Map();
      filasRef.current = [];
      folioRef.current = null;
      setFolio(null);
      setConsulta("");
      setAviso(`Folio ${numeroFolio} eliminado.`);
      cargarResumen();
    });
  }

  function descargar() {
    const numeroFolio = folioRef.current;
    setAviso("");
    const descarga = () =>
      fetch(`/api/bitacora/folios/${numeroFolio}/excel`)
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "No se pudo descargar.");
          }
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement("a");
          enlace.href = url;
          enlace.download = `Bitacora folio ${numeroFolio}.xlsx`;
          enlace.click();
          URL.revokeObjectURL(url);
        })
        .catch((err) => setAviso(err.message));
    cola.current.then(descarga);
  }

  const textoEstado = { guardando: "Guardando...", guardado: "Guardado", error: "Hay filas sin guardar" }[estado] || "";

  return (
    <section style={{ background: "var(--superficie)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Bitácora camión</h2>
      <form onSubmit={consultarFolio} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Número de folio"
          value={consulta}
          placeholder="N.º de folio"
          onChange={(event) => {
            const valor = event.target.value;
            if (valor === "" || /^\d+$/.test(valor)) setConsulta(valor);
          }}
          style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14, width: 140 }}
        />
        <button type="submit" disabled={cargando} style={{ ...BOTON, background: "var(--boton)" }}>
          {cargando ? "Buscando..." : "Consultar folio"}
        </button>
        <button type="button" disabled={generando} onClick={generarFolio} style={{ ...BOTON, background: "var(--acento)" }}>
          {generando ? "Generando..." : "Generar nuevo folio"}
        </button>
        <span style={{ fontSize: 14 }}>
          {resumen.ultimo ? `Último folio: ${resumen.ultimo} (${resumen.total} en total)` : "Todavía no hay folios."}
        </span>
      </form>
      {aviso && <p style={{ margin: "0 0 12px", fontSize: 14 }}>{aviso}</p>}
      {folio && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 16 }}>Folio N.º {folio.folio}</strong>
            <button type="button" onClick={anadirFila} style={{ ...BOTON, background: "var(--boton)" }}>
              Añadir fila
            </button>
            <button type="button" onClick={descargar} style={{ ...BOTON, background: "var(--acento)" }}>
              Descargar planilla
            </button>
            <button type="button" onClick={() => setEliminando({ paso: 1, escrito: "" })} style={{ ...BOTON, background: "var(--peligro)" }}>
              Eliminar folio
            </button>
            <span style={{ fontSize: 14 }}>{textoEstado}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 10px", border: "1px solid var(--borde)", background: colores ? "#a9e5e5" : "var(--superficie)" }}>#</th>
                  {COLUMNAS.map((columna) => (
                    <th
                      key={columna.campo}
                      style={{
                        textAlign: "center",
                        padding: "8px 10px",
                        background: colores ? "#a9e5e5" : "var(--superficie)",
                        border: "1px solid var(--borde)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {columna.titulo}
                    </th>
                  ))}
                  <th style={{ border: "1px solid var(--borde)", background: colores ? "#a9e5e5" : "var(--superficie)" }} />
                </tr>
              </thead>
              <tbody>
                {folio.filas.map((fila) => (
                  <tr key={fila.n_fila}>
                    <td style={{ padding: "0 10px", border: "1px solid var(--borde-suave)", textAlign: "center" }}>{fila.n_fila}</td>
                    {COLUMNAS.map((columna) => {
                      const calculada = columna.campo === "km_reco";
                      if (columna.campo === "firma") {
                        const imagen = imagenDeFirma(fila.firma);
                        return (
                          <td key={columna.campo} style={{ padding: 4, border: "1px solid var(--borde-suave)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {imagen ? (
                                <img
                                  src={`/api/imagenes/${encodeURIComponent(imagen)}`}
                                  alt={`Firma de la fila ${fila.n_fila}`}
                                  style={{ maxWidth: 110, maxHeight: 34, background: "#fff", border: "1px solid var(--borde)", borderRadius: 4 }}
                                />
                              ) : (
                                <input
                                  value={fila.firma ?? ""}
                                  maxLength={200}
                                  aria-label={`FIRMA fila ${fila.n_fila}`}
                                  onChange={(event) => cambiar(fila.n_fila, "firma", event.target.value)}
                                  onBlur={() => guardarFila(fila.n_fila)}
                                  style={{ boxSizing: "border-box", width: columna.ancho, padding: "6px 8px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
                                />
                              )}
                              <label style={{ ...BOTON, padding: "6px 10px", background: "var(--boton)", whiteSpace: "nowrap" }}>
                                {imagen ? "Cambiar imagen" : "Subir imagen"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  aria-label={`Subir imagen de firma fila ${fila.n_fila}`}
                                  style={{ display: "none" }}
                                  onChange={(event) => {
                                    const archivo = event.target.files?.[0];
                                    event.target.value = "";
                                    subirFirma(fila.n_fila, archivo);
                                  }}
                                />
                              </label>
                              {imagen && (
                                <button
                                  type="button"
                                  onClick={() => quitarFirmaImagen(fila.n_fila)}
                                  style={{ ...BOTON, padding: "6px 10px", background: "var(--peligro)", whiteSpace: "nowrap" }}
                                >
                                  Quitar imagen
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={columna.campo} style={{ padding: 4, border: "1px solid var(--borde-suave)" }}>
                          <input
                            type={columna.campo === "fecha" ? "date" : "text"}
                            value={calculada ? recorrido(fila) : fila[columna.campo] ?? ""}
                            readOnly={calculada}
                            tabIndex={calculada ? -1 : undefined}
                            maxLength={200}
                            aria-label={`${columna.titulo} fila ${fila.n_fila}`}
                            onChange={(event) => cambiar(fila.n_fila, columna.campo, event.target.value)}
                            onBlur={() => guardarFila(fila.n_fila)}
                            style={{
                              boxSizing: "border-box",
                              width: columna.ancho,
                              padding: "6px 8px",
                              border: "1px solid var(--borde)",
                              borderRadius: 6,
                              fontSize: 14,
                              opacity: calculada ? 0.75 : 1,
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ padding: 4, border: "1px solid var(--borde-suave)" }}>
                      <button
                        type="button"
                        onClick={() => quitarFila(fila.n_fila)}
                        style={{ ...BOTON, padding: "6px 10px", background: "var(--peligro)" }}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {folio.filas.length === 0 && <p style={{ margin: "12px 0 0", fontSize: 14 }}>Este folio todavía no tiene filas. Usa "Añadir fila".</p>}
        </>
      )}
      {folio && eliminando && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            zIndex: 90,
          }}
        >
          <div style={{ background: "var(--superficie)", borderRadius: 8, padding: 20, maxWidth: 420, width: "100%" }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
              {eliminando.paso === 1 ? `Eliminar el folio ${folio.folio}` : "Segunda verificacion"}
            </p>
            {eliminando.paso === 1 ? (
              <p style={{ margin: "0 0 16px", fontSize: 14 }}>
                Se borraran todas las filas de este folio y su numero no se podra volver a usar. Desea continuar?
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 12px", fontSize: 14 }}>
                  Para confirmar la eliminacion, escriba el numero del folio: {folio.folio}
                </p>
                <input
                  autoFocus
                  inputMode="numeric"
                  aria-label="Numero del folio a eliminar"
                  value={eliminando.escrito}
                  onChange={(event) => {
                    const valor = event.target.value;
                    if (valor === "" || /^\d+$/.test(valor)) setEliminando({ ...eliminando, escrito: valor });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") eliminarFolio();
                  }}
                  style={{ boxSizing: "border-box", width: "100%", padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14, marginBottom: 16 }}
                />
              </>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {eliminando.paso === 1 ? (
                <button type="button" onClick={() => setEliminando({ paso: 2, escrito: "" })} style={{ ...BOTON, background: "var(--peligro)" }}>
                  Continuar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={eliminando.escrito.trim() !== String(folio.folio)}
                  onClick={eliminarFolio}
                  style={{ ...BOTON, background: "var(--peligro)", opacity: eliminando.escrito.trim() !== String(folio.folio) ? 0.5 : 1 }}
                >
                  Eliminar folio definitivamente
                </button>
              )}
              <button
                type="button"
                onClick={() => setEliminando(null)}
                style={{ ...BOTON, border: "1px solid var(--borde)", background: "var(--superficie)", color: "var(--texto)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
