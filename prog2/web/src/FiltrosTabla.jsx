import { bodegasDe, subUbicacionesDe } from "./reglasPlanilla.js";

const campo = { padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 };

const CHECKS = [
  ["soloConPrecio", "Solo materiales con precio"],
  ["soloConUbicacion", "Solo materiales con ubicación"],
  ["soloStockCritico", "Solo stock crítico"],
  ["soloStockCero", "Solo stock igual a 0"],
  ["soloInventarioOComentario", "Solo con inventario o comentario"],
  ["soloMarcados", "Solo materiales marcados"],
  ["ignorarNulo", "Ignorar materiales NULO"],
];

// Mismos filtros que la tabla principal (ver filtrarFilas en reglasPlanilla.js).
export default function FiltrosTabla({ filas, filtros, onChange }) {
  const poner = (clave, valor) => onChange({ ...filtros, [clave]: valor });
  const bodegas = bodegasDe(filas);
  const subUbicaciones = subUbicacionesDe(filas, filtros.bodega);
  return (
    <div className="filtros-panel">
      <div className="filtros-col filtros-campos">
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Bodega
          <select value={filtros.bodega} onChange={(e) => poner("bodega", e.target.value)} style={campo}>
            <option value="">Todas</option>
            {bodegas.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Sub-ubicación
          <select value={filtros.subUbicacion} onChange={(e) => poner("subUbicacion", e.target.value)} style={campo}>
            <option value="">Todas</option>
            {subUbicaciones.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Stock igual o mayor a
          <input
            inputMode="decimal"
            value={filtros.stockMinimo}
            placeholder="Cualquier stock"
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^-?\d*\.?\d*$/.test(v)) poner("stockMinimo", v);
            }}
            style={campo}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Buscar código o descripción
          <input value={filtros.texto} onChange={(e) => poner("texto", e.target.value)} style={campo} />
        </label>
      </div>
      <div className="filtros-col">
        {CHECKS.map(([clave, texto]) => (
          <label key={clave} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={filtros[clave]} onChange={(e) => poner(clave, e.target.checked)} />
            {texto}
          </label>
        ))}
      </div>
    </div>
  );
}

export const FILTROS_INICIALES = {
  orden: "codigo-asc",
  bodega: "",
  subUbicacion: "",
  stockMinimo: "",
  soloConPrecio: false,
  soloConUbicacion: false,
  soloStockCritico: false,
  soloStockCero: false,
  soloInventarioOComentario: false,
  soloMarcados: false,
  ignorarNulo: true,
  texto: "",
};
