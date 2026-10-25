import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const VocabSessionPage = lazyRetry(() => import("@/pages/VocabSessionPage"));

export const Route = createFileRoute("/vocab/$sessionId")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <VocabSessionPage />
    </Suspense>
  ),
});
