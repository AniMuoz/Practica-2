import { StrictMode } from "react";
import logo from "../logo/logo.ico";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import Admin from "./Admin.jsx";
import App from "./App.jsx";
import { ColoresPlanillaProvider } from "./ColoresPlanilla.jsx";
import Detalle from "./Detalle.jsx";
import { Recorrido } from "./Recorrido.jsx";
import "./movil.css";

if (localStorage.getItem("modoOscuro") === "1") {
  document.documentElement.classList.add("oscuro");
}

const icono = document.createElement("link");
icono.rel = "icon";
icono.href = logo;
document.head.appendChild(icono);

function Marco() {
  return (
    <ColoresPlanillaProvider>
      <Outlet />
      <Recorrido />
    </ColoresPlanillaProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Marco />,
    children: [
      { path: "/", element: <App /> },
      { path: "/admin", element: <Admin /> },
      { path: "/:codigo", element: <Detalle /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
