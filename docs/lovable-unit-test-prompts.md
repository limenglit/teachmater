# TeachMater Lovable 单元测试用例与提示词

本文档用于在上线前，借助 Lovable 批量生成并完善 TeachMater 的单元测试。

## 1. 测试目标

- 覆盖课堂核心链路：名单管理、随机点名、分组建队、排座、签到、工具箱、导出。
- 优先保证“业务规则正确”，其次是“交互状态正确”。
- 对网络、导出、语音播报、Supabase 实时订阅等外部依赖全部做 mock。

## 2. 当前测试基线

- 测试框架：Vitest + Testing Library（`vitest.config.ts`）
- 测试环境：`jsdom`
- 全局 setup：`src/test/setup.ts`
- 已有测试：
  - `src/lib/command-cards.test.ts`
  - `src/components/ToolkitPanel.test.tsx`

运行命令：

```bash
npm.cmd run test
```

## 3. 模块级测试用例设计

### 3.1 学生名单与存储

目标文件：

- `src/hooks/useStudentStore.ts`
- `src/contexts/StudentContext.tsx`
- `src/components/StudentSidebar.tsx`

核心用例：

1. localStorage 为空时加载默认学生并写回存储。
2. localStorage 非法 JSON 时回退到空数组，不抛异常。
3. `addStudent` 自动 trim，空字符串不新增。
4. `removeStudent` 删除指定 id。
5. `updateStudent` 正确更新指定学生姓名。
6. `importFromText` 按行导入并过滤空行。
7. StudentContext 在未包裹 Provider 时抛出约束错误。
8. `StudentSidebar` 点击“清空”后列表为空。

### 3.2 随机点名

目标文件：

- `src/components/RandomPicker.tsx`
- `src/components/SpinWheel.tsx`
- `src/lib/sounds.ts`

核心用例：

1. 无可用学生时，“滚动/抽取”按钮禁用。
2. 开启“不重复”时，连续抽取不会重复直到池耗尽。
3. 点击“重置”后可再次抽到已抽过学生。
4. 关闭音效后不调用 `playTick`/`playCelebration`。
5. 关闭语音后不调用 `speechSynthesis.speak`。
6. 抽取完成后“已选人数”和“剩余人数”显示正确。
7. 弹窗开关关闭时，不显示大字弹出层。

### 3.3 分组

目标文件：

- `src/components/GroupManager.tsx`

核心用例：

1. 空名单时点击“自动分组”不生成分组。
2. 组数输入被限制在 2-10。
3. 自动分组后总人数守恒（所有组成员总和等于学生数）。
4. 各组人数差不超过 1（均衡分配）。
5. 组长设置为单选（同组最多一个组长）。
6. 修改组名后立即渲染。
7. 组内拖拽和跨组拖拽后成员位置与归属正确。

### 3.4 建队

目标文件：

- `src/components/TeamBuilder.tsx`

核心用例：

1. 每队人数输入被限制在 2-10。
2. 自动建队队伍数 = `ceil(总人数 / 每队人数)`。
3. 队长设置为单选（同队最多一个队长）。
4. 改名、拖拽行为与分组模块一致。
5. 总人数守恒且无重复成员。

### 3.5 座位编排

目标文件：

- `src/components/SeatChart.tsx`
- `src/components/seating/*.tsx`

核心用例：

1. 各模式（竖S、横S、随机、考试）点击自动排座后产生座位数据。
2. 考试模式下“隔行/隔列”开关生效。
3. 禁用座位后该格不可分配学生（保持空位）。
4. 交换门窗位置后列方向变化（起始列逻辑变化）。
5. 添加/删除行列过道后渲染标识正确。
6. 座位拖拽交换后两位置学生互换。
7. 分组模式下，组数参数变化可触发重新排座。

### 3.6 签到

目标文件：

- `src/components/CheckInPanel.tsx`
- `src/components/SeatCheckinDialog.tsx`
- `src/pages/CheckInPage.tsx`
- `src/pages/SeatCheckinPage.tsx`

核心用例：

1. 发起签到成功后创建 session、倒计时启动、二维码链接正确。
2. 发起签到失败时显示错误 toast。
3. 实时 INSERT 记录时，匹配名单标记为 `matched`，否则 `unknown`。
4. 倒计时归零自动结束签到。
5. 手动结束签到后状态更新为 `ended`。
6. 已签到、未签到、未知签到统计正确。
7. 请假勾选影响导出 CSV 状态文案。
8. 历史记录读写逻辑一致（注意 `sessionStorage/localStorage` 差异行为）。

### 3.7 工具箱

目标文件：

- `src/components/ToolkitPanel.tsx`
- `src/components/CountdownTimer.tsx`
- `src/components/BarrageDiscussion.tsx`
- `src/lib/command-cards.ts`

核心用例：

1. 指令卡图标检索成功时显示 3-6 个候选并可选中发布。
2. 检索失败或候选不足时回退默认 `？` 图标。
3. 自定义指令去重且最多保留 8 条。
4. 全屏指令卡可通过 ESC 或点击关闭。
5. 倒计时开始/暂停/重置状态切换正确。
6. 到提醒阈值时触发播报，且仅触发一次。
7. 倒计时到 0 时显示“时间到”。
8. 二维码输入非空时渲染 `QRCodeSVG`。

### 3.8 导出

目标文件：

- `src/components/ExportButtons.tsx`
- `src/lib/export.ts`

核心用例：

1. 自定义标题为空时回退默认文件名。
2. 点击 PNG/PDF 按钮分别调用 `exportToPNG/exportToPDF`。
3. 导出成功弹出成功 toast。
4. 导出失败弹出 destructive toast。
5. `targetRef.current` 为空时不调用导出函数。

### 3.9 页面路由与导航

目标文件：

- `src/App.tsx`
- `src/pages/Index.tsx`
- `src/components/TabNavigation.tsx`

核心用例：

1. 未登录时隐藏需要授权的“签到”tab。
2. 切换到签到 tab 后名单侧栏折叠。
3. 未命中路由渲染 `NotFound`。
4. `Suspense` 懒加载页面加载态显示“加载中...”。

## 4. Lovable 通用提示词模板

将以下提示词复制到 Lovable，每次只改“目标模块”和“目标文件”。

```text
你现在是该仓库的测试工程师，请基于现有代码为【目标模块】补全单元测试。

硬性要求：
1) 使用 Vitest + @testing-library/react，不引入 jest。
2) 测试文件放在源文件同目录，命名为 *.test.ts 或 *.test.tsx。
3) 仅对外部依赖做 mock：网络请求、Supabase、speechSynthesis、html2canvas、jspdf、toast。
4) 不修改业务功能逻辑；若必须做可测试性改造，仅允许“无行为变化”的小重构，并在变更说明中写明原因。
5) 断言必须覆盖：正常路径、边界条件、异常路径。
6) 所有新增测试可在 `npm run test` 下通过。

输出要求：
- 先给“测试点清单”，再直接给可运行代码。
- 最后给“执行命令”和“预期结果”。
```

## 5. 可直接使用的模块提示词

### 5.1 名单管理模块

```text
请为学生名单模块补全单元测试，目标文件：
- src/hooks/useStudentStore.ts
- src/contexts/StudentContext.tsx
- src/components/StudentSidebar.tsx

重点覆盖：
- localStorage 初始化与容错
- add/remove/update/import/clear 行为
- Provider 约束错误
- 侧栏导入、清空、人数展示

要求：
- 使用 Vitest + Testing Library
- mock FileReader 与 localStorage
- 给出完整可运行测试代码
```

### 5.2 随机点名模块

```text
请为随机点名模块补全单元测试，目标文件：
- src/components/RandomPicker.tsx
- src/components/SpinWheel.tsx

重点覆盖：
- 不重复抽取逻辑
- 重置池逻辑
- 音效开关与语音开关
- 抽取完成后的已选/剩余计数
- 无学生时按钮禁用

要求：
- mock sounds 与 speechSynthesis
- 使用 fake timers 控制滚动时序
- 代码可直接通过 npm run test
```

### 5.3 分组模块

```text
请为分组模块补全单元测试，目标文件：src/components/GroupManager.tsx。

重点覆盖：
- 自动分组的人数守恒与均衡性
- 组数边界 2-10
- 组长单选
- 组名编辑
- 拖拽重排（同组、跨组）

要求：
- 使用 Testing Library 触发 drag 事件
- 不改业务逻辑
- 测试可稳定重复执行
```

### 5.4 建队模块

```text
请为建队模块补全单元测试，目标文件：src/components/TeamBuilder.tsx。

重点覆盖：
- teamCount = ceil(n / membersPerTeam)
- 每队人数边界 2-10
- 队长单选
- 拖拽换位
- 队名编辑

要求：
- 与 GroupManager 测试风格一致
- 包含异常与边界断言
```

### 5.5 座位模块

```text
请为座位模块补全单元测试，目标文件：src/components/SeatChart.tsx。

重点覆盖：
- verticalS/horizontalS/random/exam 四类模式
- exam 隔行隔列开关
- 禁用座位不可被分配
- 门窗对换导致起始方向变化
- 过道增删与拖动
- 座位拖拽交换

可测试性改造允许：
- 将纯函数（如分组、可视行映射、过道位置计算）提取到 src/lib/seat-layout.ts 并补充对应单测
- UI 组件仅做最小改动

要求：
- 单测优先覆盖纯函数，再覆盖关键 UI 交互
```

### 5.6 签到模块

```text
请为签到模块补全单元测试，目标文件：
- src/components/CheckInPanel.tsx
- src/pages/CheckInPage.tsx
- src/pages/SeatCheckinPage.tsx

重点覆盖：
- 发起签到成功/失败
- 倒计时自动结束
- matched/unknown 分类
- 统计数据正确性
- CSV 导出数据拼装
- 历史记录存取

要求：
- 完整 mock supabase client（from/select/insert/update/channel/on/subscribe/removeChannel）
- mock toast
- 使用 fake timers
```

### 5.7 工具箱模块

```text
请为工具箱模块补全单元测试，目标文件：
- src/components/ToolkitPanel.tsx
- src/components/CountdownTimer.tsx
- src/lib/command-cards.ts

重点覆盖：
- 图标检索候选范围与回退逻辑
- 自定义指令去重和条数上限
- 指令全屏关闭（ESC/点击）
- 倒计时提醒触发一次
- 全屏切换与重置
- 二维码输入渲染

要求：
- 保留已有测试并扩展，不删除现有用例
```

### 5.8 导出模块

```text
请为导出模块补全单元测试，目标文件：
- src/components/ExportButtons.tsx
- src/lib/export.ts

重点覆盖：
- 默认文件名回退
- PNG/PDF 分支调用
- 成功/失败 toast
- html2canvas 与 jsPDF 调用参数

要求：
- mock html2canvas、jsPDF、URL.createObjectURL、a.click
- 测试在 jsdom 下稳定运行
```

### 5.9 路由与导航模块

```text
请为路由与导航补全单元测试，目标文件：
- src/App.tsx
- src/pages/Index.tsx
- src/components/TabNavigation.tsx

重点覆盖：
- requiresAuth tab 的显示逻辑
- 懒加载 fallback
- 404 路由
- tab 切换触发内容变化

要求：
- 使用 MemoryRouter
- mock useAuth 返回不同身份场景
```

## 6. 建议执行顺序（上线前）

1. 先跑纯函数与轻交互模块：`command-cards`、`ExportButtons`、`TabNavigation`、`useStudentStore`。
2. 再跑复杂交互模块：`GroupManager`、`TeamBuilder`、`CountdownTimer`、`RandomPicker`。
3. 最后跑重依赖模块：`SeatChart`、`CheckInPanel`。
4. 每完成一个模块，在 Lovable 中执行：`npm.cmd run test`，确保增量通过。

## 7. 验收标准

- 模块测试全部可重复运行通过。
- 关键失败路径均被断言（网络失败、空数据、外部依赖异常）。
- 覆盖上线核心流程：随机点名、分组建队、排座、签到、工具箱、导出。
- 新增测试无明显脆弱断言（避免依赖动画帧、随机值未控制、异步未等待）。
