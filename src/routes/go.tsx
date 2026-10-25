import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const GoRedirect = lazyRetry(() => import("@/pages/GoRedirect"));

export const Route = createFileRoute("/go")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <GoRedirect />
    </Suspense>
  ),
});
