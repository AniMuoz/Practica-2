import { useEffect, useRef } from "react";

// Llama a `alCerrar` cuando se hace clic fuera del elemento que lleva el ref devuelto.
export function useClickFuera(alCerrar) {
  const ref = useRef(null);
  const ultimo = useRef(alCerrar);
  ultimo.current = alCerrar;
  useEffect(() => {
    function cerrar(event) {
      if (ref.current && !ref.current.contains(event.target)) ultimo.current();
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);
  return ref;
}
