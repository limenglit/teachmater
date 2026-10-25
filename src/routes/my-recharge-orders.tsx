import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const MyRechargeOrdersPage = lazyRetry(() => import("@/pages/MyRechargeOrdersPage"));

export const Route = createFileRoute("/my-recharge-orders")({
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <MyRechargeOrdersPage />
    </Suspense>
  ),
});
