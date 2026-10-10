/** 学生扫码页（无需登录）：这些页面不触发全站登录检查与功能配置读取。 */
export function isStudentScanRoute(pathname?: string): boolean {
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  return p.startsWith('/checkin/') || p.startsWith('/seat-checkin/');
}
