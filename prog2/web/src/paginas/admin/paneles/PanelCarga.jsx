// Carga masiva: el envio lo resuelve Admin (alEnviar); aqui solo se pinta el formulario.
export default function PanelCarga({ alEnviar, cargaKey, modoCarga, setModoCarga, columnaCarga, setColumnaCarga, columnasDestino, esMovilCarga, setArchivosQr, setArchivo, importando, textoUltima, avisoCarga }) {
  return (
      <form
        key={cargaKey}
        onSubmit={alEnviar}
        style={{
          background: "var(--superficie)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <strong style={{ fontSize: 14 }}>Carga masiva</strong>
        <select
          aria-label="Tipo de planilla"
          value={modoCarga}
          onChange={(event) => setModoCarga(event.target.value)}
          style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
        >
          <option value="completa">Planilla completa</option>
          <option value="sap">Planilla EXPORT SAP</option>
          <option value="ubicaciones">Planilla de ubicaciones</option>
          <option value="precios">Planilla de precios</option>
          <option value="dos-columnas">Planilla de 2 columnas</option>
          <option value="reservas">Añadir reservas</option>
          <option value="movimientos">Movimientos</option>
          {esMovilCarga ? (
            <option value="" disabled>
              Opción no disponible para la versión móvil, intente desde un PC
            </option>
          ) : (
            <>
              <option value="qr">Cargar QR</option>
              <option value="rombo">Cargar rombo</option>
              <option value="foto">Cargar fotos</option>
            </>
          )}
        </select>
        {modoCarga === "dos-columnas" && (
          <select
            aria-label="Columna a llenar"
            value={columnaCarga}
            onChange={(event) => setColumnaCarga(event.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
          >
            {columnasDestino.map((columna) => (
              <option key={columna} value={columna}>
                {columna}
              </option>
            ))}
          </select>
        )}
        {["qr", "rombo", "foto"].includes(modoCarga) ? (
          <input
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            onChange={(event) => setArchivosQr(Array.from(event.target.files || []))}
          />
        ) : (
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setArchivo(event.target.files?.[0] || null)}
          />
        )}
        <button
          type="submit"
          disabled={importando}
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
          {importando ? "Importando..." : modoCarga === "qr" ? "Subir QR" : modoCarga === "rombo" ? "Subir rombo" : modoCarga === "foto" ? "Subir fotos" : "Importar planilla"}
        </button>
        <p style={{ margin: 0, fontSize: 14, flexBasis: "100%" }}>{textoUltima}</p>
        {avisoCarga && <p style={{ margin: 0, fontSize: 14 }}>{avisoCarga}</p>}
      </form>
  );
}
