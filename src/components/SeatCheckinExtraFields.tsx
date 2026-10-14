/** 座位签到的自定义填写项与签到口令输入框：只有老师开启时才下载。 */
import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/student-ui';
import { ShieldCheck } from '@/components/student-icons';
import type { CheckinCustomField } from '@/lib/seat-checkin-fields';

interface Props {
  fields: CheckinCustomField[];
  values: Record<string, string>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  otpEnabled: boolean;
  otp: string;
  setOtp: (v: string) => void;
  onEnter: () => void;
}

export default function SeatCheckinExtraFields({ fields, values, setValues, otpEnabled, otp, setOtp, onEnter }: Props) {
  return (
    <>
  {fields.map(field => (
    <div key={field.id} className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </label>
      <Input
        value={values[field.id] || ''}
        onChange={e => {
          const raw = e.target.value;
          const v = field.type === 'tel'
            ? raw.replace(/[^\d+\-\s]/g, '').slice(0, 20)
            : field.type === 'number'
              ? raw.replace(/[^\d.]/g, '').slice(0, 20)
              : raw.slice(0, 100);
          setValues(prev => ({ ...prev, [field.id]: v }));
        }}
        placeholder={`请填写${field.label}`}
        className={`text-center text-base h-14 rounded-xl border-2 focus-visible:border-primary${field.type === 'text' ? '' : ' tabular-nums'}`}
        inputMode={field.type === 'tel' ? 'tel' : field.type === 'number' ? 'numeric' : 'text'}
        enterKeyHint="next"
        onKeyDown={e => e.key === 'Enter' && onEnter()}
      />
    </div>
  ))}
  {otpEnabled && (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        大屏上的 6 位签到口令
      </label>
      <Input
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="6 位数字"
        className="text-center text-2xl tracking-[0.4em] h-14 rounded-xl border-2 focus-visible:border-primary tabular-nums"
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="done"
        onKeyDown={e => e.key === 'Enter' && onEnter()}
      />
      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
        该口令每隔数十秒自动更换，请以教室大屏当前显示的数字为准。
      </p>
    </div>
    )}
    </>
  );
}
