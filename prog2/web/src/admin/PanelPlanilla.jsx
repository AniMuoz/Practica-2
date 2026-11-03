const ESTILO_DESCARGA = {
  padding: "8px 14px",
  borderRadius: 6,
  background: "var(--boton)",
  color: "var(--sobre)",
  fontSize: 14,
  textDecoration: "none",
};

// Marco comun de los paneles de planilla de solo lectura: titulo, boton de descarga, filtros,
// aviso de carga o error y, cuando hay datos, el contenido (`children`).
// `acciones` (opcional) son controles extra que van junto al boton de descarga.
export default function PanelPlanilla({ titulo, hrefExcel, filtros, cargando, textoCargando, aviso, acciones, children }) {
  const descarga = (
    <a href={hrefExcel} style={ESTILO_DESCARGA}>
      Descargar planilla
    </a>
  );
  return (
    <section
      style={{
        background: "var(--superficie)",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          ...(acciones ? { flexWrap: "wrap" } : {}),
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{titulo}</h2>
        {acciones ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {acciones}
            {descarga}
          </div>
        ) : (
          descarga
        )}
      </div>
      {filtros}
      {cargando && <p style={{ margin: 0 }}>{textoCargando}</p>}
      {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
      {!cargando && !aviso && children}
    </section>
  );
}
