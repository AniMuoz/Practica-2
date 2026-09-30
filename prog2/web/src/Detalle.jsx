import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function Detalle() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [columnas, setColumnas] = useState([]);
  const [fila, setFila] = useState(null);
  const [inventario, setInventario] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [editando, setEditando] = useState(false);
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState({});
  const [avisoDatos, setAvisoDatos] = useState("");
  const [guardandoDatos, setGuardandoDatos] = useState(false);

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
        setInventario(data.fila.Inventario == null ? "" : String(data.fila.Inventario));
        setComentario(data.fila.Comentario == null ? "" : String(data.fila.Comentario));
      })
      .catch((err) => setError(err.message || "No se pudo cargar el material."))
      .finally(() => setCargando(false));
  }, [codigo]);

  const soloLectura = columnas.filter(
    (columna) => !["Inventario", "Comentario", "Rombo", "QR"].includes(columna)
  );

  function subirImagen(campo, archivo) {
    if (!archivo) return;
    const cuerpo = new FormData();
    cuerpo.append("campo", campo);
    cuerpo.append("clave", clave);
    cuerpo.append("archivo", archivo);
    setAvisoDatos("");
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
      .catch((err) => setAvisoDatos(err.message));
  }

  return (
    <main
      style={{
        height: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "Segoe UI, sans-serif",
        background: "#f4f6f8",
        color: "#111111",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Material {codigo}</h1>
        <Link to="/" style={{ color: "#1d4ed8", textDecoration: "none", fontSize: 14 }}>
          Volver al inventario
        </Link>
      </header>
      {cargando && <p>Cargando detalle...</p>}
      {error && <p>{error}</p>}
      {!cargando && !error && fila && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {["Rombo", "QR"].map((campo) => {
            const valor = fila[campo];
            const esImagen = typeof valor === "string" && /\.(png|jpe?g|webp|gif)$/i.test(valor);
            return (
              <section
                key={campo}
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "160px 1fr",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 160,
                    height: 160,
                    border: "1px solid #e6e8ec",
                    borderRadius: 8,
                    background: "#f8fafc",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                  }}
                >
                  {esImagen ? (
                    <img
                      src={`/api/imagenes/${valor}`}
                      alt={campo}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ color: "#98a2b3", fontSize: 13 }}>Sin imagen</span>
                  )}
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 14, fontWeight: 600 }}>
                  {campo}
                  {editando && (
                    <>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          subirImagen(campo, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                        style={{ fontWeight: 400, fontSize: 13 }}
                      />
                      {esImagen && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvisoDatos("");
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
                              .catch((err) => setAvisoDatos(err.message));
                          }}
                          style={{
                            justifySelf: "start",
                            padding: "6px 10px",
                            border: "1px solid #d0d5dd",
                            borderRadius: 6,
                            background: "#fff",
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
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 16,
          }}
        >
          <section
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 0,
            }}
          >
            {!editando && !pidiendoClave && (
              <button
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
                  background: "#111827",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cambiar datos de material
              </button>
            )}
            {pidiendoClave && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (clave !== "Berfre2026") {
                    setAvisoDatos("Contraseña incorrecta.");
                    return;
                  }
                  const iniciales = {};
                  soloLectura.forEach((columna) => {
                    iniciales[columna] = fila[columna] == null ? "" : String(fila[columna]);
                  });
                  setDatos(iniciales);
                  setAvisoDatos("");
                  setPidiendoClave(false);
                  setEditando(true);
                }}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  type="password"
                  value={clave}
                  autoFocus
                  placeholder="Contraseña"
                  onChange={(event) => setClave(event.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "8px 14px",
                    border: 0,
                    borderRadius: 6,
                    background: "#1d4ed8",
                    color: "#fff",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Entrar
                </button>
              </form>
            )}
            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
                alignContent: "start",
                overflow: "auto",
              }}
            >
              {soloLectura.map((columna) => (
                <div key={columna} style={{ minWidth: 0 }}>
                  <dt style={{ fontSize: 12, color: "#667085", marginBottom: 2 }}>{columna}</dt>
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
                          border: "1px solid #d0d5dd",
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
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  disabled={guardandoDatos}
                  onClick={() => {
                    setAvisoDatos("");
                    setGuardandoDatos(true);
                    fetch(`/api/material/${encodeURIComponent(codigo)}/datos`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ clave, datos }),
                    })
                      .then(async (res) => {
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
                        setFila(data.fila);
                        setColumnas(data.columnas || []);
                        setEditando(false);
                        setClave("");
                        setAvisoDatos("Datos del material guardados.");
                        const codigoNuevo = String(data.fila.Codigo);
                        if (codigoNuevo !== String(codigo)) {
                          navigate(`/${encodeURIComponent(codigoNuevo)}`, { replace: true });
                        }
                      })
                      .catch((err) => setAvisoDatos(err.message))
                      .finally(() => setGuardandoDatos(false));
                  }}
                  style={{
                    padding: "8px 14px",
                    border: 0,
                    borderRadius: 6,
                    background: "#1d4ed8",
                    color: "#fff",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {guardandoDatos ? "Guardando..." : "Guardar datos"}
                </button>
              </div>
            )}
            {avisoDatos && <p style={{ margin: 0, fontSize: 14 }}>{avisoDatos}</p>}
          </section>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setAviso("");
              setGuardando(true);
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
                .finally(() => setGuardando(false));
            }}
            style={{
              background: "#fff",
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
                inputMode="numeric"
                onChange={(event) => {
                  const valor = event.target.value;
                  if (valor === "" || /^-?\d+$/.test(valor)) setInventario(valor);
                }}
                style={{ padding: "8px 12px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, flex: 1, minHeight: 0 }}>
              Comentario
              <textarea
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
                style={{
                  flex: 1,
                  minHeight: 0,
                  padding: "8px 12px",
                  border: "1px solid #d0d5dd",
                  borderRadius: 6,
                  fontSize: 14,
                  resize: "none",
                }}
              />
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="submit"
                disabled={guardando || !/^-?\d+$/.test(inventario)}
                style={{
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "#1d4ed8",
                  color: "#fff",
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
    </main>
  );
}
