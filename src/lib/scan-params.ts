/** 学生扫码页读取地址里的会话号：不依赖路由库，手机少下载约 19KB。 */
export function useParams<T = { sessionId?: string }>(): T {
  const seg = (typeof window !== 'undefined' ? window.location.pathname : '').split('/').filter(Boolean);
  return { sessionId: seg.length > 1 ? seg[1] : undefined } as T;
}
