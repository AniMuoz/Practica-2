import { useEffect, useState } from "react";

export default function App() {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/mensaje")
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo leer la API");
        return res.json();
      })
      .then((data) => setTexto(data.texto))
      .catch(() => setError("No se pudo conectar con el servidor."));
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        display: "grid",
        placeItems: "center",
        fontFamily: "Segoe UI, sans-serif",
        background: "#ffffff",
        color: "#111111",
      }}
    >
      <h1>{error || texto || "Cargando..."}</h1>
    </main>
  );
}
