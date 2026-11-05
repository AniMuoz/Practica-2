import { useEffect, useMemo, useRef, useState } from "react";
import { useEstadoPersistente } from "../../../lib/persistencia.js";
import { enviarJson } from "../../../lib/api.js";

function clavePendiente(codigo, indiceColumna) {
  return `${String(codigo)}\t${indiceColumna}`;
}

function aplicarOriginales(filas, items) {
  return filas.map((fila) => {
    let copia = null;
    for (const item of items) {
      if (String(fila[1]) !== String(item.codigo)) continue;
      if (!copia) copia = fila.slice();
      copia[item.indiceColumna] = item.original;
    }
    return copia || fila;
  });
}

function agruparPorCodigo(items) {
  const grupos = new Map();
  for (const item of items) {
    const lista = grupos.get(item.codigo) || [];
    lista.push(item);
    grupos.set(item.codigo, lista);
  }
  return grupos;
}

// Edicion del stock detallado: cambios locales pendientes hasta "Guardar",
// pegado masivo desde Excel y limpieza de columnas.
// Recibe la tabla y su setter (de useCargaPlanilla), los codigos visibles segun los filtros y las
// funciones de useRefrescoSse para que el SSE no recargue mientras hay ediciones sin guardar.
export function useDetallado({ clave, detallado, setDetallado, codigosFiltrados, ordenCodigos, suspenderRefresco, reanudarRefresco }) {
  const [errorDetallado, setErrorDetallado] = useState("");
  // Los cambios pendientes se guardan en sessionStorage (como lista) para sobrevivir a cambiar de pagina.
  const [listaPendientes, setListaPendientes] = useEstadoPersistente("admin:detallado:pendientes", []);
  const pendientes = useMemo(
    () => new Map(listaPendientes.map((item) => [clavePendiente(item.codigo, item.indiceColumna), item])),
    [listaPendientes]
  );
  function setPendientes(valor) {
    setListaPendientes((prev) => {
      const actual = new Map(prev.map((item) => [clavePendiente(item.codigo, item.indiceColumna), item]));
      const siguiente = typeof valor === "function" ? valor(actual) : valor;
      return [...siguiente.values()];
    });
  }
  const [guardandoDetallado, setGuardandoDetallado] = useState(false);

  // Cada vez que la tabla se recarga del servidor, reaplica los cambios pendientes sobre ella.
  // Si el valor del servidor ya no es el original del pendiente (alguien lo cambio), se descarta.
  useEffect(() => {
    const filas = detallado.filas || [];
    if (!filas.length || pendientes.size === 0 || guardandoRef.current) return;
    const aplicar = new Map();
    const descartar = [];
    for (const [key, item] of pendientes) {
      const indice = filas.findIndex((fila) => String(fila[1]) === String(item.codigo));
      if (indice < 0) {
        descartar.push(key);
        continue;
      }
      const actual = filas[indice][item.indiceColumna] == null ? "" : String(filas[indice][item.indiceColumna]);
      if (actual === String(item.valor ?? "")) continue;
      if (actual === item.original) aplicar.set(`${indice}\t${item.indiceColumna}`, item.valor);
      else descartar.push(key);
    }
    if (aplicar.size) {
      setDetallado((prev) => ({
        ...prev,
        filas: prev.filas.map((fila, indice) => {
          let copia = null;
          for (const [clave, valor] of aplicar) {
            const [i, col] = clave.split("\t");
            if (Number(i) !== indice) continue;
            copia = copia || fila.slice();
            copia[Number(col)] = valor;
          }
          return copia || fila;
        }),
      }));
    }
    if (descartar.length) {
      setErrorDetallado(
        `Se descartaron ${descartar.length} cambio(s) sin guardar porque esos datos cambiaron en el servidor.`
      );
      setPendientes((prev) => {
        const next = new Map(prev);
        descartar.forEach((key) => next.delete(key));
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detallado.filas]);
  const guardandoRef = useRef(false);
  const suspendidoPorEdicion = useRef(false);

  // Mientras haya pendientes o se esté guardando, el SSE no debe pisar la grilla local.
  useEffect(() => {
    const bloquear = pendientes.size > 0 || guardandoDetallado;
    if (bloquear) {
      if (!suspendidoPorEdicion.current) {
        suspendidoPorEdicion.current = true;
        suspenderRefresco();
      }
      return;
    }
    if (suspendidoPorEdicion.current) {
      suspendidoPorEdicion.current = false;
      reanudarRefresco();
    }
  }, [pendientes, guardandoDetallado, suspenderRefresco, reanudarRefresco]);

  function registrarCambios(entradas) {
    if (!entradas.length) return;
    setPendientes((prev) => {
      const next = new Map(prev);
      for (const { codigo, indiceColumna, nombreColumna, valorNuevo, valorAntes } of entradas) {
        const key = clavePendiente(codigo, indiceColumna);
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
    registrarCambios([{ codigo, indiceColumna, nombreColumna, valorNuevo: valor, valorAntes: antes }]);
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

    registrarCambios(
      actualizaciones.map((item) => ({
        codigo: item.codigo,
        indiceColumna,
        nombreColumna,
        valorNuevo: item.valor,
        valorAntes: item.anterior,
      }))
    );

    return actualizaciones[0].valor;
  }

  async function guardarCambiosDetallado() {
    if (pendientes.size === 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setErrorDetallado("");
    setGuardandoDetallado(true);
    const lista = [...pendientes.values()];
    const fallidos = [];
    try {
      for (const [codigo, items] of agruparPorCodigo(lista)) {
        const datos = {};
        for (const item of items) datos[item.nombreColumna] = item.valor;
        try {
          await enviarJson(
            "/api/stock-detallado",
            { clave, codigo, datos },
            "No se pudo guardar el campo.",
            "PUT"
          );
          setPendientes((prev) => {
            const next = new Map(prev);
            for (const item of items) next.delete(clavePendiente(item.codigo, item.indiceColumna));
            return next;
          });
        } catch (err) {
          for (const item of items) fallidos.push({ ...item, error: err });
        }
      }
      if (fallidos.length > 0) {
        setDetallado((prev) => ({
          ...prev,
          filas: aplicarOriginales(prev.filas, fallidos),
        }));
        setPendientes((prev) => {
          const next = new Map(prev);
          for (const item of fallidos) next.delete(clavePendiente(item.codigo, item.indiceColumna));
          return next;
        });
        setErrorDetallado(fallidos[0].error?.message || "No se pudo guardar el campo.");
      }
    } finally {
      guardandoRef.current = false;
      setGuardandoDetallado(false);
    }
  }

  function descartarCambiosDetallado() {
    if (pendientes.size === 0) return;
    const lista = [...pendientes.values()];
    setDetallado((prev) => ({
      ...prev,
      filas: aplicarOriginales(prev.filas, lista),
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
            if (item.nombreColumna === nombreColumna || item.indiceColumna === indiceColumna) {
              next.delete(key);
            }
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
