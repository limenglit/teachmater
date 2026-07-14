# AI 算力订阅充值实现方案

## 一、套餐配置（写死在前端配置）

| 套餐 | 价格 | AI 次数 |
|------|------|---------|
| 入门包 | ￥10 | 100 次 |
| 标准包 | ￥20 | 300 次 |

有效期：**充值到账当月**，跨月自动清零。跨月由 `expires_at` 字段 + 消费时判断。

## 二、数据库改动（新增迁移）

### 1. `payment_qrcodes`（管理员维护收款码）
放在 `system_config.config.paymentQR = { wechat_url, alipay_url, note }`，无需新表。

### 2. `user_ai_credits`（用户购买余额）
- `user_id uuid PK`
- `credits_balance int`（剩余次数）
- `expires_at date`（当月月末）
- `updated_at timestamptz`

### 3. `ai_credit_orders`（订单）
- `id uuid PK`
- `user_id uuid`
- `package_key text`（`p10_100` / `p20_300`）
- `amount_cny numeric`
- `credits int`
- `pay_method text`（`wechat` / `alipay`）
- `screenshot_url text`（付款截图）
- `payer_note text`（用户备注/后四位）
- `status text`（`pending` / `approved` / `rejected`）
- `reject_reason text`
- `created_at`, `reviewed_at`, `reviewed_by`

GRANT + RLS：用户只能读写自己订单；管理员通过 SECURITY DEFINER RPC 审核。

### 4. Storage bucket `payment-screenshots`（公开读）

### 5. RPC 函数
- `create_ai_credit_order(package_key, pay_method, screenshot_url, payer_note)` — 用户下单
- `admin_list_ai_credit_orders(status)` — 管理员列表
- `admin_approve_ai_credit_order(order_id)` — 通过：将该套餐 credits 累加到 `user_ai_credits.credits_balance`，`expires_at` 设为当月月末（如已过期则重置余额）
- `admin_reject_ai_credit_order(order_id, reason)`
- `consume_purchased_ai_credit(user_id)` — 消费 1 次：若 `expires_at >= today` 且余额>0 则 -1 并返回 true，否则 false（供 useAIQuota 优先消耗）
- `get_my_ai_credits()` — 返回 `{ balance, expires_at }`（自动过滤过期）

## 三、前端改动

### 1. `useAIQuota` 扩展
- 新增 `purchasedRemaining`, `purchasedExpiresAt`
- `remaining` UI 显示：`免费剩余 X / 已购 Y 次`
- `consume()` 顺序：
  1. Admin → 无限
  2. 已购余额>0 且未过期 → 调 `consume_purchased_ai_credit` RPC
  3. 否则走原有每日免费额度 localStorage 逻辑
- 广播 `ai-quota-changed` 事件保持实时同步

### 2. 主页 `Index.tsx`
在昵称旁 AI 剩余徽章后追加 **「充值」按钮**，点击打开 `RechargeDialog`。

### 3. `RechargeDialog` 组件（新）
- 展示两个套餐卡片，选择套餐
- 切换微信/支付宝，显示对应收款二维码（来自 `system_config.paymentQR`）
- 提示：备注请填写你的邮箱/昵称
- 上传付款截图（Storage）
- 填写备注（付款金额、订单号后四位等）
- 提交 → 调用 `create_ai_credit_order` → toast「已提交，等待管理员审核」

### 4. `MyOrdersDialog`（新，可选简化为 RechargeDialog 内的历史区）
显示我的订单历史与状态。

### 5. Admin 端
在 `AdminPage` 新增两块：
- **「收款码配置」**：上传/替换微信、支付宝二维码图片，保存到 `system_config.paymentQR`
- **「AI 充值订单审核」**：列表待审核订单，显示用户、套餐、金额、截图缩略图（点开大图）、备注、时间；操作按钮：通过 / 拒绝（填原因）

## 四、消费点接入
无需改现有 AI 调用点——`consume()` 内部自动决定扣哪个池子。

## 五、跨月清零机制
`get_my_ai_credits()` RPC 里：若 `expires_at < today` 则视为 0（不实际删除，审批时重置）。UI 展示 `已购 0 次（已过期）`。

## 六、安全 & 细节
- 订单 amount/credits 由服务端根据 `package_key` 白名单派生，不接受客户端传值
- 截图 URL 校验为本项目 Storage 域名
- 管理员审核时使用 `has_role(auth.uid(), 'admin')` 校验
- 拒绝后不发放算力，用户可再次提交新订单

## 交付分两步
**Step 1**：数据库迁移 + RPC + Storage bucket
**Step 2**：前端 UI（充值弹窗、Admin 审核、useAIQuota 接入）

确认后我立即开始实施 Step 1。
