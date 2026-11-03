import { useEffect, useState } from "react";
import FiltrosTabla, { FILTROS_INICIALES } from "../../../componentes/FiltrosTabla.jsx";
import { obtenerJson } from "../../../lib/api.js";
import {
  filasInventarioVisibles,
  filtrarFilas,
  numerarFilas,
  pasaFiltrosFilaMovimiento,
  POSICIONES_MOVIMIENTOS,
} from "../../../lib/reglasPlanilla.js";
import { filtrarYOrdenarPorCodigo } from "../utilidades.js";

// Filtros comunes de los paneles de stock y las filas ya filtradas y ordenadas de cada uno.
// `activo` indica si hay que leer el maestro de materiales (autorizado y con algun panel de stock abierto).
export function useFiltrosStock({ activo, detallado, inventario, movimientos, copiarInventario, copiarExistencia }) {
  const [filtrosStock, setFiltrosStock] = useState(FILTROS_INICIALES);
  const [filasMaestro, setFilasMaestro] = useState([]);
  useEffect(() => {
    if (!activo) return;
    obtenerJson("/api/tabla")
      .then((data) => setFilasMaestro(data.filas || []))
      .catch(() => {});
  }, [activo]);
  const filasMaestroFiltradas = filtrarFilas(filasMaestro, filtrosStock);
  const codigosFiltrados = new Set(filasMaestroFiltradas.map((f) => String(f.Codigo)));
  const ordenCodigos = new Map(filasMaestroFiltradas.map((f, i) => [String(f.Codigo), i]));
  const aplicarFiltrosStock = (filas, indiceCodigo, marcados) =>
    filtrarYOrdenarPorCodigo(filas, indiceCodigo, marcados, codigosFiltrados, ordenCodigos);
  const detalladoFiltrado = aplicarFiltrosStock(detallado.filas, 1, detallado.marcados);
  const [verFiltrosStock, setVerFiltrosStock] = useState(true);
  const estiloBotonFiltro = {
    padding: "8px 14px",
    border: 0,
    borderRadius: 6,
    background: "var(--boton)",
    color: "var(--sobre)",
    fontSize: 14,
    cursor: "pointer",
  };
  const crearPanelFiltros = (conOrdenUbicacion) => (
    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          type="button"
          style={estiloBotonFiltro}
          onClick={() => setVerFiltrosStock((v) => !v)}
        >
          {verFiltrosStock ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
        <button
          type="button"
          style={estiloBotonFiltro}
          onClick={() => setFiltrosStock(FILTROS_INICIALES)}
        >
          Limpiar filtros
        </button>
      </div>
      {verFiltrosStock && (
        <FiltrosTabla centrado conOrdenUbicacion={conOrdenUbicacion} filas={filasMaestro} filtros={filtrosStock} onChange={setFiltrosStock} />
      )}
    </div>
  );
  const panelFiltros = crearPanelFiltros(false);
  const panelFiltrosUbicacion = crearPanelFiltros(true);
  const filasInventario = aplicarFiltrosStock(
    filasInventarioVisibles(inventario.filas, copiarInventario, copiarExistencia),
    0
  ).filas;
  // Códigos fuera del maestro no se ocultan solo por eso (si no, al editar parecen borrarse),
  // pero sí respetan bodega / texto / checks del panel de filtros.
  const codigosEnMaestro = new Set(filasMaestro.map((f) => String(f.Codigo)));
  const filasMovimientosFiltradas = movimientos.filas.filter((fila) => {
    const codigo = String(fila[1]);
    if (codigosEnMaestro.has(codigo)) return codigosFiltrados.has(codigo);
    return pasaFiltrosFilaMovimiento(fila, filtrosStock);
  });
  const filasMovimientosVisibles = filasInventarioVisibles(
    filasMovimientosFiltradas,
    copiarInventario,
    copiarExistencia,
    POSICIONES_MOVIMIENTOS
  );
  const filasMovimientos = numerarFilas(
    // Sin orden elegido se conserva el del archivo cargado; con uno elegido manda el de los filtros.
    filtrosStock.orden
      ? [...filasMovimientosVisibles].sort((a, b) => {
          const ordenA = ordenCodigos.get(String(a[1]));
          const ordenB = ordenCodigos.get(String(b[1]));
          if (ordenA == null && ordenB == null) return 0;
          if (ordenA == null) return 1;
          if (ordenB == null) return -1;
          return ordenA - ordenB;
        })
      : filasMovimientosVisibles
  );
  return {
    filtrosStock,
    panelFiltros,
    panelFiltrosUbicacion,
    codigosFiltrados,
    ordenCodigos,
    aplicarFiltrosStock,
    detalladoFiltrado,
    filasInventario,
    filasMovimientos,
  };
}
