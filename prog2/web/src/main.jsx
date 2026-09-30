import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Admin from "./Admin.jsx";
import App from "./App.jsx";
import Detalle from "./Detalle.jsx";

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
