import { useEffect, useState } from "react";

// useState que se conserva en sessionStorage al navegar entre paginas.
export function useEstadoPersistente(clave, inicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(clave);
      if (guardado != null) {
        const leido = JSON.parse(guardado);
        if (inicial && typeof inicial === "object" && !Array.isArray(inicial)) return { ...inicial, ...leido };
        return leido;
      }
    } catch {
      // storage no disponible o dato corrupto
    }
    return inicial;
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      // ignorar
    }
  }, [clave, valor]);
  return [valor, setValor];
}
