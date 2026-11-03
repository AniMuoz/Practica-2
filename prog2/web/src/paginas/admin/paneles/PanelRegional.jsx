import { colorCantidad } from "../../../lib/reglasPlanilla.js";
import PanelPlanilla from "./PanelPlanilla.jsx";
import VistaPrevia from "./VistaPrevia.jsx";

// Stock por bodega (regional). `filas` ya viene filtrada y ordenada segun los filtros de stock.
export default function PanelRegional({ tabla, filas, cargando, aviso, hrefExcel, filtros, colores, clasePlanilla }) {
  return (
    <PanelPlanilla
      titulo="Stock por bodega"
      hrefExcel={hrefExcel}
      filtros={filtros}
      cargando={cargando}
      textoCargando="Cargando stock..."
      aviso={aviso}
    >
      <VistaPrevia
        filas={filas}
        columnas={tabla.columnas.length}
        className={clasePlanilla}
        vacio="No hay stock regional cargado."
        renderFila={(fila, indice) => (
          <tr key={`${fila[0]}-${indice}`}>
            {fila.map((valor, columna) => {
              const fondo = columna < 2 ? "var(--superficie)" : colorCantidad(valor);
              return (
                <td
                  key={columna}
                  className={colores && columna >= 2 ? "celda-color" : undefined}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--borde-suave)",
                    background: colores ? fondo : "var(--superficie)",
                    fontWeight: columna === fila.length - 1 ? 700 : 400,
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
