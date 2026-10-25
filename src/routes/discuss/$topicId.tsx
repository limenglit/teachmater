import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const DiscussPage = lazyRetry(() => import("@/pages/DiscussPage"));

export const Route = createFileRoute("/discuss/$topicId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <DiscussPage />
    </Suspense>
  ),
});
