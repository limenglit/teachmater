/** 座位签到页用的内联图标（与 lucide 同样的线条），避免下载图标库。 */
import type { ReactNode } from 'react';

type P = { className?: string; strokeWidth?: number };
const icon = (children: ReactNode) => ({ className, strokeWidth = 2 }: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);

export const MapPin = icon(<><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>);
export const ScanLine = icon(<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />);
export const User2 = icon(<><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>);
export const ShieldCheck = icon(<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.170 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zm-11-1 2 2 4-4" />);
export const CheckCircle2 = icon(<path d="M21.801 10A10 10 0 1 1 17 3.335M9 11l3 3L22 4" />);
export const Crosshair = icon(<><circle cx="12" cy="12" r="10" /><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4" /></>);
export const Sparkles = icon(<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0zM20 3v4M22 5h-4M4 17v2M5 18H3" />);
