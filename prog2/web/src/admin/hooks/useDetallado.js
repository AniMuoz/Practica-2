import { useState } from "react";
import { enviarJson } from "../../api.js";

// Edicion del stock detallado: celdas con guardado optimista (se revierten si el servidor falla),
// pegado masivo desde Excel y limpieza de columnas.
// Recibe la tabla y su setter (de useCargaPlanilla), los codigos visibles segun los filtros y las
// funciones de useRefrescoSse para que el SSE no recargue la planilla a mitad de un pegado.
export function useDetallado({ clave, detallado, setDetallado, codigosFiltrados, ordenCodigos, suspenderRefresco, reanudarRefresco }) {
  const [errorDetallado, setErrorDetallado] = useState("");

  function actualizarCeldaDetallado(codigo, indiceColumna, valor) {
    setDetallado((prev) => ({
      ...prev,
      filas: prev.filas.map((fila) => {
        if (String(fila[1]) !== String(codigo)) return fila;
        const copia = fila.slice();
        copia[indiceColumna] = valor;
        return copia;
      }),
    }));
  }

  function guardarCeldaDetallado(codigo, nombreColumna, indiceColumna, valor, valorOriginal) {
    if (String(valor ?? "") === String(valorOriginal ?? "")) return;
    setErrorDetallado("");
    enviarJson(
      "/api/stock-detallado",
      { clave, codigo: String(codigo ?? "").trim(), datos: { [nombreColumna]: valor } },
      "No se pudo guardar el campo.",
      "PUT"
    ).catch((err) => {
      actualizarCeldaDetallado(codigo, indiceColumna, valorOriginal);
      setErrorDetallado(err.message);
    });
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

    const pendientes = actualizaciones.filter((item) => String(item.valor) !== String(item.anterior));
    if (pendientes.length === 0) return actualizaciones[0].valor;

    setErrorDetallado("");
    // Evita que el SSE recargue la planilla a mitad del pegado (celdas parpadeando).
    suspenderRefresco();

    // Guardado en serie: en paralelo la caché del backend se pisa entre requests.
    (async () => {
      const fallidos = [];
      try {
        for (const item of pendientes) {
          try {
            await enviarJson(
              "/api/stock-detallado",
              { clave, codigo: String(item.codigo ?? "").trim(), datos: { [nombreColumna]: item.valor } },
              "No se pudo guardar el campo.",
              "PUT"
            );
          } catch (err) {
            fallidos.push({ ...item, error: err });
          }
        }
        if (fallidos.length > 0) {
          const revertir = new Map(fallidos.map((item) => [item.indice, item.anterior]));
          setDetallado((prev) => ({
            ...prev,
            filas: prev.filas.map((fila, indice) => {
              if (!revertir.has(indice)) return fila;
              const copia = fila.slice();
              copia[indiceColumna] = revertir.get(indice);
              return copia;
            }),
          }));
          setErrorDetallado(fallidos[0].error?.message || "No se pudo guardar el campo.");
        }
      } finally {
        reanudarRefresco();
      }
    })();

    return actualizaciones[0].valor;
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
      })
      .catch((err) => setErrorDetallado(err.message));
  }

  return {
    errorDetallado,
    setErrorDetallado,
    actualizarCeldaDetallado,
    guardarCeldaDetallado,
    pegarColumnaDetallado,
    limpiarColumnaDetallado,
  };
}
