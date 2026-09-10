# 上传座次表图片：签到后自动标出本人位置

## 目标

在「座位 — 教室场景」发起签到时，如果选择了「仅签到 + 上传座次表图」的降级模式，学生扫码签到成功后，手机上不再只是一张静态图：系统会在图上用**红点 + 姓名气泡**直接标出这位签到者的位置，并自动放大居中；还能搜索同事/同学的名字，同样高亮定位。

## 教师端流程

1. 发起签到时上传座次表图片（现有功能不变）。
2. 上传完成后新增一步「识别座位位置」按钮：系统读取图片，识别出每个姓名及其在图上的位置。
3. 弹出**识别结果预览**：图片上叠加所有识别到的姓名标记，顶部显示「识别到 986 个姓名」，可以：
   - 输入姓名搜索并检查标记是否落在正确格子上；
   - 点击某个标记后拖动微调位置；
   - 删除误识别的标记；
   - 手动补录：点图上任意位置 → 输入姓名 → 生成标记。
4. 确认后，标记数据随签到场景一起保存。若跳过识别，学生端行为与现在完全一致（只显示静态图），不会出错。

## 学生端流程

1. 输入姓名签到成功。
2. 图上本人位置出现**红色圆点 + 心跳脉冲 + 姓名气泡**，页面自动缩放并把该位置移到屏幕中心。
3. 顶部卡片显示「李蒙 · 已签到」；若识别结果带排号信息，同时显示「第 X 排」。
4. 下方新增「找朋友」搜索框（与已有座位场景一致）：输入姓名 → 图上以另一种颜色（蓝色心形）标出对方位置。
5. 如果名单里找不到该姓名，提示「未在座次表中找到该姓名，请按现场指引入座」，不影响签到结果。

## 技术方案

### 1. 新增后端识别函数 `parse-seat-chart-markers`

- 输入：图片 base64。
- 输出：`{ markers: [{ name, x, y, w, h, row?, seatNo?, zone? }], imageWidth, imageHeight }`，坐标为 0–1 归一化。
- 模型：走 Lovable AI Gateway 的 Gemini 视觉模型链（与 `parse-seat-layout-image` 相同的降级链：pro → flash → flash-lite），复用其鉴权 + `consume_ai_quota` 配额校验与统一错误返回。
- **分块识别**：会议座次图姓名密度极高（示例图约 1000 个名字），整图一次识别必然漏。函数把图片按 3×3（可按长宽比自适应）切块并带 10% 重叠，逐块请求，块内坐标换算回全图坐标，最后按「姓名 + 坐标邻近」去重合并。分块请求串行 + 有限并发，遵守网关限流语义（429/5xx 退避重试，402/403 直接终止并回传提示）。
- 图片切块在前端用 canvas 完成（避免在 Edge Function 里做图像处理），函数接收的是若干块的 base64 + 每块在原图中的偏移。

### 2. 数据存储

- 复用 `seat_checkin_sessions.scene_config`，新增字段：
  ```ts
  seatChartMarkers?: { name: string; x: number; y: number; row?: number; seatNo?: number }[]
  ```
- 无需数据库迁移（`scene_config` 为 jsonb）。学生端通过既有 RPC `get_seat_checkin_session_for_student` 读取，该 RPC 已返回 `scene_config`。
- 上限保护：标记数超过 2000 条时截断并提示，避免 payload 过大。

### 3. 前端改动

| 文件 | 改动 |
| --- | --- |
| `src/lib/seat-chart-markers.ts`（新增） | 类型定义、归一化坐标换算、姓名精确/模糊匹配、重叠去重、标记数量上限校验；配套 vitest 单测 |
| `src/lib/seat-chart-tiles.ts`（新增） | canvas 切块与坐标回映射的纯函数部分（单测覆盖坐标换算） |
| `supabase/functions/parse-seat-chart-markers/index.ts`（新增） | 分块识别 + 合并 + 配额与错误语义 |
| `src/components/SeatCheckinDialog.tsx` | 「仅签到」区块内增加识别按钮、进度、识别结果计数；保存时写入 `seatChartMarkers` |
| `src/components/seating/SeatChartMarkerEditor.tsx`（新增） | 教师端预览/微调弹窗：叠加标记、搜索、拖动、删除、手动补录 |
| `src/components/checkin-views/SeatChartImageView.tsx` | 接收 `markers` / `selfName` / `friendName`，在图片上叠加绝对定位标记层；自 `usePinchZoom` 取变换，标记随缩放平移同步；命中时自动居中（参考现有 `useAutoCenterMySeat`） |
| `src/pages/SeatCheckinPage.tsx` | 降级分支传入标记数据、本人姓名，并在有标记时渲染 `FindFriendPanel`（名单取自标记姓名），复用已有 `findFriendEnabled` 开关 |

### 4. 交互与移动端细节

- 标记层用 CSS `fixed`/`absolute` 定位，不使用 portal（遵循项目约束）。
- 拖动微调使用 Pointer Events + `touch-action: none`。
- 本人标记：红点 + `animate-ping` 脉冲 + 姓名气泡；朋友标记：蓝色心形，样式走语义色 token。
- 标记密集时按缩放层级隐藏气泡文字，只保留圆点，避免遮挡。

### 5. 测试

- 单测：坐标换算、切块回映射、姓名匹配（同名、含空格、繁简）、去重、上限截断。
- E2E（Playwright，沿用 `e2e/` 现有登录会话方案）：教师上传图片 → 桩掉 AI 返回固定标记 → 发布签到 → 学生页签到 → 断言本人标记出现且居中 → 搜索朋友断言第二标记出现 → 无标记时降级为纯图片视图仍可用。

## 已知限制

AI 对上千个手写体/低分辨率姓名的识别不可能 100% 准确，因此方案把「教师预览 + 拖动微调 + 手动补录」作为必备环节，并在学生端对未识别姓名给出明确兜底提示，而不是让页面出错或标错位置。
