import { useEffect, useMemo, useState } from "react";
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

// Campos del stock detallado que también usan los filtros del maestro.
const CAMPOS_FILTRO_DESDE_DETALLADO = ["Caracteristica", "Stock critico"];

// Aplica al maestro los valores actuales del detallado (p. ej. tras editar Característica)
// para que el desplegable y el filtrado no queden con los datos del primer cargado.
export function maestroConDetallado(filasMaestro, detallado) {
  const columnas = detallado?.columnas || [];
  const filasDetallado = detallado?.filas || [];
  if (!filasMaestro.length || !filasDetallado.length || !columnas.length) return filasMaestro;

  const indiceCodigo = columnas.indexOf("Código");
  if (indiceCodigo < 0) return filasMaestro;

  const indices = CAMPOS_FILTRO_DESDE_DETALLADO
    .map((nombre) => [nombre, columnas.indexOf(nombre)])
    .filter(([, indice]) => indice >= 0);
  if (!indices.length) return filasMaestro;

  const porCodigo = new Map();
  for (const fila of filasDetallado) {
    const parche = {};
    for (const [nombre, indice] of indices) parche[nombre] = fila[indice] ?? "";
    porCodigo.set(String(fila[indiceCodigo]), parche);
  }

  let huboCambio = false;
  const actualizadas = filasMaestro.map((fila) => {
    const parche = porCodigo.get(String(fila.Codigo));
    if (!parche) return fila;
    for (const nombre of Object.keys(parche)) {
      if (String(fila[nombre] ?? "") !== String(parche[nombre] ?? "")) {
        huboCambio = true;
        return { ...fila, ...parche };
      }
    }
    return fila;
  });
  return huboCambio ? actualizadas : filasMaestro;
}

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
  // El maestro se pide una vez al abrir stock; si se edita Característica/Stock crítico en
  // detallado, hay que reinyectar esos valores para que filtros y opciones se actualicen al vuelo.
  const filasParaFiltros = useMemo(
    () => maestroConDetallado(filasMaestro, detallado),
    [filasMaestro, detallado]
  );
  const filasMaestroFiltradas = filtrarFilas(filasParaFiltros, filtrosStock);
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
        <FiltrosTabla centrado conOrdenUbicacion={conOrdenUbicacion} filas={filasParaFiltros} filtros={filtrosStock} onChange={setFiltrosStock} />
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
  const codigosEnMaestro = new Set(filasParaFiltros.map((f) => String(f.Codigo)));
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
