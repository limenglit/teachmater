import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';

/**
 * 学生扫码页专用的原生轻量控件：不依赖 Radix / cva / 全站 Toaster，
 * 旧 iPhone 微信内置浏览器下载与解析更少的代码。
 */
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(({ variant = 'default', className, type = 'button', ...p }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:pointer-events-none',
      variant === 'outline' ? 'border border-input bg-background' : 'bg-primary text-primary-foreground',
      className,
    )}
    {...p}
  />
));
Button.displayName = 'Button';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cx('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)}
    {...p}
  />
));
Input.displayName = 'Input';

type ToastMsg = { id: number; title?: string; description?: string; variant?: 'default' | 'destructive' };
let listeners: ((m: ToastMsg) => void)[] = [];
let seq = 0;
export function toast(m: Omit<ToastMsg, 'id'>) {
  const msg = { ...m, id: ++seq };
  listeners.forEach((l) => l(msg));
}

export function MiniToaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const l = (m: ToastMsg) => {
      setItems((a) => a.concat(m).slice(-3));
      setTimeout(() => setItems((a) => a.filter((x) => x.id !== m.id)), 3500);
    };
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);
  if (!items.length) return null;
  return (
    <div className="fixed left-0 right-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 pointer-events-none" role="status">
      {items.map((m) => (
        <div key={m.id} className={cx('max-w-sm w-full rounded-lg border px-4 py-3 shadow-lg text-sm', m.variant === 'destructive' ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-card text-foreground border-border')}>
          {m.title ? <div className="font-semibold">{m.title}</div> : null}
          {m.description ? <div className="opacity-90 mt-0.5">{m.description}</div> : null}
        </div>
      ))}
    </div>
  );
}
