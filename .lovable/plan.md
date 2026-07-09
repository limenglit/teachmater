## 目标

侧边名单已可拖（`StudentSidebar` 已发出 `application/x-student-name` payload）。当前只有普通"教室"（`SeatChart`）与自由布局（`CustomLayout`）接收该拖拽。本次为其余 7 个场景补齐相同能力：

- 智慧教室 SmartClassroom（圆桌）
- 宴会厅 BanquetHall（圆桌）
- 音乐厅 ConcertHall（分排）
- 电脑教室 ComputerLab（分排+行方向）
- 会议室 ConferenceRoom（U/口/长桌多区域）
- 美术教室 ArtStudio（自由坐标）
- 自由布局 CustomLayout（复核已有实现）

## 交互规范（所有场景一致）

1. 侧边栏拖出学生 → 松开在某座位：
   - 若目标座位空：该学生就座。
   - 若目标座位已有其他学生：占位者的位置不动，把新学生放上去 → 原位学生返回名单（保持"不重复上座"）。
   - 若被拖学生已在其他座位：与目标座位交换（原座位换成目标座位的旧学生，或原座位清空）。
2. 目标座位若被禁用/关闭/预留 → 忽略拖拽。
3. 拖拽用与已有一致的 `text/plain: "student:<name>"` + `application/x-student-name` 双通道。

## 技术方案

统一新增一个纯函数 `applyStudentDropToAssignment`（放在 `src/lib/seat-utils.ts` 或新文件 `seat-name-drop.ts`），针对通用二维 `string[][]` 座位模型执行"放置/交换"。对不同 shape 的场景做轻量适配：

- **SmartClassroom / BanquetHall**：`assignment: string[][]`，直接调用。给每个座位 `<div>` 加 `onDragOver`/`onDrop`（不影响已有 pointer 交换逻辑）。跳过 `isClosed || isReservedTable`。
- **ConcertHall**：`assignment: string[][]`（按 row），同上。
- **ComputerLab**：`assignment: ComputerLabRowAssignment[]`（每行一个数组，含 `students: string[]`）。为每个座位 `<g>`/`<foreignObject>` 加 drop 事件，写入 `setAssignment(prev => …)` 使用行内 index。
- **ConferenceRoom**：`assignment: { top, bottom, left, right, ... }`，按 side+index 定位。为每个座位 cell 加 drop。
- **ArtStudio**：座位是"节点集合"（`nodes` + `seatPositions`），无 grid。做法：以 `seatNodes` 数组（已存在）为准，给每个 seat 节点加 drop；写入到 `assignment`（或对应的 name→node 映射）。查看该文件确认命名后实现。
- **CustomLayout**：确认现有 `handleDrop` 已处理 student payload；若未处理，扩展。

DragOver 需 `preventDefault()` + `dropEffect='move'` 才能触发 drop；只在检测到 `text/plain` 以 `student:` 开头 或 `types` 包含 `application/x-student-name` 时激活，避免干扰各场景已有的行/桌自身拖动。

## 校验

- 手工：把已就座学生拖到另一空位（应搬迁）、拖到已就座位（应交换）、把名单里未就座学生拖到空位（应就座）、拖到关闭/预留位（应无反应）。
- 单元：为 `applyStudentDropToAssignment` 写 vitest（空位/交换/搬迁三条主路径）。
- 端到端：在其中一个场景（ComputerLab）用 Playwright 触发 `dispatchEvent('dragstart'/'drop')`，验证 DOM 中学生姓名出现在目标座位。

## 涉及文件

- 新增：`src/lib/seat-name-drop.ts` + 对应测试
- 修改：`SmartClassroom.tsx`、`BanquetHall.tsx`、`ConcertHall.tsx`、`ComputerLab.tsx`、`ConferenceRoom.tsx`、`ArtStudio.tsx`、必要时 `CustomLayout.tsx`
