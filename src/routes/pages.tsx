import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const PagesManager = lazyRetry(() => import("@/pages/PagesManager"));

export const Route = createFileRoute("/pages")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <PagesManager />
    </Suspense>
  ),
});
