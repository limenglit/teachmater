import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const AuthPage = lazyRetry(() => import("@/pages/AuthPage"));

export const Route = createFileRoute("/auth")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <AuthPage />
    </Suspense>
  ),
});
