import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const CoursewareGenerator = lazyRetry(() => import("@/pages/CoursewareGenerator"));

export const Route = createFileRoute("/courseware")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <CoursewareGenerator />
    </Suspense>
  ),
});
