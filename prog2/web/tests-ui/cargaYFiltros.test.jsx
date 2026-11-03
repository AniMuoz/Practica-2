import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PanelCarga from "../src/admin/paneles/PanelCarga.jsx";
import PanelFormulario from "../src/admin/paneles/PanelFormulario.jsx";
import { useCargaDatos } from "../src/admin/hooks/useCargaDatos.js";
import { useCopiaExistencia } from "../src/admin/hooks/useCopiaExistencia.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("PanelFormulario muestra las columnas, envia y limita Inventario a numeros", () => {
  const alEnviar = vi.fn((e) => e.preventDefault());
  const setDatos = vi.fn();
  render(
    <PanelFormulario
      alEnviar={alEnviar}
      columnas={["Codigo", "Inventario"]}
      datos={{ Codigo: "1", Inventario: "" }}
      setDatos={setDatos}
      guardando={false}
      aviso="listo"
    />
  );
  fireEvent.change(screen.getByLabelText("Inventario"), { target: { value: "abc" } });
  expect(setDatos).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Inventario"), { target: { value: "12" } });
  expect(setDatos).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText("Agregar"));
  expect(alEnviar).toHaveBeenCalledTimes(1);
  expect(screen.getByText("listo")).toBeTruthy();
});

test("PanelCarga cambia de modo y muestra el texto de ultima carga y el aviso", () => {
  const setModoCarga = vi.fn();
  render(
    <PanelCarga
      alEnviar={(e) => e.preventDefault()}
      cargaKey={0}
      modoCarga="dos-columnas"
      setModoCarga={setModoCarga}
      columnaCarga="Precio"
      setColumnaCarga={() => {}}
      columnasDestino={["Precio", "Ubicación"]}
      esMovilCarga={false}
      setArchivosQr={() => {}}
      setArchivo={() => {}}
      importando={false}
      textoUltima="Última carga: ayer"
      avisoCarga="Listo"
    />
  );
  expect(screen.getByLabelText("Columna a llenar")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Tipo de planilla"), { target: { value: "sap" } });
  expect(setModoCarga).toHaveBeenCalledWith("sap");
  expect(screen.getByText("Última carga: ayer")).toBeTruthy();
  expect(screen.getByText("Listo")).toBeTruthy();
});

test("useCargaDatos exige elegir un archivo antes de importar y descarta la seleccion", () => {
  const { result } = renderHook(() =>
    useCargaDatos({ clave: "k", refrescarVistas: vi.fn(), cargarUltimasCargas: vi.fn() })
  );
  act(() => result.current.enviarCarga({ preventDefault() {}, target: { reset() {} } }));
  expect(result.current.avisoCarga).toBe("Elige un archivo .xlsx.");
  const antes = result.current.cargaKey;
  act(() => result.current.setArchivo({ name: "a.xlsx" }));
  expect(result.current.archivo).toBeTruthy();
  act(() => result.current.descartarCarga());
  expect(result.current.archivo).toBeNull();
  expect(result.current.cargaKey).toBe(antes + 1);
});

test("useCargaDatos elige la primera columna destino valida", () => {
  const { result } = renderHook(() =>
    useCargaDatos({ clave: "k", refrescarVistas: vi.fn(), cargarUltimasCargas: vi.fn() })
  );
  act(() => result.current.aplicarDestino(["Precio", "Ubicación"]));
  expect(result.current.columnaCarga).toBe("Precio");
  act(() => result.current.setColumnaCarga("Ubicación"));
  act(() => result.current.aplicarDestino(["Precio", "Ubicación"]));
  expect(result.current.columnaCarga).toBe("Ubicación");
});

test("useCopiaExistencia pide confirmacion y los dos interruptores son excluyentes", () => {
  const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
  const { result } = renderHook(() => useCopiaExistencia());
  act(() => result.current.alternarExistencia());
  expect(result.current.copiarExistencia).toBe(true);
  act(() => result.current.alternarInventario());
  expect(result.current.copiarInventario).toBe(true);
  expect(result.current.copiarExistencia).toBe(false);
  act(() => result.current.alternarInventario());
  expect(result.current.copiarInventario).toBe(false);
  expect(confirmar).toHaveBeenCalledTimes(2);
  confirmar.mockReturnValue(false);
  act(() => result.current.alternarExistencia());
  expect(result.current.copiarExistencia).toBe(false);
});
