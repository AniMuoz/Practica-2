import { useState } from "react";
import { obtenerJson } from "../api.js";

// Fechas de la ultima carga por modo/columna (`GET /api/tabla/ultimas-cargas`).
export function useUltimasCargas() {
  const [ultimasCargas, setUltimasCargas] = useState({});

  function cargarUltimasCargas() {
    return obtenerJson("/api/tabla/ultimas-cargas")
      .then((data) => setUltimasCargas(data.cargas || {}))
      .catch(() => {});
  }

  return { ultimasCargas, cargarUltimasCargas };
}
