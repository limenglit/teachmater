# TeachMater 开发文档

## 1. 项目定位

TeachMater 是面向课堂场景的教学辅助应用，核心能力包括：

- 点名与随机抽取
- 分组与建队
- 多场景排座
- 签到与签到记录导出
- 工具箱（课堂指令卡、二维码生成、弹幕讨论、倒计时）

## 2. 技术栈

- 前端框架：React 18 + TypeScript + Vite
- UI：shadcn-ui + Tailwind CSS + Radix UI
- 状态与请求：React Query + 自定义 hooks/context
- 后端服务：Supabase（Auth / DB / Edge Functions）
- 测试：Vitest + Testing Library

## 3. 目录结构

- `src/pages/`：页面入口（如 `Index.tsx`、`CheckInPage.tsx`）
- `src/components/`：业务组件（分组、建队、排座、工具箱）
- `src/components/seating/`：多场景座位组件
- `src/components/ui/`：基础 UI 组件
- `src/contexts/`：全局上下文（Auth、Students、Theme）
- `src/hooks/`：复用 Hook
- `src/lib/`：工具函数（导出、命令卡逻辑等）
- `src/integrations/supabase/`：Supabase 客户端与类型
- `supabase/functions/`：Edge Functions
- `supabase/migrations/`：数据库迁移
- `docs/`：研发与运营文档

## 4. 本地开发

### 4.1 安装依赖

```bash
npm install
```

### 4.2 启动开发环境

```bash
npm run dev
```

### 4.3 构建生产包

```bash
npm run build
```

## 5. 环境变量

至少配置以下变量（前端）：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

如果启用 Edge Functions（按需）：

- `SUPABASE_SERVICE_ROLE_KEY`（函数端）
- 其他第三方密钥（如 AI、支付）

## 6. 关键模块说明

### 6.1 座位与导出

- 入口组件：`SeatChart.tsx`、`src/components/seating/*`
- 导出能力：`src/components/ExportButtons.tsx` + `src/lib/export.ts`

### 6.2 工具箱课堂指令卡

- 组件：`src/components/ToolkitPanel.tsx`
- 可测试逻辑：`src/lib/command-cards.ts`
- 已支持：
  - 教师自定义输入主题
  - 联网检索徽章图标
  - 候选列表（3-6）手选
  - 网络异常/候选不足时默认 `？` 图标回退并发布

## 7. 测试建议

测试清单见：`docs/testing-and-release.md`

常用命令：

```bash
npm run test
```

如果 PowerShell 受执行策略限制：

```bash
npm.cmd run test
```

## 8. 发布流程建议

1. 同步主分支并安装依赖
2. 执行构建与测试
3. 校验核心课堂流程
4. 发布并进行回归验证
5. 记录版本变更

## 9. 常见问题

### 9.1 `npm` 在 PowerShell 无法执行

使用 `npm.cmd` 替代，或调整执行策略。

### 9.2 测试工具缺失

先执行 `npm install`。

### 9.3 图标检索失败

应用已内置回退逻辑，会使用默认 `？` 图标发布指令。

## 10. 维护建议

- 业务逻辑尽量抽离到 `src/lib/*`，提升可测试性
- 新增功能同步补充：
  - 单元测试
  - 文档（开发 + 用户）
  - 变更记录
