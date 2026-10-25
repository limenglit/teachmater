import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const BoardSubmitPage = lazyRetry(() => import("@/pages/BoardSubmitPage"));

export const Route = createFileRoute("/board/$boardId/submit")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <BoardSubmitPage />
    </Suspense>
  ),
});
