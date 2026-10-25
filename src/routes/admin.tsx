import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const AdminPage = lazyRetry(() => import("@/pages/AdminPage"));

export const Route = createFileRoute("/admin")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <AdminPage />
    </Suspense>
  ),
});
