import { useEffect, useRef } from "react";

export default function Planilla({ className, style, children }) {
  const ref = useRef(null);
  const rango = useRef(null);
  const arrastrando = useRef(false);

  useEffect(() => {
    const tabla = ref.current;
    if (!tabla) return;

    const pintar = () => {
      tabla.querySelectorAll(".col-sel").forEach((celda) => celda.classList.remove("col-sel"));
      const actual = rango.current;
      if (!actual) return;
      const desde = Math.min(actual.desde, actual.hasta);
      const hasta = Math.max(actual.desde, actual.hasta);
      const colDesde = Math.min(actual.colDesde, actual.colHasta);
      const colHasta = Math.max(actual.colDesde, actual.colHasta);
      for (let fila = desde; fila <= hasta; fila += 1) {
        for (let col = colDesde; col <= colHasta; col += 1) {
          tabla.rows[fila]?.cells[col]?.classList.add("col-sel");
        }
      }
    };

    const celdaEn = (x, y) => {
      const nodo = document.elementFromPoint(x, y);
      const celda = nodo?.closest?.("td, th");
      if (!celda || !tabla.contains(celda)) return null;
      return celda;
    };

    const alBajar = (evento) => {
      if (evento.button !== 0) return;
      const celda = evento.target.closest("td, th");
      if (!celda || !tabla.contains(celda)) return;
      arrastrando.current = true;
      tabla.dataset.seleccionMovida = "0";
      rango.current = {
        colDesde: celda.cellIndex,
        colHasta: celda.cellIndex,
        desde: celda.parentElement.rowIndex,
        hasta: celda.parentElement.rowIndex,
      };
      pintar();
    };

    const alMover = (evento) => {
      if (!arrastrando.current || !rango.current) return;
      const celda = celdaEn(evento.clientX, evento.clientY);
      if (!celda) return;
      const fila = celda.parentElement.rowIndex;
      const col = celda.cellIndex;
      if (fila !== rango.current.hasta || col !== rango.current.colHasta) {
        tabla.dataset.seleccionMovida = "1";
      }
      rango.current = { ...rango.current, colHasta: col, hasta: fila };
      pintar();
    };

    const alSoltar = () => {
      arrastrando.current = false;
    };

    const alCopiar = (evento) => {
      const actual = rango.current;
      if (!actual) return;
      const desde = Math.min(actual.desde, actual.hasta);
      const hasta = Math.max(actual.desde, actual.hasta);
      const colDesde = Math.min(actual.colDesde, actual.colHasta);
      const colHasta = Math.max(actual.colDesde, actual.colHasta);
      const lineas = [];
      for (let fila = desde; fila <= hasta; fila += 1) {
        const celdas = [];
        for (let col = colDesde; col <= colHasta; col += 1) {
          celdas.push(tabla.rows[fila]?.cells[col]?.textContent ?? "");
        }
        lineas.push(celdas.join("\t"));
      }
      evento.preventDefault();
      evento.clipboardData.setData("text/plain", lineas.join("\n"));
    };

    const afuera = (evento) => {
      if (arrastrando.current) return;
      if (tabla.contains(evento.target)) return;
      if (!rango.current) return;
      rango.current = null;
      tabla.dataset.seleccionMovida = "0";
      pintar();
    };

    tabla.addEventListener("mousedown", alBajar);
    window.addEventListener("mousemove", alMover);
    window.addEventListener("mouseup", alSoltar);
    document.addEventListener("copy", alCopiar);
    document.addEventListener("mousedown", afuera);
    return () => {
      tabla.removeEventListener("mousedown", alBajar);
      window.removeEventListener("mousemove", alMover);
      window.removeEventListener("mouseup", alSoltar);
      document.removeEventListener("copy", alCopiar);
      document.removeEventListener("mousedown", afuera);
    };
  }, []);

  return (
    <table
      ref={ref}
      className={["planilla-columna", className].filter(Boolean).join(" ")}
      style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...style }}
    >
      {children}
    </table>
  );
}
