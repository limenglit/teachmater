import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ReactRuntimeRecoveryBoundary, handleRuntimeError, handleVitePreloadError } from "./lib/lazy-retry";

window.addEventListener("vite:preloadError", handleVitePreloadError);
window.addEventListener("error", handleRuntimeError);
window.addEventListener("unhandledrejection", handleRuntimeError);

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <ReactRuntimeRecoveryBoundary>
      <App />
    </ReactRuntimeRecoveryBoundary>,
  );
}
