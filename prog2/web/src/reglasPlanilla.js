export function textoCampo(valor) {
  return valor == null ? "" : String(valor);
}

export function colorInventario(columna, fila) {
  if (columna !== "Inventario" && columna !== "Comentario") return undefined;
  if (String(fila.Comentario ?? "").trim() !== "") return "#EFA94A";
  const inventario = String(fila.Inventario ?? "").trim();
  if (inventario === "") return undefined;
  const stock = String(fila.Stock ?? "").trim();
  const iguales =
    stock !== "" &&
    inventario !== "" &&
    Number(stock) === Number(inventario) &&
    Number.isFinite(Number(stock)) &&
    Number.isFinite(Number(inventario));
  return iguales ? "#5DBB63" : "#FF0000";
}

export function colorCelda(columna, fila, oscuro) {
  if (columna === "Stock" && String(fila.Marcado) === "1") return "#88DC65";
  if (columna === "Inventario" || columna === "Comentario") return colorInventario(columna, fila);
  const textoCritico = String(fila["Stock critico"] ?? "").trim();
  if (textoCritico === "") return undefined;
  const critico = Number(textoCritico);
  const stock = Number(String(fila.Stock ?? "").trim());
  if (Number.isFinite(critico) && Number.isFinite(stock) && critico >= stock) return oscuro ? "#A711D0" : "#FFFF00";
  return undefined;
}

export function estadoInventario(fila) {
  if (!fila) return null;
  if (String(fila.Comentario ?? "").trim() !== "") {
    return { color: "#EFA94A", texto: "Hay comentario" };
  }
  const inventarioFila = String(fila.Inventario ?? "").trim();
  if (inventarioFila === "") return null;
  const stock = String(fila.Stock ?? "").trim();
  const iguales =
    stock !== "" &&
    Number(stock) === Number(inventarioFila) &&
    Number.isFinite(Number(stock)) &&
    Number.isFinite(Number(inventarioFila));
  return iguales
    ? { color: "#5DBB63", texto: "Inventario igual al stock" }
    : { color: "#FF0000", texto: "Inventario distinto al stock" };
}

export function bodegasDe(filas) {
  const valores = new Set(
    filas
      .map((fila) => String(fila["Ubicación"] ?? "").trim().slice(0, 2))
      .filter((valor) => valor.length === 2)
  );
  return [...valores].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export function subUbicacionesDe(filas, bodega) {
  const origen = bodega
    ? filas.filter((fila) => String(fila["Ubicación"] ?? "").trim().slice(0, 2) === bodega)
    : filas;
  const valores = new Set(
    origen.map((fila) => String(fila["Sub-ubicación"] ?? "").trim()).filter(Boolean)
  );
  return [...valores].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export function filtrarFilas(filas, filtros) {
  const {
    orden = "",
    bodega = "",
    subUbicacion = "",
    stockMinimo = "",
    soloConPrecio = false,
    soloConUbicacion = false,
    soloStockCritico = false,
    soloInventarioOComentario = false,
    soloMarcados = false,
    ignorarNulo = false,
    texto = "",
  } = filtros;
  let lista = filas.filter((fila) => String(fila.Stock ?? "").trim() !== "");
  if (ignorarNulo) {
    lista = lista.filter((fila) => String(fila.Descripcion ?? "").trim().toUpperCase() !== "NULO");
  }
  if (bodega) {
    lista = lista.filter((fila) => String(fila["Ubicación"] ?? "").trim().slice(0, 2) === bodega);
  }
  if (subUbicacion) {
    lista = lista.filter((fila) => String(fila["Sub-ubicación"] ?? "").trim() === subUbicacion);
  }
  if (String(stockMinimo).trim() !== "") {
    const minimo = Number(stockMinimo);
    lista = lista.filter((fila) => {
      const stock = Number(String(fila.Stock ?? "").trim());
      return Number.isFinite(stock) && stock >= minimo;
    });
  }
  if (soloConPrecio) {
    lista = lista.filter((fila) => String(fila.Precio ?? "").trim() !== "");
  }
  if (soloConUbicacion) {
    lista = lista.filter((fila) => String(fila["Ubicación"] ?? "").trim() !== "");
  }
  if (soloStockCritico) {
    lista = lista.filter((fila) => {
      const textoCritico = String(fila["Stock critico"] ?? "").trim();
      if (textoCritico === "") return false;
      const critico = Number(textoCritico);
      const stock = Number(String(fila.Stock ?? "").trim());
      return Number.isFinite(critico) && Number.isFinite(stock) && stock <= critico;
    });
  }
  if (soloInventarioOComentario) {
    lista = lista.filter((fila) => {
      const inventario = String(fila.Inventario ?? "").trim();
      const comentario = String(fila.Comentario ?? "").trim();
      return inventario !== "" || comentario !== "";
    });
  }
  if (soloMarcados) {
    lista = lista.filter((fila) => String(fila.Marcado) === "1");
  }
  const consulta = normalizarBusqueda(texto);
  if (consulta.length >= 2) {
    lista = lista.filter((fila) => {
      const codigo = normalizarBusqueda(fila.Codigo);
      const descripcion = normalizarBusqueda(fila.Descripcion);
      return codigo.includes(consulta) || descripcion.includes(consulta);
    });
  }
  if (orden === "codigo" || orden === "codigo-asc") {
    const sentido = orden === "codigo" ? -1 : 1;
    lista = [...lista].sort((a, b) => {
      const na = Number(a.Codigo);
      const nb = Number(b.Codigo);
      const comparado = Number.isFinite(na) && Number.isFinite(nb)
        ? na - nb
        : String(a.Codigo).localeCompare(String(b.Codigo), "es", { numeric: true });
      return comparado * sentido;
    });
  } else if (orden === "descripcion" || orden === "descripcion-desc") {
    const sentido = orden === "descripcion" ? 1 : -1;
    lista = [...lista].sort((a, b) =>
      String(a.Descripcion ?? "").localeCompare(String(b.Descripcion ?? ""), "es", { sensitivity: "base" }) * sentido
    );
  }
  return lista;
}

export function consultaExcel(filtros) {
  const params = new URLSearchParams();
  if (!filtros.colores) params.set("colores", "0");
  if (filtros.orden) params.set("orden", filtros.orden);
  if (filtros.bodega) params.set("bodega", filtros.bodega);
  if (filtros.subUbicacion) params.set("subUbicacion", filtros.subUbicacion);
  if (String(filtros.stockMinimo ?? "").trim() !== "") params.set("stockMinimo", String(filtros.stockMinimo).trim());
  if (filtros.soloConPrecio) params.set("precio", "1");
  if (filtros.soloConUbicacion) params.set("ubicacion", "1");
  if (filtros.soloStockCritico) params.set("critico", "1");
  if (filtros.soloInventarioOComentario) params.set("inventario", "1");
  if (filtros.soloMarcados) params.set("marcado", "1");
  if (filtros.ignorarNulo) params.set("ignorarNulo", "1");
  if (String(filtros.texto ?? "").trim().length >= 2) params.set("q", String(filtros.texto).trim());
  const consulta = params.toString();
  return consulta ? `/api/tabla/excel?${consulta}` : "/api/tabla/excel";
}

export function aplicarFilaRecibida(actuales, data) {
  const codigoNuevo = String(data.fila.Codigo);
  const codigoAnterior = data.codigoAnterior ? String(data.codigoAnterior) : codigoNuevo;
  const indice = actuales.findIndex((fila) => String(fila.Codigo) === codigoAnterior);
  if (indice < 0) return [...actuales, data.fila];
  const copia = actuales.slice();
  copia[indice] = data.fila;
  if (codigoAnterior !== codigoNuevo) {
    return copia.filter((fila, posicion) => posicion === indice || String(fila.Codigo) !== codigoNuevo);
  }
  return copia;
}

export function normalizarBusqueda(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function rangoPagina(pagina, tamano, total) {
  if (total === 0) return "0 de 0";
  return `${pagina * tamano + 1}–${Math.min((pagina + 1) * tamano, total)} de ${total}`;
}

export function columnasSinImagen(columnas) {
  return columnas.filter((columna) => !["Rombo", "QR", "Foto"].includes(columna));
}

export function rutaExcel(ruta, colores) {
  return colores ? ruta : `${ruta}${ruta.includes("?") ? "&" : "?"}colores=0`;
}

export function rutaExcelInventario(ruta, colores, copiarInventario, copiarExistencia) {
  const base = rutaExcel(ruta, colores);
  const extra = copiarInventario ? "inventario=1" : copiarExistencia ? "existencia=1" : "";
  if (!extra) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${extra}`;
}

export function filasInventarioVisibles(filas, copiarInventario, copiarExistencia) {
  return filas.map((fila) => {
    const copia = fila.slice(0, 6);
    if (copiarInventario) copia[5] = fila[6] ?? "";
    else if (copiarExistencia) copia[5] = fila[4];
    return copia;
  });
}

export function colorLibre(valor) {
  if (valor === 0 || valor === "0") return "#d3d3d3";
  if (valor === "          ") return "#f9e37c";
  return "#73c883";
}

export function colorCantidad(valor) {
  if (valor === 0 || valor === "0") return "#d3d3d3";
  if (valor == null || valor === "" || valor === "          ") return "#f9e37c";
  return "#73c883";
}

export function colorStockDetallado(columna, valor, marcado) {
  const coloreada = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(columna);
  const marcada = Boolean(marcado) && [3, 6, 7, 8, 9, 10].includes(columna);
  if (marcada) return "#00FF00";
  if (!coloreada) return "var(--superficie)";
  if (valor === 0 || valor === "0") return "#d3d3d3";
  if (valor == null || valor === "" || valor === "          " || valor === "Sin precio") return "#f9e37c";
  return "#73c883";
}

export function validarContratistas(filas) {
  const sinNombre = filas.findIndex((fila) => !String(fila.nombre ?? "").trim());
  if (sinNombre !== -1) return `La fila ${sinNombre + 1} necesita un nombre.`;
  const ids = new Set();
  for (const fila of filas) {
    const id = String(fila.id ?? "").trim();
    if (ids.has(id)) return `El id ${id} está repetido.`;
    ids.add(id);
  }
  return "";
}

export function claveUltimaCarga(modo, columna) {
  return modo === "dos-columnas" && columna ? `dos-columnas:${columna}` : modo;
}
