import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const SeatLookupPage = lazyRetry(() => import("@/pages/SeatLookupPage"));

export const Route = createFileRoute("/seat-lookup/$sessionId")({
  head: () => ({
    meta: [
      { title: "查询我的座位 · TeachMate" },
      { name: "description", content: "扫码输入姓名，查看自己的座位号和座位图位置。" },
      { property: "og:title", content: "查询我的座位 · TeachMate" },
      { property: "og:description", content: "扫码输入姓名，查看自己的座位号和座位图位置。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <SeatLookupPage />
    </Suspense>
  ),
});
