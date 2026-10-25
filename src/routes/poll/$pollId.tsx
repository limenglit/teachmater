import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const PollVotePage = lazyRetry(() => import("@/pages/PollVotePage"));

export const Route = createFileRoute("/poll/$pollId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <PollVotePage />
    </Suspense>
  ),
});
