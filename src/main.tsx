import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installDevPreviewShimIfNeeded } from "./lib/devPreviewShim";
import "./styles/global.css";

if (import.meta.env.DEV) installDevPreviewShimIfNeeded();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
