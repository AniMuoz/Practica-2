import { useState } from "react";

export const PANELES = [
  "carga",
  "formulario",
  "bodega",
  "inventario",
  "gastos",
  "movimientos",
  "detallado",
  "reserva",
  "contratistas",
  "bitacora",
  "ventas",
];

const TODOS_CERRADOS = Object.fromEntries(PANELES.map((nombre) => [nombre, false]));

// Que paneles de Admin estan abiertos. Puede haber varios a la vez (carga y formulario van juntos).
export function usePaneles() {
  const [abierto, setAbierto] = useState(TODOS_CERRADOS);

  // Abre o cierra un panel.
  function fijar(nombre, valor) {
    setAbierto((actual) => (actual[nombre] === valor ? actual : { ...actual, [nombre]: valor }));
  }

  // Cierra todos los paneles que no esten en `permitidos`.
  function cerrarOtros(permitidos) {
    const ok = new Set(permitidos);
    setAbierto((actual) => {
      const siguiente = {};
      let cambio = false;
      for (const nombre of PANELES) {
        siguiente[nombre] = ok.has(nombre) ? actual[nombre] : false;
        if (siguiente[nombre] !== actual[nombre]) cambio = true;
      }
      return cambio ? siguiente : actual;
    });
  }

  return { abierto, fijar, cerrarOtros };
}
