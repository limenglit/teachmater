import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const UserPageView = lazyRetry(() => import("@/pages/UserPageView"));

export const Route = createFileRoute("/$username/$slug")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <UserPageView />
    </Suspense>
  ),
});
