import { useState } from "react";
import { enviarJson } from "../../../lib/api.js";

function clavePendiente(codigo, indiceColumna) {
  return `${String(codigo)}\t${indiceColumna}`;
}

// Edicion del stock detallado: cambios locales pendientes hasta "Guardar",
// pegado masivo desde Excel y limpieza de columnas.
// Recibe la tabla y su setter (de useCargaPlanilla), los codigos visibles segun los filtros y las
// funciones de useRefrescoSse para que el SSE no recargue la planilla a mitad de un guardado.
export function useDetallado({ clave, detallado, setDetallado, codigosFiltrados, ordenCodigos, suspenderRefresco, reanudarRefresco }) {
  const [errorDetallado, setErrorDetallado] = useState("");
  const [pendientes, setPendientes] = useState(() => new Map());
  const [guardandoDetallado, setGuardandoDetallado] = useState(false);

  function registrarCambio(codigo, indiceColumna, nombreColumna, valorNuevo, valorAntes) {
    setPendientes((prev) => {
      const key = clavePendiente(codigo, indiceColumna);
      const next = new Map(prev);
      const original = next.has(key)
        ? next.get(key).original
        : (valorAntes == null ? "" : String(valorAntes));
      if (String(valorNuevo ?? "") === original) {
        next.delete(key);
      } else {
        next.set(key, {
          codigo: String(codigo ?? "").trim(),
          indiceColumna,
          nombreColumna,
          valor: valorNuevo,
          original,
        });
      }
      return next;
    });
  }

  function actualizarCeldaDetallado(codigo, indiceColumna, nombreColumna, valor) {
    const fila = detallado.filas.find((f) => String(f[1]) === String(codigo));
    const antes = fila?.[indiceColumna] == null ? "" : String(fila[indiceColumna]);
    setDetallado((prev) => ({
      ...prev,
      filas: prev.filas.map((filaActual) => {
        if (String(filaActual[1]) !== String(codigo)) return filaActual;
        const copia = filaActual.slice();
        copia[indiceColumna] = valor;
        return copia;
      }),
    }));
    registrarCambio(codigo, indiceColumna, nombreColumna, valor, antes);
  }

  // Pega una columna copiada de Excel: reparte los valores hacia abajo desde la fila visible actual.
  // Devuelve el primer valor aplicado (string) si manejó el pegado, o null si debe usarse el pegado normal.
  function pegarColumnaDetallado(indiceFila, indiceColumna, nombreColumna, texto) {
    const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
    if (lineas[lineas.length - 1] === "") lineas.pop();
    if (lineas.length < 2) return null;
    if (lineas.length > 500) {
      setErrorDetallado("Se pueden pegar hasta 500 filas a la vez.");
      return false;
    }

    // Pares con índice original en detallado.filas para no pisar filas por código duplicado.
    const paresVisibles = detallado.filas
      .map((fila, indice) => ({ fila, indice }))
      .filter(({ fila }) => codigosFiltrados.has(String(fila[1])))
      .sort(
        (a, b) =>
          (ordenCodigos.get(String(a.fila[1])) ?? 0) - (ordenCodigos.get(String(b.fila[1])) ?? 0)
      );

    const actualizaciones = [];
    for (let i = 0; i < lineas.length; i += 1) {
      const par = paresVisibles[indiceFila + i];
      if (!par) break;
      actualizaciones.push({
        indice: par.indice,
        codigo: par.fila[1],
        valor: lineas[i].split("\t")[0].trim(),
        anterior: par.fila[indiceColumna] == null ? "" : String(par.fila[indiceColumna]),
      });
    }
    if (actualizaciones.length === 0) return null;

    const porIndice = new Map(actualizaciones.map((item) => [item.indice, item.valor]));
    setDetallado((prev) => ({
      ...prev,
      filas: prev.filas.map((fila, indice) => {
        if (!porIndice.has(indice)) return fila;
        const copia = fila.slice();
        copia[indiceColumna] = porIndice.get(indice);
        return copia;
      }),
    }));

    for (const item of actualizaciones) {
      registrarCambio(item.codigo, indiceColumna, nombreColumna, item.valor, item.anterior);
    }

    return actualizaciones[0].valor;
  }

  async function guardarCambiosDetallado() {
    if (pendientes.size === 0 || guardandoDetallado) return;
    setErrorDetallado("");
    setGuardandoDetallado(true);
    suspenderRefresco();
    const lista = [...pendientes.values()];
    const fallidos = [];
    try {
      for (const item of lista) {
        try {
          await enviarJson(
            "/api/stock-detallado",
            { clave, codigo: item.codigo, datos: { [item.nombreColumna]: item.valor } },
            "No se pudo guardar el campo.",
            "PUT"
          );
          setPendientes((prev) => {
            const next = new Map(prev);
            next.delete(clavePendiente(item.codigo, item.indiceColumna));
            return next;
          });
        } catch (err) {
          fallidos.push({ ...item, error: err });
        }
      }
      if (fallidos.length > 0) {
        const revertir = new Map(fallidos.map((item) => [clavePendiente(item.codigo, item.indiceColumna), item]));
        setDetallado((prev) => ({
          ...prev,
          filas: prev.filas.map((fila) => {
            let copia = null;
            for (const item of fallidos) {
              if (String(fila[1]) !== String(item.codigo)) continue;
              if (!copia) copia = fila.slice();
              copia[item.indiceColumna] = item.original;
            }
            return copia || fila;
          }),
        }));
        setPendientes((prev) => {
          const next = new Map(prev);
          for (const key of revertir.keys()) next.delete(key);
          return next;
        });
        setErrorDetallado(fallidos[0].error?.message || "No se pudo guardar el campo.");
      }
    } finally {
      setGuardandoDetallado(false);
      reanudarRefresco();
    }
  }

  function descartarCambiosDetallado() {
    if (pendientes.size === 0) return;
    const lista = [...pendientes.values()];
    setDetallado((prev) => ({
      ...prev,
      filas: prev.filas.map((fila) => {
        let copia = null;
        for (const item of lista) {
          if (String(fila[1]) !== String(item.codigo)) continue;
          if (!copia) copia = fila.slice();
          copia[item.indiceColumna] = item.original;
        }
        return copia || fila;
      }),
    }));
    setPendientes(new Map());
    setErrorDetallado("");
  }

  function limpiarColumnaDetallado(nombreColumna, indiceColumna) {
    if (!window.confirm(`¿Limpiar todos los datos de la columna "${nombreColumna}"?`)) return;
    setErrorDetallado("");
    enviarJson(
      "/api/stock-detallado/columna",
      { clave, columna: nombreColumna },
      "No se pudo limpiar la columna.",
      "DELETE"
    )
      .then(() => {
        setDetallado((prev) => ({
          ...prev,
          filas: prev.filas.map((fila) => {
            const copia = fila.slice();
            copia[indiceColumna] = "";
            return copia;
          }),
        }));
        setPendientes((prev) => {
          const next = new Map(prev);
          for (const [key, item] of next) {
            if (item.indiceColumna === indiceColumna) next.delete(key);
          }
          return next;
        });
      })
      .catch((err) => setErrorDetallado(err.message));
  }

  return {
    errorDetallado,
    setErrorDetallado,
    pendientesDetallado: pendientes.size,
    guardandoDetallado,
    actualizarCeldaDetallado,
    pegarColumnaDetallado,
    guardarCambiosDetallado,
    descartarCambiosDetallado,
    limpiarColumnaDetallado,
  };
}
