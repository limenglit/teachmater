import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const QuizSubmitPage = lazyRetry(() => import("@/pages/QuizSubmitPage"));

export const Route = createFileRoute("/quiz/$sessionId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <QuizSubmitPage />
    </Suspense>
  ),
});
