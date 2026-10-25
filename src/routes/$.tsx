import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const NotFound = lazyRetry(() => import("@/pages/NotFound"));

export const Route = createFileRoute("/$")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <NotFound />
    </Suspense>
  ),
});
