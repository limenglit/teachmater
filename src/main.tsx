import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ReactRuntimeRecoveryBoundary, handleRuntimeError, handleVitePreloadError } from "./lib/lazy-retry";
import { installTouchDragShim } from "./lib/touch-drag-shim";
import { installSafeAreaObserver } from "./lib/safe-area";

window.addEventListener("vite:preloadError", handleVitePreloadError);
window.addEventListener("error", handleRuntimeError);
window.addEventListener("unhandledrejection", handleRuntimeError);

installTouchDragShim();
installSafeAreaObserver();


const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <ReactRuntimeRecoveryBoundary>
      <App />
    </ReactRuntimeRecoveryBoundary>,
  );
}
