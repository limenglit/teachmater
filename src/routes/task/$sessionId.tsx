import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const TaskSubmitPage = lazyRetry(() => import("@/pages/TaskSubmitPage"));

export const Route = createFileRoute("/task/$sessionId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <TaskSubmitPage />
    </Suspense>
  ),
});
