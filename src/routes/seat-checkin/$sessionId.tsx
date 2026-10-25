import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const SeatCheckinPage = lazyRetry(() => import("@/pages/SeatCheckinPage"));

export const Route = createFileRoute("/seat-checkin/$sessionId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <SeatCheckinPage />
    </Suspense>
  ),
});
