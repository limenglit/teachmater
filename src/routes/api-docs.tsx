import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const APIDocsPage = lazyRetry(() => import("@/pages/APIDocsPage"));

export const Route = createFileRoute("/api-docs")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <APIDocsPage />
    </Suspense>
  ),
});
