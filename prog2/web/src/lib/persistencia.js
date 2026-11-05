import { useEffect, useState } from "react";

const PREFIJO = "admin:";

function mismoTipo(leido, inicial) {
  if (inicial === null || leido === null) return true;
  if (Array.isArray(inicial) !== Array.isArray(leido)) return false;
  return typeof leido === typeof inicial;
}

// useState que se conserva en sessionStorage al navegar entre paginas.
// Si lo guardado no tiene la forma del valor inicial (dato viejo o corrupto) se ignora.
// Los objetos se fusionan con el inicial para tolerar campos nuevos; arreglos y escalares se reemplazan.
export function useEstadoPersistente(clave, inicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(clave);
      if (guardado != null) {
        const leido = JSON.parse(guardado);
        if (!mismoTipo(leido, inicial)) return inicial;
        if (inicial && leido && typeof inicial === "object" && !Array.isArray(inicial)) return { ...inicial, ...leido };
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
      // sin cuota o storage bloqueado: se sigue funcionando sin persistir
    }
  }, [clave, valor]);
  return [valor, setValor];
}

// Borra todos los borradores de Admin (al cerrar sesion, para que no los vea otro usuario).
export function limpiarBorradores() {
  try {
    Object.keys(sessionStorage)
      .filter((clave) => clave.startsWith(PREFIJO))
      .forEach((clave) => sessionStorage.removeItem(clave));
  } catch {
    // ignorar
  }
}
