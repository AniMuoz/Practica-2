import { StrictMode } from "react";
import logo from "../logo/logo.ico";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ColoresPlanillaProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/:codigo" element={<Detalle />} />
        </Routes>
        <Recorrido />
      </ColoresPlanillaProvider>
    </BrowserRouter>
  </StrictMode>
);
