import "./lib/polyfills";
import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";

import { ReactRuntimeRecoveryBoundary, handleRuntimeError, handleVitePreloadError } from "./lib/lazy-retry";
import { installTouchDragShim } from "./lib/touch-drag-shim";
import { installSafeAreaObserver } from "./lib/safe-area";
import { installWeChatCompat } from "./lib/wechat-compat";
import { isStudentScanRoute } from "./lib/student-route";

window.addEventListener("vite:preloadError", handleVitePreloadError);
window.addEventListener("error", handleRuntimeError);
window.addEventListener("unhandledrejection", handleRuntimeError);

installTouchDragShim();
installSafeAreaObserver();
installWeChatCompat();

const rootElement = document.getElementById("root");

// 学生扫码签到页走精简应用，只下载签到所需代码；其余页面加载完整应用。
const loadApp = (): Promise<{ default: ComponentType }> =>
  isStudentScanRoute() ? import("./StudentApp") : import("./App.tsx");

function boot(attempt: number) {
  loadApp().then(
    ({ default: Root }) => {
      if (!rootElement) return;
      (window as unknown as { __TM_APP_MOUNTED__?: boolean }).__TM_APP_MOUNTED__ = true;
      createRoot(rootElement).render(
        <ReactRuntimeRecoveryBoundary>
          <Root />
        </ReactRuntimeRecoveryBoundary>,
      );
    },
    () => {
      if (attempt < 3) setTimeout(() => boot(attempt + 1), 1500 * (attempt + 1));
      else (window as unknown as { __TM_BOOT_FAIL__?: (m: string) => void }).__TM_BOOT_FAIL__?.("页面资源加载失败（网络不稳定）。");
    },
  );
}

if (rootElement) boot(0);
