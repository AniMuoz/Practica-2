import { bodegaPrincipal } from "../../../lib/bodega.js";
import { colorLibre } from "../../../lib/reglasPlanilla.js";
import PanelPlanilla from "./PanelPlanilla.jsx";
import VistaPrevia from "./VistaPrevia.jsx";

const ESTILO_TH = (colores) => ({
  position: "sticky",
  top: 0,
  textAlign: "left",
  padding: "8px 10px",
  background: colores ? "#a9e5e5" : "var(--superficie)",
  border: "1px solid var(--borde)",
});

// Stock en bodega M501. `filas` ya viene filtrada y ordenada segun los filtros de stock.
export default function PanelBodega({ tabla, filas, cargando, aviso, hrefExcel, filtros, colores, clasePlanilla }) {
  return (
    <PanelPlanilla
      titulo={`Bodega ${bodegaPrincipal()}`}
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
        vacio={`No hay stock de ${bodegaPrincipal()} cargado.`}
        renderFila={(fila, indice) => {
          const fondo = colorLibre(fila[2]);
          return (
            <tr key={`${fila[0]}-${indice}`}>
              {fila.map((valor, columna) => (
                <td
                  key={columna}
                  className={colores && columna === 2 ? "celda-color" : undefined}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--borde-suave)",
                    background: colores && columna === 2 ? fondo : "var(--superficie)",
                  }}
                >
                  {valor === "" || valor == null ? "" : String(valor)}
                </td>
              ))}
            </tr>
          );
        }}
      >
        <thead>
          <tr>
            {tabla.columnas.map((columna) => (
              <th key={columna} style={ESTILO_TH(colores)}>
                {columna}
              </th>
            ))}
          </tr>
        </thead>
      </VistaPrevia>
    </PanelPlanilla>
  );
}
