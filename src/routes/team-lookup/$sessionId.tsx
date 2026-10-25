import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const TeamLookupPage = lazyRetry(() => import("@/pages/TeamLookupPage"));

export const Route = createFileRoute("/team-lookup/$sessionId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <TeamLookupPage />
    </Suspense>
  ),
});
