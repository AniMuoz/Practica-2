const ESTILO_DESCARGA = {
  padding: "8px 14px",
  borderRadius: 6,
  background: "var(--boton)",
  color: "var(--sobre)",
  fontSize: 14,
  textDecoration: "none",
};

// Marco comun de los paneles de planilla de solo lectura: titulo, filtros,
// aviso de carga o error y, cuando hay datos, la barra de acciones y el contenido (`children`).
// La descarga (y `acciones`, si las hay) queda alineada a la derecha, justo encima de la tabla.
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
      <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>{titulo}</h2>
      {filtros}
      {cargando && <p style={{ margin: 0 }}>{textoCargando}</p>}
      {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
      {!cargando && !aviso && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {acciones}
            {descarga}
          </div>
          {children}
        </>
      )}
    </section>
  );
}
