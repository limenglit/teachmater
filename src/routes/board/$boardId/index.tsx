import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const BoardPage = lazyRetry(() => import("@/pages/BoardPage"));

export const Route = createFileRoute("/board/$boardId/")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <BoardPage />
    </Suspense>
  ),
});
