// Alta de material: el envio lo resuelve Admin (alEnviar).
export default function PanelFormulario({ alEnviar, columnas, datos, setDatos, guardando, aviso }) {
  return (
      <form
        onSubmit={alEnviar}
        className="form-admin"
        style={{
          background: "var(--superficie)",
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
                setDatos((actual) =>
                  columna === "Ubicación"
                    ? { ...actual, Ubicación: valor, "Sub-ubicación": valor.slice(0, 4) }
                    : { ...actual, [columna]: valor }
                );
              }}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--borde)",
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
              background: "var(--acento)",
              color: "var(--sobre)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {guardando ? "Guardando..." : "Agregar"}
          </button>
          {aviso && <p style={{ margin: 0, fontSize: 14 }}>{aviso}</p>}
        </div>
      </form>
  );
}
