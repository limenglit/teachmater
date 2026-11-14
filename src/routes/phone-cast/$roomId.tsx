import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';
import { lazyRetry } from '@/lib/lazy-retry';
import { RouteLoading } from '@/components/route-loading';

const PhoneCastPage = lazyRetry(() => import('@/pages/PhoneCastPage'));
export const Route = createFileRoute('/phone-cast/$roomId')({
  head: () => ({ meta: [
    { title: '手机扫码投屏 · 教创搭子 TeacherMate' },
    { name: 'description', content: '连接课堂电脑，投送手机摄像头画面、照片或浏览器支持的共享屏幕。' },
    { property: 'og:title', content: '手机扫码投屏 · 教创搭子 TeacherMate' },
    { property: 'og:description', content: '手机与课堂电脑配对，展示摄像头画面和作业照片。' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'referrer', content: 'no-referrer' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: CastRoute,
});
function CastRoute() {
  const { roomId } = Route.useParams();
  return <Suspense fallback={<RouteLoading />}><PhoneCastPage roomId={roomId} /></Suspense>;
}