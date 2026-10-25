import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const SeatingRuleValidator = lazyRetry(() => import("@/pages/SeatingRuleValidator"));

export const Route = createFileRoute("/seating-rule-check")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <SeatingRuleValidator />
    </Suspense>
  ),
});
