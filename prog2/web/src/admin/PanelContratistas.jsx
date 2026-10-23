import Planilla from "../Planilla.jsx";
import { validarContratistas } from "../reglasPlanilla.js";

// Editor de la lista de contratistas. El estado vive en Admin; este componente solo dibuja y edita filas.
export default function PanelContratistas({
  contratistas,
  setContratistas,
  cargando,
  guardando,
  aviso,
  setAviso,
  alPedirConfirmacion,
  colores,
  clasePlanilla,
}) {
  return (
    <section
      style={{
        background: "var(--superficie)",
        borderRadius: 8,
        padding: 16,
        margin: "0 auto 16px",
        maxWidth: 640,
        width: "100%",
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 18, textAlign: "center" }}>Contratistas</h2>
      {cargando && <p style={{ margin: 0 }}>Cargando contratistas...</p>}
      {aviso && <p style={{ margin: "0 0 12px" }}>{aviso}</p>}
      {!cargando && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const errorContratistas = validarContratistas(contratistas);
            if (errorContratistas) {
              setAviso(errorContratistas);
              return;
            }
            setAviso("");
            alPedirConfirmacion();
          }}
        >
          <Planilla className={clasePlanilla}>
            <thead>
              <tr>
                {["id", "Nombre", ""].map((columna) => (
                  <th
                    key={columna || "accion"}
                    style={{
                      position: "sticky",
                      top: 0,
                      textAlign: "left",
                      padding: "8px 10px",
                      background: colores ? "#a9e5e5" : "var(--superficie)",
                      border: "1px solid var(--borde)",
                    }}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contratistas.map((fila, indice) => (
                <tr key={indice}>
                  <td style={{ padding: 6, border: "1px solid var(--borde-suave)" }}>
                    <input
                      value={fila.id}
                      inputMode="numeric"
                      onChange={(event) => {
                        const valor = event.target.value;
                        if (valor !== "" && !/^\d+$/.test(valor)) return;
                        setContratistas((actual) => actual.map((item, i) => (i === indice ? { ...item, id: valor } : item)));
                      }}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                    />
                  </td>
                  <td style={{ padding: 6, border: "1px solid var(--borde-suave)" }}>
                    <input
                      value={fila.nombre}
                      onChange={(event) => {
                        const valor = event.target.value;
                        setContratistas((actual) => actual.map((item, i) => (i === indice ? { ...item, nombre: valor } : item)));
                      }}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                    />
                  </td>
                  <td style={{ padding: 6, border: "1px solid var(--borde-suave)" }}>
                    <button
                      type="button"
                      onClick={() => setContratistas((actual) => actual.filter((_, i) => i !== indice))}
                      style={{ padding: "8px 10px", border: 0, borderRadius: 6, background: "var(--peligro)", color: "var(--sobre)", cursor: "pointer" }}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Planilla>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => {
                const siguiente = contratistas.reduce((maximo, fila) => Math.max(maximo, Number(fila.id) || 0), 0) + 1;
                setContratistas((actual) => [...actual, { id: String(siguiente), nombre: "" }]);
              }}
              style={{ padding: "8px 14px", border: "1px solid var(--borde)", borderRadius: 6, background: "var(--superficie)", cursor: "pointer" }}
            >
              Agregar
            </button>
            <button
              type="submit"
              disabled={guardando}
              style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer" }}
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
