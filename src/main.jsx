import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import MaintenanceLog from "./MaintenanceLog";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MaintenanceLog />
  </StrictMode>
);
