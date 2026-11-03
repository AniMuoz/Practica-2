import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import Acceso from "./componentes/Acceso.jsx";
import Admin from "./paginas/Admin.jsx";
import Auditoria from "./paginas/Auditoria.jsx";
import Buzon from "./componentes/Buzon.jsx";
import GeneradorQr from "./paginas/GeneradorQr.jsx";
import Gastos from "./paginas/Gastos.jsx";
import Personal from "./paginas/Personal.jsx";
import App from "./App.jsx";
import { ColoresPlanillaProvider } from "./componentes/ColoresPlanilla.jsx";
import Detalle from "./paginas/Detalle.jsx";
import { Recorrido } from "./componentes/Recorrido.jsx";
import "./estilos/movil.css";

if (localStorage.getItem("modoOscuro") === "1") {
  document.documentElement.classList.add("oscuro");
}

function Marco() {
  return (
    <Acceso>
      <ColoresPlanillaProvider>
        <Outlet />
        <Recorrido />
      </ColoresPlanillaProvider>
    </Acceso>
  );
}

const router = createBrowserRouter([
  {
    element: <Marco />,
    children: [
      { path: "/", element: <App /> },
      { path: "/admin", element: <Admin /> },
      { path: "/personal", element: <Personal /> },
      { path: "/auditoria", element: <Auditoria /> },
      { path: "/qr", element: <GeneradorQr /> },
      { path: "/gastos", element: <Gastos /> },
      { path: "/buzon", element: <Buzon /> },
      { path: "/:codigo", element: <Detalle /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
