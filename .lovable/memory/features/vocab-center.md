---
name: Vocab Center
description: 词库中心模块（vocab_sets/vocab_cards），用户创建/编辑/提交，管理员审核，所有人浏览平台库；接入消消乐与闪卡
type: feature
---
顶级模块"词库中心"（TabId='vocab'，导航 emoji 📚）位于"社区"和"工具箱"之间。基于云端表 vocab_sets / vocab_cards：
- 状态机：private / pending / approved / rejected；is_system=true 为平台预置库（不可删/不可编辑）
- 普通用户：创建私有词库，可"提交发布"进入待审核，已审核通过后所有人可见
- 管理员：在 /admin 的"词库审核" Tab 查看 pending 列表，调用 approve_vocab_set / reject_vocab_set(带原因) RPC
- 适用对象（audience）枚举：primary/junior/senior/university/vocational
- 卡片至少 2 条（submit_vocab_set 函数检查）；已审核通过的词库 RLS 禁止编辑
- VocabPlayer 复用 MemoryAidTool 的 MatchGame 与 FlashCard，传入 toCardItems(rows) 后切换模式
- 状态徽章颜色：私有 muted、待审 warning、已通过 success、已拒 destructive、平台库 primary
- 数据访问层：src/lib/vocab-cloud.ts（listMySets/listPlatformSets/loadCards/createSet/updateSet/submit/withdraw/approve/reject）
- 平台库种子（已审核 system 库）：元素周期表前20、英语不规则动词、世界地理之最、常用数学公式
