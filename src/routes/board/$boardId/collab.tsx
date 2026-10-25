import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const CollabBoardPage = lazyRetry(() => import("@/pages/CollabBoardPage"));

export const Route = createFileRoute("/board/$boardId/collab")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <CollabBoardPage />
    </Suspense>
  ),
});
