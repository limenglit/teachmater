/**
 * 发布签到码后的「一键通知」文案生成。
 *
 * 平台没有存储学生的手机号/邮箱，因此通知采用可转发文案 + 链接的形式：
 * 教师一键复制后粘贴到班级群，学生点开即可看到座位图并完成签到，
 * 不必再手动扫码。
 */

export interface CheckinNotificationInput {
  title: string;
  checkinUrl: string;
  createdAt: string | Date;
  /** 签到时长（分钟）；<= 0 或 >= 99999 视为不限时 */
  durationMinutes: number;
  otpEnabled?: boolean;
  /** 是否提供「找朋友」功能 */
  findFriendEnabled?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatCheckinTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildCheckinNotification(input: CheckinNotificationInput): string {
  const { title, checkinUrl, createdAt, durationMinutes, otpEnabled, findFriendEnabled } = input;
  const start = new Date(createdAt);
  const unlimited = !durationMinutes || durationMinutes <= 0 || durationMinutes >= 99999;

  const lines: string[] = [];
  lines.push(`【签到通知】${title || '课堂签到'}`);
  lines.push(`开始时间：${formatCheckinTime(start)}`);
  if (unlimited) {
    lines.push('签到时段：不限时（老师结束后关闭）');
  } else {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    lines.push(`截止时间：${formatCheckinTime(end)}（共 ${durationMinutes} 分钟）`);
  }
  lines.push(`签到入口：${checkinUrl}`);
  lines.push('点开链接即可查看座位图与自己的座位（第X排第N号），并完成签到，无需扫码。');
  if (otpEnabled) lines.push('提示：请输入老师屏幕上显示的 6 位动态口令。');
  if (findFriendEnabled) lines.push('签到后可使用「找朋友」查看同学位置。');

  return lines.join('\n');
}
