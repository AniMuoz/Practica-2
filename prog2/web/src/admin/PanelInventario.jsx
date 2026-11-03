import Interruptor from "./Interruptor.jsx";
import PanelPlanilla from "./PanelPlanilla.jsx";
import VistaPrevia from "./VistaPrevia.jsx";

const vacia = (valor) => String(valor ?? "").trim() === "";

// Inventario por lugar. Los interruptores eligen si la columna Existencia sale de Libre utilizacion o de Inventario.
export default function PanelInventario({
  tabla,
  filas,
  cargando,
  aviso,
  hrefExcel,
  filtros,
  colores,
  clasePlanilla,
  copiarExistencia,
  copiarInventario,
  alternarExistencia,
  alternarInventario,
}) {
  const acciones = (
    <>
      <Interruptor activo={copiarExistencia} onClick={alternarExistencia} texto="Libre utilización" />
      <Interruptor activo={copiarInventario} onClick={alternarInventario} texto="Inventario" />
    </>
  );
  return (
    <PanelPlanilla
      titulo="Inventario por lugar"
      hrefExcel={hrefExcel}
      filtros={filtros}
      cargando={cargando}
      textoCargando="Cargando inventario..."
      aviso={aviso}
      acciones={acciones}
    >
      <VistaPrevia
        filas={filas}
        columnas={tabla.columnas.length}
        className={clasePlanilla}
        vacio="No hay materiales para inventariar."
        renderFila={(fila, indice) => (
          <tr key={`${fila[0]}-${indice}`}>
            {fila.map((valor, columna) => {
              const resaltar = colores && (columna === 2 || columna === 3) && vacia(valor);
              return (
                <td
                  key={columna}
                  className={resaltar ? "celda-color" : undefined}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--borde-suave)",
                    background: resaltar ? "#f9e37c" : "var(--superficie)",
                  }}
                >
                  {valor === "" || valor == null ? "" : String(valor)}
                </td>
              );
            })}
          </tr>
        )}
      >
        <thead>
          <tr>
            {tabla.columnas.map((columna) => (
              <th
                key={columna}
                style={{
                  position: "sticky",
                  top: 0,
                  textAlign: "left",
                  padding: "8px 10px",
                  background: colores ? "#a9e5e5" : "var(--superficie)",
                  border: "1px solid var(--borde)",
                }}
              >
                {columna}
              </th>
            ))}
          </tr>
        </thead>
      </VistaPrevia>
    </PanelPlanilla>
  );
}
