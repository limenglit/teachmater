import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazy-retry";
import { RouteLoading } from "@/components/route-loading";

const Index = lazyRetry(() => import("@/pages/Index"));

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: '教创搭子 TeacherMate · 课堂互动工作台' },
    { name: 'description', content: '教创搭子课堂工作台：导入学生名单、随机点名、分组建队与座位编排。' },
    { property: 'og:title', content: '教创搭子 TeacherMate · 课堂互动工作台' },
    { property: 'og:description', content: '管理学生名单，开展点名、分组、排座与课堂互动。' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <Index />
    </Suspense>
  ),
});
