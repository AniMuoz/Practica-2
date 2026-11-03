import { useState } from "react";
import { obtenerJson } from "../../api.js";

const VACIA = { columnas: [], filas: [] };

// Una planilla de solo lectura del panel de admin: datos, spinner y aviso de error.
// `recargar` devuelve la promesa; en modo `silencioso` (refresco por SSE) no muestra el spinner.
export function useCargaPlanilla(url, mensajeError) {
  const [tabla, setTabla] = useState(VACIA);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  function recargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    setAviso("");
    return obtenerJson(url, mensajeError)
      .then((data) => {
        setTabla({ columnas: data.columnas || [], filas: data.filas || [], marcados: data.marcados || [] });
      })
      .catch((err) => setAviso(err.message))
      .finally(() => setCargando(false));
  }

  return { tabla, setTabla, cargando, aviso, recargar };
}
