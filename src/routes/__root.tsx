// ported from main.tsx — polyfills and the same-origin backend relay must run before anything else.
import "../lib/polyfills";
import "../lib/backend-proxy";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { BootPlaceholder } from "@/components/boot-placeholder";
import { CRITICAL_CSS, NOMODULE_SCRIPT, SCAN_BOOT_SCRIPT, WATCHDOG_SCRIPT } from "@/lib/boot-scripts";
import {
  ReactRuntimeRecoveryBoundary,
  handleRuntimeError,
  handleVitePreloadError,
  lazyRetry,
} from "@/lib/lazy-retry";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { isStudentScanRoute } from "@/lib/student-route";
import { installWeChatCompat } from "@/lib/wechat-compat";

const TITLE = "教创搭子 | TeacherMate — 教师智能教学辅助平台";
const DESCRIPTION =
  "教创搭子（TeacherMate）是面向教师的智能教学辅助平台，集成随机点名、座位编排、小组管理、互动签到、白板协作、AI 测验生成、PPT/分镜辅助等课堂工具，提升课堂参与与教学效率。";
const SOCIAL_DESCRIPTION = "集成随机点名、座位编排、小组管理、互动签到、白板协作、AI 测验生成等课堂工具，让备课与课堂互动更高效。";
const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e3ddb04b-31ee-4b15-b98b-e05106dbd03a/id-preview-60a6466f--50abb99d-e699-4e11-920c-db8e0dcc3ffe.lovable.app-1771721532717.png";

// 学生签到扫码页用精简外壳；其余页面用完整外壳（含主样式表）。两者都按需下载。
const TeacherShell = lazyRetry(() => import("@/TeacherShell"));
const StudentShell = lazyRetry(() => import("@/StudentApp"));

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // 微信/QQ 内置浏览器会强缓存首页，要求每次取最新版本。
      { httpEquiv: "Cache-Control", content: "no-cache, no-store, must-revalidate" },
      { httpEquiv: "Pragma", content: "no-cache" },
      { httpEquiv: "Expires", content: "0" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover",
      },
      { name: "theme-color", content: "#ffffff" },
      { name: "color-scheme", content: "light dark" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "author", content: "教创搭子" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://teachermate.org.cn/" },
      { property: "og:site_name", content: "教创搭子 TeacherMate" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: SOCIAL_DESCRIPTION },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: SOCIAL_DESCRIPTION },
    ],
    links: [
      { rel: "canonical", href: "https://teachermate.org.cn/" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev" },
      { rel: "preload", as: "image", href: "/logo.webp", type: "image/webp", fetchPriority: "high" },
    ],
    styles: [{ children: CRITICAL_CSS }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "教创搭子 TeacherMate",
          url: "https://teachermate.org.cn/",
          logo: "https://teachermate.org.cn/logo.png",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "教创搭子 TeacherMate",
          url: "https://teachermate.org.cn/",
          inLanguage: "zh-CN",
        }),
      },
      { children: SCAN_BOOT_SCRIPT },
      { children: WATCHDOG_SCRIPT },
      { children: NOMODULE_SCRIPT, noModule: true },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">404</div>
  ),
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

let globalHandlersInstalled = false;

function ShellMounted() {
  useEffect(() => {
    (window as unknown as { __TM_APP_MOUNTED__?: boolean }).__TM_APP_MOUNTED__ = true;
    try {
      sessionStorage.removeItem("tm-auto-heal");
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // 页面全部在浏览器里渲染：服务器只输出首屏占位，避免浏览器专用代码在服务器上运行。
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!globalHandlersInstalled) {
      globalHandlersInstalled = true;
      window.addEventListener("vite:preloadError", handleVitePreloadError);
      window.addEventListener("error", handleRuntimeError);
      window.addEventListener("unhandledrejection", handleRuntimeError);
      installWeChatCompat();
    }
    // 学生签到页：页面代码与精简外壳同时开始下载，弱网下少等一轮。
    const p = window.location.pathname.toLowerCase();
    if (p.indexOf("/seat-checkin/") === 0) void import("@/pages/SeatCheckinPage").catch(() => undefined);
    else if (p.indexOf("/checkin/") === 0) void import("@/pages/CheckInPage").catch(() => undefined);
    setReady(true);
  }, []);

  if (!ready) return <BootPlaceholder />;

  const student = isStudentScanRoute(pathname);
  const Shell = student ? StudentShell : TeacherShell;
  return (
    <QueryClientProvider client={queryClient}>
      <ReactRuntimeRecoveryBoundary>
        <Suspense fallback={<BootPlaceholder />}>
          <Shell>
            <ShellMounted />
            <Outlet />
          </Shell>
        </Suspense>
      </ReactRuntimeRecoveryBoundary>
    </QueryClientProvider>
  );
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      <h1 className="text-xl font-semibold">This page didn't load</h1>
      <p className="text-sm text-muted-foreground">页面加载失败，请重试或返回首页。</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
        <a href="/" className="rounded-md border border-border px-4 py-2">
          Go home
        </a>
      </div>
    </div>
  );
}
