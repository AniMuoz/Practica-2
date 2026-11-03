import { useState } from "react";

// Interruptores que eligen de donde sale la columna Existencia (Libre utilizacion o Inventario); son excluyentes.
export function useCopiaExistencia() {
  const [copiarExistencia, setCopiarExistencia] = useState(false);
  const [copiarInventario, setCopiarInventario] = useState(false);

  function alternar(activo, fijarEste, fijarOtro, pregunta) {
    if (activo) {
      fijarEste(false);
      return;
    }
    if (!window.confirm(pregunta)) return;
    fijarOtro(false);
    fijarEste(true);
  }

  const alternarExistencia = () =>
    alternar(
      copiarExistencia,
      setCopiarExistencia,
      setCopiarInventario,
      "¿Quieres poner en la columna Existencia los datos de Libre utilización?"
    );
  const alternarInventario = () =>
    alternar(
      copiarInventario,
      setCopiarInventario,
      setCopiarExistencia,
      "¿Quieres poner en la columna Existencia los datos de la columna Inventario?"
    );

  return { copiarExistencia, copiarInventario, alternarExistencia, alternarInventario };
}
