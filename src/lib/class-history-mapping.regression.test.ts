/**
 * 端到端回归：班级 <-> 签到历史 <-> 白板历史 的对应关系。
 *
 * 覆盖两个调用点（SeatCheckinDialog / BoardPanel）共用的过滤契约：
 * - 按学院筛选：命中该学院下所有班级的记录
 * - 按班级筛选：仅命中该班级
 * - 跨班级记录：选中其中任意一个班级都能显示
 * - 白板以 title 作为 class_name 参与匹配
 */
import { describe, expect, it } from 'vitest';
import { filterHistorySessions, type HistoryFilterClass } from './seat-checkin-history-filter';

const classes: HistoryFilterClass[] = [
  { id: 'c-a', name: '计算机1班', college_id: 'col-1', students: ['张三', '李四'] },
  { id: 'c-b', name: '计算机2班', college_id: 'col-1', students: ['王五', '赵六'] },
  { id: 'c-c', name: '外语1班', college_id: 'col-2', students: ['孙七'] },
];

// 签到会话：class_name = 会话标题
const checkinSessions = [
  { id: 's1', class_name: '计算机1班 周一签到', student_names: ['张三', '李四'] },
  { id: 's2', class_name: '跨班级联合实验', student_names: ['李四', '王五'] },
  { id: 's3', class_name: '外语1班 早读', student_names: ['孙七'] },
  { id: 's4', class_name: '公开讲座', student_names: ['访客A'] },
];

// 白板：BoardPanel 用 title 映射为 class_name
const boards = [
  { id: 'b1', title: '计算机2班 头脑风暴', student_names: [] as string[] },
  { id: 'b2', title: '课堂讨论', student_names: ['张三'] },
  { id: 'b3', title: '公开活动', student_names: [] as string[] },
];
const boardSessions = boards.map(b => ({ board: b, class_name: b.title, student_names: b.student_names }));

const ids = (rows: { id: string }[]) => rows.map(r => r.id);

describe('班级与签到、白板的对应关系', () => {
  it('未选择筛选条件时返回全部记录', () => {
    expect(filterHistorySessions(checkinSessions, classes, {})).toHaveLength(4);
    expect(filterHistorySessions(boardSessions, classes, {})).toHaveLength(3);
  });

  it('按班级筛选签到历史：标题命中 + 名册命中', () => {
    expect(ids(filterHistorySessions(checkinSessions, classes, { classId: 'c-a' }))).toEqual(['s1', 's2']);
    expect(ids(filterHistorySessions(checkinSessions, classes, { classId: 'c-b' }))).toEqual(['s2']);
    expect(ids(filterHistorySessions(checkinSessions, classes, { classId: 'c-c' }))).toEqual(['s3']);
  });

  it('跨班级签到在任一关联班级下都可见，且不会串到无关班级', () => {
    const cross = checkinSessions.filter(s => s.id === 's2');
    expect(filterHistorySessions(cross, classes, { classId: 'c-a' })).toHaveLength(1);
    expect(filterHistorySessions(cross, classes, { classId: 'c-b' })).toHaveLength(1);
    expect(filterHistorySessions(cross, classes, { classId: 'c-c' })).toHaveLength(0);
  });

  it('按学院筛选聚合该学院所有班级的签到记录', () => {
    expect(ids(filterHistorySessions(checkinSessions, classes, { collegeId: 'col-1' }))).toEqual(['s1', 's2']);
    expect(ids(filterHistorySessions(checkinSessions, classes, { collegeId: 'col-2' }))).toEqual(['s3']);
  });

  it('白板历史使用相同契约：标题匹配班级名或名册重叠', () => {
    expect(ids(filterHistorySessions(boardSessions, classes, { classId: 'c-b' }).map(x => x.board))).toEqual(['b1']);
    expect(ids(filterHistorySessions(boardSessions, classes, { classId: 'c-a' }).map(x => x.board))).toEqual(['b2']);
    expect(ids(filterHistorySessions(boardSessions, classes, { collegeId: 'col-1' }).map(x => x.board))).toEqual(['b1', 'b2']);
    expect(filterHistorySessions(boardSessions, classes, { collegeId: 'col-2' })).toHaveLength(0);
  });

  it('无关记录（公开讲座 / 公开活动）不会出现在任何班级下', () => {
    for (const cls of classes) {
      expect(ids(filterHistorySessions(checkinSessions, classes, { classId: cls.id }))).not.toContain('s4');
      expect(ids(filterHistorySessions(boardSessions, classes, { classId: cls.id }).map(x => x.board))).not.toContain('b3');
    }
  });

  it('班级库为空或所选班级不存在时返回空结果，而非全部', () => {
    expect(filterHistorySessions(checkinSessions, [], { classId: 'c-a' })).toHaveLength(0);
    expect(filterHistorySessions(boardSessions, classes, { classId: 'not-exist' })).toHaveLength(0);
  });

  it('姓名含空格/全角空格时仍能匹配名册', () => {
    const messy = [{ id: 'm1', class_name: '临时会话', student_names: [' 张　三 '] }];
    expect(filterHistorySessions(messy, classes, { classId: 'c-a' })).toHaveLength(1);
  });
});
