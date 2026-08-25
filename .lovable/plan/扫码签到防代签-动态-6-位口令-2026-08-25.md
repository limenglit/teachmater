# 扫码签到防代签：动态 6 位口令

方案可行。采用「服务端时间派生的一次性口令（TOTP 思路）」：签到码下方显示 6 位数字，每 30 秒自动刷新，学生在手机端输入姓名 + 当前 6 位数字才能签到，数字由服务端校验。是否开启由教师在发起签到时勾选。

## 为什么可行且安全

- 口令不存数据库，而是由「会话密钥 + 30 秒时间片」在服务端计算得出，教师端只是展示同一算法的结果。
- 校验放在数据库函数里，学生端无法绕过（前端只是输入框）。
- 允许 ±1 个时间片容错（约 30–90 秒有效），避免手机与服务器时间/网络延迟造成误判。
- 防代签效果：远端同学拿到二维码链接也无法签到，除非教室里有人实时把当前数字发给他（可将窗口压到 30 秒，进一步提高成本）。

## 教师端

在「发起签到」对话框新增开关：
- 防代签动态口令（默认关闭）
- 开启后可选刷新周期：30 秒 / 60 秒

签到进行中的大屏区域，二维码下方显示：
- 超大字号 6 位数字（分两组三位，便于口读）
- 环形倒计时进度，剩余秒数到 0 自动换新
- 文案提示「请输入姓名和屏幕上的 6 位数字」

## 学生端（手机）

- 会话开启防代签时，姓名输入框下方多出 6 位数字输入框（数字键盘、自动聚焦、满 6 位可提交）。
- 校验失败时明确提示：「口令错误或已过期，请看大屏最新数字重试」，不消耗任何记录。
- 未开启防代签的会话，界面与现在完全一致。

## 技术设计

数据库：
1. `seat_checkin_sessions` 增加 `otp_enabled boolean not null default false`、`otp_period_seconds integer not null default 30`、`otp_secret text not null default ''`（创建时服务端随机生成，仅通过教师专属 RPC 下发）。
2. 新增 `public.seat_checkin_otp(secret text, period int, ts timestamptz)` 内部函数：`hmac(floor(epoch/period)::text, secret, 'sha256')` 取末 4 字节做动态截断，模 1000000，左补零成 6 位（`pgcrypto` 已可用）。
3. 教师侧 `get_seat_checkin_otp(p_session_id, p_token)`：校验 `creator_token` 或 `user_id` 后返回当前口令与本时间片剩余秒数。
4. `get_seat_checkin_session_for_student` 返回 `otp_enabled`（不返回 secret）。
5. `submit_seat_checkin_record` 增加 `p_otp text default null` 参数：会话开启防代签时，比对当前时间片及前后各 1 片的口令，不匹配则 `RAISE EXCEPTION 'INVALID_OTP'`；未开启则忽略该参数。保留旧签名以兼容。
6. 新函数按现有约定 `GRANT EXECUTE` 给 `anon, authenticated`（教师侧 OTP 函数同样需要 token 校验后才返回）。

前端：
- `src/lib/seat-checkin-session.ts`：创建会话时透传 `otpEnabled`/`otpPeriod`；新增 `fetchSeatCheckinOtp(sessionId)`，教师端按剩余秒数定时轮询（每片刷新一次，误差内补拉）。
- `src/components/SeatCheckinDialog.tsx`：新增开关与周期选择、二维码下方的口令展示与倒计时。
- `src/pages/SeatCheckinPage.tsx`：读取 `otp_enabled`，条件渲染 6 位输入框，提交时带上 `p_otp`，区分「口令错误」与其他失败。
- `src/contexts/LanguageContext.tsx`：新增相关多语言文案。

## 备选/可叠加的防代签手段（本次不做，供后续选择）

- 一人一码：为每位学生生成个人链接，签到后失效。
- 设备指纹去重：同一设备短时间内多次签到不同姓名时告警。
- 位置校验：需要定位授权，微信/浏览器体验较差。
- 邻座互证：已有邻座签到状态可扩展为「需邻座确认」。

## 测试

- 单元测试：口令生成与 ±1 时间片容错、过期口令拒绝、未开启时旧流程不受影响。
- 端到端：教师开启防代签发起签到 → 学生输入正确口令成功、错误口令失败、上一片口令仍可用、更早口令失效。
