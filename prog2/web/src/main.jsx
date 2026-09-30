import { StrictMode } from "react";
import logo from "../logo/logo.ico";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Admin from "./Admin.jsx";
import App from "./App.jsx";
import Detalle from "./Detalle.jsx";
import "./movil.css";

const icono = document.createElement("link");
icono.rel = "icon";
icono.href = logo;
document.head.appendChild(icono);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/:codigo" element={<Detalle />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
