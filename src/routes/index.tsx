import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const Index = lazyRetry(() => import("@/pages/Index"));

export const Route = createFileRoute("/")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <Index />
    </Suspense>
  ),
});
