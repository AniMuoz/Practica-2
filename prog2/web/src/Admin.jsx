import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar.jsx";

const IMAGENES = new Set(["Rombo", "QR"]);

export default function Admin() {
  const navigate = useNavigate();
  const [autorizado, setAutorizado] = useState(false);
  const [clave, setClave] = useState("");
  const [columnas, setColumnas] = useState([]);
  const [datos, setDatos] = useState({});
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!autorizado) return;
    fetch("/api/tabla")
      .then((res) => res.json())
      .then((data) => {
        const lista = (data.columnas || []).filter((columna) => !IMAGENES.has(columna));
        setColumnas(lista);
        const vacios = {};
        lista.forEach((columna) => {
          vacios[columna] = "";
        });
        setDatos(vacios);
      })
      .catch(() => setAviso("No se pudo cargar la tabla."));
  }, [autorizado]);

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: 16,
        fontFamily: "Segoe UI, sans-serif",
        background: "#f4f6f8",
        color: "#111111",
      }}
    >
      <Navbar />
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Agregar material</h1>
      {!autorizado && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (clave !== "Berfre2026") {
              setAviso("Contraseña incorrecta.");
              return;
            }
            setAviso("");
            setAutorizado(true);
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
          {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
        </form>
      )}
      {autorizado && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setAviso("");
            setGuardando(true);
            fetch("/api/material", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clave, datos }),
            })
              .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "No se pudo agregar.");
                navigate(`/${encodeURIComponent(data.fila.Codigo)}`);
              })
              .catch((err) => setAviso(err.message))
              .finally(() => setGuardando(false));
          }}
          className="form-admin"
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {columnas.map((columna) => (
            <label key={columna} style={{ display: "grid", gap: 4, fontSize: 13 }}>
              {columna}
              <input
                value={datos[columna] ?? ""}
                inputMode={columna === "Inventario" ? "numeric" : "text"}
                onChange={(event) => {
                  const valor = event.target.value;
                  if (columna === "Inventario" && valor !== "" && !/^-?\d+$/.test(valor)) return;
                  setDatos((actual) => ({ ...actual, [columna]: valor }));
                }}
                style={{
                  padding: "8px 10px",
                  border: "1px solid #d0d5dd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </label>
          ))}
          <div style={{ display: "flex", alignItems: "end", gap: 12 }}>
            <button
              type="submit"
              disabled={guardando}
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
              {guardando ? "Guardando..." : "Agregar"}
            </button>
            {aviso && <p style={{ margin: 0, fontSize: 14 }}>{aviso}</p>}
          </div>
        </form>
      )}
    </main>
  );
}
