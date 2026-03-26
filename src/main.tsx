import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { handleVitePreloadError } from "./lib/lazy-retry";

window.addEventListener("vite:preloadError", handleVitePreloadError);

createRoot(document.getElementById("root")!).render(<App />);
