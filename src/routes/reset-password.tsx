import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const ResetPassword = lazyRetry(() => import("@/pages/ResetPassword"));

export const Route = createFileRoute("/reset-password")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <ResetPassword />
    </Suspense>
  ),
});
