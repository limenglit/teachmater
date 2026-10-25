import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const CheckInPage = lazyRetry(() => import("@/pages/CheckInPage"));

export const Route = createFileRoute("/checkin/$sessionId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <CheckInPage />
    </Suspense>
  ),
});
