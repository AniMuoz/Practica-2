import { useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import { iniciarRecorrido, recorridoPendiente } from "./Recorrido.jsx";
import { estadoInventario as estadoDeInventario, textoCampo } from "./reglasPlanilla.js";

export default function Detalle() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [columnas, setColumnas] = useState([]);
  const [fila, setFila] = useState(null);
  const [bodegas, setBodegas] = useState([]);
  const [inventario, setInventario] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [editando, setEditando] = useState(false);
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [datos, setDatos] = useState({});
  const [avisoDatos, setAvisoDatos] = useState("");
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [enCurso, setEnCurso] = useState("");
  const [advertenciaCodigo, setAdvertenciaCodigo] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [pulsado, setPulsado] = useState(0);
  const pulso = useRef(null);
  const permitirSalida = useRef(false);
  const hayCambiosRef = useRef(false);
  const [movil, setMovil] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const [imagenGrande, setImagenGrande] = useState(null);
  const [ocultarImagenes, setOcultarImagenes] = useState(
    () => localStorage.getItem("ocultarImagenes") === "1"
  );

  function cambiarOcultarImagenes(activo) {
    localStorage.setItem("ocultarImagenes", activo ? "1" : "0");
    setOcultarImagenes(activo);
    if (activo) setImagenGrande(null);
  }

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 800px)");
    const alCambiar = () => setMovil(consulta.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetch(`/api/material/${encodeURIComponent(codigo)}`)
      .then((res) => {
        if (res.status === 404) throw new Error("Material no encontrado.");
        if (!res.ok) throw new Error("No se pudo leer la API");
        return res.json();
      })
      .then((data) => {
        setColumnas(data.columnas || []);
        setFila(data.fila);
        setBodegas(data.bodegas || []);
        setInventario(data.fila.Inventario == null ? "" : String(data.fila.Inventario));
        setComentario(data.fila.Comentario == null ? "" : String(data.fila.Comentario));
      })
      .catch((err) => setError(err.message || "No se pudo cargar el material."))
      .finally(() => setCargando(false));
  }, [codigo]);

  useEffect(() => {
    permitirSalida.current = false;
  }, [codigo]);

  useEffect(() => {
    if (cargando || error || !fila) return;
    if (recorridoPendiente("material")) iniciarRecorrido("material");
  }, [cargando, error, fila]);

  const soloLectura = columnas.filter(
    (columna) => !["Inventario", "Comentario", "Rombo", "QR", "Foto"].includes(columna)
  );

  const estadoInventario = estadoDeInventario(fila);

  function guardarDatos(reemplazar) {
    setAvisoDatos("");
    setGuardandoDatos(true);
    setEnCurso("Guardando datos del material...");
    fetch(`/api/material/${encodeURIComponent(codigo)}/datos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, datos, reemplazar }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 409) {
          setAdvertenciaCodigo(true);
          return;
        }
        if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
        setFila(data.fila);
        setColumnas(data.columnas || []);
        setEditando(false);
        setClave("");
        setAdvertenciaCodigo(false);
        setAvisoDatos("Datos del material guardados.");
        const codigoNuevo = String(data.fila.Codigo);
        if (codigoNuevo !== String(codigo)) {
          permitirSalida.current = true;
          navigate(`/${encodeURIComponent(codigoNuevo)}`, { replace: true });
        }
      })
      .catch((err) => setAvisoDatos(err.message))
      .finally(() => {
        setGuardandoDatos(false);
        setEnCurso("");
      });
  }

  function eliminarMaterial() {
    setAvisoDatos("");
    setEliminando(true);
    setEnCurso("Eliminando material...");
    fetch(`/api/material/${encodeURIComponent(codigo)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudo eliminar el material.");
        setConfirmarEliminar(false);
        permitirSalida.current = true;
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setAvisoDatos(err.message);
        setEliminando(false);
        setEnCurso("");
      });
  }

  const inventarioSinGuardar = Boolean(
    fila && textoCampo(inventario) !== textoCampo(fila.Inventario)
  );
  const comentarioSinGuardar = Boolean(
    fila && textoCampo(comentario) !== textoCampo(fila.Comentario)
  );
  const datosSinGuardar = Boolean(
    editando &&
      fila &&
      soloLectura.some((columna) => textoCampo(datos[columna]) !== textoCampo(fila[columna]))
  );
  const hayCambiosSinGuardar = inventarioSinGuardar || comentarioSinGuardar || datosSinGuardar;
  hayCambiosRef.current = hayCambiosSinGuardar;

  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !permitirSalida.current &&
      hayCambiosRef.current &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!hayCambiosSinGuardar) return undefined;
    function avisarCierre(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisarCierre);
    return () => window.removeEventListener("beforeunload", avisarCierre);
  }, [hayCambiosSinGuardar]);

  function soltarAdvertencia() {
    clearInterval(pulso.current);
    setPulsado(0);
  }

  function mantenerAdvertencia() {
    const inicio = Date.now();
    clearInterval(pulso.current);
    pulso.current = setInterval(() => {
      const avance = Date.now() - inicio;
      if (avance >= 3000) {
        clearInterval(pulso.current);
        setPulsado(0);
        setAdvertenciaCodigo(false);
        guardarDatos(true);
        return;
      }
      setPulsado(avance / 3000);
    }, 50);
  }

  function subirImagen(campo, archivo) {
    if (!archivo) return;
    const cuerpo = new FormData();
    cuerpo.append("campo", campo);
    cuerpo.append("clave", clave);
    cuerpo.append("archivo", archivo);
    setAvisoDatos("");
    setEnCurso(`Subiendo ${campo}...`);
    fetch(`/api/material/${encodeURIComponent(codigo)}/imagen`, {
      method: "POST",
      body: cuerpo,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo subir la imagen.");
        setFila(data.fila);
        setColumnas(data.columnas || []);
        setAvisoDatos(`${campo} actualizado.`);
      })
      .catch((err) => setAvisoDatos(err.message))
      .finally(() => setEnCurso(""));
  }

  return (
    <main
      className="pagina-material"
      style={{
        height: movil ? "auto" : "100vh",
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        overflow: movil ? "visible" : "hidden",
        fontFamily: "Segoe UI, sans-serif",
        background: "var(--fondo)",
        color: "var(--texto)",
      }}
    >
      <Navbar />
      {enCurso && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: 8,
            background: "var(--boton)",
            color: "var(--sobre)",
            fontSize: 15,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
          }}
        >
          <span className="giro" aria-hidden="true" />
          {enCurso}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 data-tour="material" style={{ margin: 0, fontSize: 20 }}>Material {codigo}</h1>
          {estadoInventario && (
            <span
              title={estadoInventario.texto}
              aria-label={estadoInventario.texto}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: estadoInventario.color,
                flexShrink: 0,
              }}
            />
          )}
        </div>
        <button
          type="button"
          role="switch"
          data-tour="ocultar-imagenes"
          aria-checked={ocultarImagenes}
          onClick={() => cambiarOcultarImagenes(!ocultarImagenes)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 0,
            border: 0,
            background: "transparent",
            color: "inherit",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 22,
              borderRadius: 999,
              background: ocultarImagenes ? "var(--acento)" : "var(--borde)",
              position: "relative",
              flexShrink: 0,
              transition: "background 0.2s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: ocultarImagenes ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.25)",
                transition: "left 0.2s ease",
              }}
            />
          </span>
          Ocultar imágenes
        </button>
      </div>
      {cargando && <p>Cargando detalle...</p>}
      {error && <p>{error}</p>}
      {!cargando && !error && fila && !ocultarImagenes && (
        <div
          className="imagenes-material"
          style={{
            display: "grid",
            gridTemplateColumns: movil ? "1fr" : "1fr 1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {["Rombo", "QR", "Foto"].map((campo) => {
            const valor = fila[campo];
            const esImagen = typeof valor === "string" && /\.(png|jpe?g|webp|gif)$/i.test(valor);
            return (
              <section
                key={campo}
                className="tarjeta-imagen"
                style={{
                  position: "relative",
                  background: "var(--superficie)",
                  borderRadius: 8,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "160px 1fr",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                {esImagen && (
                  <a
                    className="descarga-imagen"
                    href={`/api/imagenes/${valor}`}
                    download={valor.split("/").pop()}
                    aria-label={`Descargar ${campo}`}
                    title="Descargar"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 4v11m0 0 4.5-4.5M12 15 7.5 10.5M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Descargar</span>
                  </a>
                )}
                <div
                  className="marco-imagen"
                  style={{
                    width: 160,
                    height: 160,
                    border: "1px solid var(--borde-suave)",
                    borderRadius: 8,
                    background: "var(--campo-suave)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                  }}
                >
                  {esImagen ? (
                    <img
                      src={`/api/imagenes/${valor}`}
                      alt={campo}
                      onClick={() => setImagenGrande({ src: `/api/imagenes/${valor}`, alt: campo })}
                      style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "zoom-in" }}
                    />
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>Sin imagen</span>
                  )}
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 14, fontWeight: 600 }}>
                  {campo}
                  {editando && (
                    <>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={Boolean(enCurso)}
                        onChange={(event) => {
                          subirImagen(campo, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                        style={{ fontWeight: 400, fontSize: 13 }}
                      />
                      {esImagen && (
                        <button
                          type="button"
                          disabled={Boolean(enCurso)}
                          onClick={() => {
                            setAvisoDatos("");
                            setEnCurso(`Quitando ${campo}...`);
                            fetch(`/api/material/${encodeURIComponent(codigo)}/imagen`, {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ campo, clave }),
                            })
                              .then(async (res) => {
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "No se pudo quitar la imagen.");
                                setFila(data.fila);
                                setColumnas(data.columnas || []);
                                setAvisoDatos(`${campo} quedó sin imagen.`);
                              })
                              .catch((err) => setAvisoDatos(err.message))
                              .finally(() => setEnCurso(""));
                          }}
                          style={{
                            justifySelf: "start",
                            padding: "6px 10px",
                            border: "1px solid var(--borde)",
                            borderRadius: 6,
                            background: "var(--superficie)",
                            fontSize: 13,
                            fontWeight: 400,
                            cursor: "pointer",
                          }}
                        >
                          Quitar imagen
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {!cargando && !error && fila && (
        <div
          className="cuerpo-material"
          style={{
            flex: movil ? "none" : 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: movil ? "1fr" : "1.4fr 1fr",
            gap: 16,
          }}
        >
          <section
            style={{
              background: "var(--superficie)",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 0,
            }}
          >
            {!editando && !pidiendoClave && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={marcando}
                onClick={() => {
                  const marcado = String(fila.Marcado) !== "1";
                  setMarcando(true);
                  fetch(`/api/material/${encodeURIComponent(codigo)}/marcado`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ marcado }),
                  })
                    .then(async (res) => {
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "No se pudo marcar.");
                      setFila(data.fila);
                    })
                    .catch((err) => setAvisoDatos(err.message || "No se pudo marcar."))
                    .finally(() => setMarcando(false));
                }}
                style={{
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: String(fila.Marcado) === "1" ? "#88DC65" : "var(--boton)",
                  color: String(fila.Marcado) === "1" ? "#1a1a1a" : "var(--sobre)",
                  fontSize: 14,
                  cursor: marcando ? "default" : "pointer",
                }}
              >
                {String(fila.Marcado) === "1" ? "Quitar marca" : "Marcar material"}
              </button>
              <button
                data-tour="editar-material"
                type="button"
                onClick={() => {
                  setAvisoDatos("");
                  setClave("");
                  setPidiendoClave(true);
                }}
                style={{
                  justifySelf: "start",
                  alignSelf: "start",
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "var(--boton)",
                  color: "var(--sobre)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cambiar datos de material
              </button>
              </div>
            )}
            {pidiendoClave && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setAvisoDatos("");
                  fetch("/api/acceso", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clave }),
                  })
                    .then(async (res) => {
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error || "Contraseña incorrecta.");
                      const iniciales = {};
                      soloLectura.forEach((columna) => {
                        iniciales[columna] = fila[columna] == null ? "" : String(fila[columna]);
                      });
                      setDatos(iniciales);
                      setPidiendoClave(false);
                      setEditando(true);
                    })
                    .catch((err) => setAvisoDatos(err.message));
                }}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <div style={{ position: "relative" }}>
                  <input
                    type={verClave ? "text" : "password"}
                    value={clave}
                    autoFocus
                    placeholder="Contraseña"
                    onChange={(event) => setClave(event.target.value)}
                    style={{ padding: "8px 36px 8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
                  />
                  <button
                    type="button"
                    aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setVerClave((visible) => !visible)}
                    style={{
                      position: "absolute",
                      right: 4,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: 0,
                      background: "transparent",
                      padding: 4,
                      cursor: "pointer",
                      color: "var(--texto)",
                      display: "flex",
                    }}
                  >
                    {verClave ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
                        <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c5.5 0 9.5 4.5 10.5 7-.4 1-1.2 2.4-2.4 3.6" />
                        <path d="M6.1 6.1C4.2 7.4 2.8 9.2 1.5 12c1 2.5 5 7 10.5 7 1.6 0 3-.4 4.3-1" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  type="submit"
                  style={{
                    padding: "8px 14px",
                    border: 0,
                    borderRadius: 6,
                    background: "var(--acento)",
                    color: "var(--sobre)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Entrar
                </button>
              </form>
            )}
            {soloLectura.includes("Stock") && (
              <div
                style={{
                  background: String(fila.Marcado) === "1" ? "#88DC65" : "var(--acento)",
                  color: String(fila.Marcado) === "1" ? "#1a1a1a" : "var(--sobre)",
                  borderRadius: 8,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Stock
                </span>
                {editando ? (
                  <input
                    value={datos.Stock ?? ""}
                    onChange={(event) =>
                      setDatos((actual) => ({ ...actual, Stock: event.target.value }))
                    }
                    style={{
                      minWidth: 120,
                      boxSizing: "border-box",
                      padding: "8px 10px",
                      border: 0,
                      borderRadius: 6,
                      fontSize: 28,
                      fontWeight: 700,
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
                    {fila.Stock === "" || fila.Stock == null ? "—" : fila.Stock}
                  </span>
                )}
              </div>
            )}
            {bodegas.length > 0 && (
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                Stock de otras bodegas:{" "}
                {bodegas.map((item) => `${item.bodega}: ${item.stock}`).join(" · ")}
              </p>
            )}
            <dl
              className="datos-material"
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: movil ? "1fr 1fr" : "repeat(3, minmax(0, 1fr))",
                gap: 10,
                alignContent: "start",
                overflow: "auto",
              }}
            >
              {soloLectura.filter((columna) => columna !== "Stock").map((columna) => (
                <div key={columna} style={{ minWidth: 0 }}>
                  <dt style={{ fontSize: 12, color: "var(--texto-suave)", marginBottom: 2 }}>{columna}</dt>
                  <dd style={{ margin: 0, fontSize: 15 }}>
                    {editando ? (
                      <input
                        value={datos[columna] ?? ""}
                        onChange={(event) =>
                          setDatos((actual) => ({ ...actual, [columna]: event.target.value }))
                        }
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "6px 8px",
                          border: "1px solid var(--borde)",
                          borderRadius: 6,
                          fontSize: 14,
                        }}
                      />
                    ) : fila[columna] === "" || fila[columna] == null ? (
                      "—"
                    ) : (
                      fila[columna]
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {editando && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={guardandoDatos || eliminando}
                  onClick={() => guardarDatos(false)}
                  style={{
                    padding: "8px 14px",
                    border: 0,
                    borderRadius: 6,
                    background: "var(--acento)",
                    color: "var(--sobre)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {guardandoDatos ? "Guardando..." : "Guardar datos"}
                </button>
                <button
                  type="button"
                  disabled={guardandoDatos || eliminando}
                  onClick={() => setConfirmarEliminar(true)}
                  style={{
                    padding: "8px 14px",
                    border: 0,
                    borderRadius: 6,
                    background: "#b42318",
                    color: "#fff",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Eliminar material
                </button>
              </div>
            )}
            {avisoDatos && <p style={{ margin: 0, fontSize: 14 }}>{avisoDatos}</p>}
          </section>
          <form
            data-tour="conteo"
            onSubmit={(event) => {
              event.preventDefault();
              setAviso("");
              setGuardando(true);
              setEnCurso("Guardando inventario y comentario...");
              fetch(`/api/material/${encodeURIComponent(codigo)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inventario, comentario }),
              })
                .then(async (res) => {
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
                  setFila(data.fila);
                  setInventario(data.fila.Inventario == null ? "" : String(data.fila.Inventario));
                  setComentario(data.fila.Comentario == null ? "" : String(data.fila.Comentario));
                  setAviso("Cambios guardados en la tabla.");
                })
                .catch((err) => setAviso(err.message))
                .finally(() => {
                  setGuardando(false);
                  setEnCurso("");
                });
            }}
            style={{
              background: "var(--superficie)",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 0,
            }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Inventario
              <input
                value={inventario}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                onChange={(event) => {
                  const valor = event.target.value;
                  if (valor === "" || /^-?\d+$/.test(valor)) setInventario(valor);
                }}
                style={{ padding: "8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, flex: 1, minHeight: 0 }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                Comentario
                <span>{comentario.length}/50</span>
              </span>
              <textarea
                value={comentario}
                maxLength={50}
                onChange={(event) => setComentario(event.target.value.slice(0, 50))}
                style={{
                  flex: 1,
                  minHeight: movil ? 140 : 0,
                  padding: "8px 12px",
                  border: "1px solid var(--borde)",
                  borderRadius: 6,
                  fontSize: 14,
                  resize: "none",
                }}
              />
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="submit"
                disabled={guardando}
                style={{
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "var(--acento)",
                  color: "var(--sobre)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              {aviso && <p style={{ margin: 0, fontSize: 14 }}>{aviso}</p>}
            </div>
          </form>
        </div>
      )}
      {bloqueo.state === "blocked" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            zIndex: 80,
          }}
        >
          <div style={{ background: "var(--superficie)", borderRadius: 8, padding: 20, maxWidth: 420 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Hay cambios sin guardar</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              Si sales de esta página se pierden los datos que todavía no guardaste.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={() => bloqueo.reset()}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "var(--acento)",
                  color: "var(--sobre)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Seguir en esta página
              </button>
              <button
                type="button"
                onClick={() => bloqueo.proceed()}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid var(--borde)",
                  borderRadius: 6,
                  background: "var(--superficie)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmarEliminar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            zIndex: 70,
          }}
        >
          <div style={{ background: "var(--superficie)", borderRadius: 8, padding: 20, maxWidth: 420 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Eliminar material {codigo}</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              Se va a borrar este material de la tabla, junto con su inventario, comentario e imágenes.
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                disabled={eliminando}
                onClick={eliminarMaterial}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "#b42318",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar este material"}
              </button>
              <button
                type="button"
                disabled={eliminando}
                onClick={() => setConfirmarEliminar(false)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid var(--borde)",
                  borderRadius: 6,
                  background: "var(--superficie)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {advertenciaCodigo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <div style={{ background: "var(--superficie)", borderRadius: 8, padding: 20, maxWidth: 420 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Ese código ya existe</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              Si continúas, los datos de este material reemplazan al que ya tiene ese código. Mantén
              pulsado el botón 3 segundos para pasar.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onPointerDown={mantenerAdvertencia}
                onPointerUp={soltarAdvertencia}
                onPointerLeave={soltarAdvertencia}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: `linear-gradient(90deg, var(--acento) ${pulsado * 100}%, var(--boton) ${pulsado * 100}%)`,
                  color: "var(--sobre)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Mantener 3 segundos
              </button>
              <button
                type="button"
                onClick={() => {
                  soltarAdvertencia();
                  setAdvertenciaCodigo(false);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid var(--borde)",
                  borderRadius: 6,
                  background: "var(--superficie)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancelar y volver a editar
              </button>
            </div>
          </div>
        </div>
      )}
      {imagenGrande && (
        <div
          onClick={() => setImagenGrande(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0, 0, 0, 0.72)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          <img
            src={imagenGrande.src}
            alt={imagenGrande.alt}
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8, background: "#fff" }}
          />
        </div>
      )}
      <div className="footer">
        <p>© 2026 Berfre - Práctica 2 - Transformación digital - React - Anibal Alexis Muñoz Reyes - UNAB</p>
    </div>
    </main>
  );
}
