import { describe, it, expect } from 'vitest';
import { buildClassRosterPreview, resolveRosterColumns, normalizeHeaderCell } from './roster-import';

describe('normalizeHeaderCell', () => {
  it('lowercases and strips whitespace/punctuation', () => {
    expect(normalizeHeaderCell('  Student Name ')).toBe('studentname');
    expect(normalizeHeaderCell('学号/工号')).toBe('学号工号');
    expect(normalizeHeaderCell('Full_Name')).toBe('fullname');
    expect(normalizeHeaderCell('班级（行政班）')).toBe('班级行政班');
  });
});

describe('resolveRosterColumns - alias tolerance', () => {
  it('maps Chinese canonical headers', () => {
    expect(resolveRosterColumns(['院系', '班级', '学号', '姓名'])).toEqual({
      collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3,
    });
  });

  it('maps English headers (Name/Class/Department/Student ID)', () => {
    expect(resolveRosterColumns(['Department', 'Class', 'Student ID', 'Name'])).toEqual({
      collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3,
    });
  });

  it('handles "学生姓名" without colliding with college/class', () => {
    const r = resolveRosterColumns(['学生姓名', '学院', '行政班', '工号']);
    expect(r.nameCol).toBe(0);
    expect(r.collegeCol).toBe(1);
    expect(r.classCol).toBe(2);
    expect(r.numberCol).toBe(3);
  });

  it('supports "full_name" / "Faculty" / "Grade" / "No."', () => {
    const r = resolveRosterColumns(['Faculty', 'Grade', 'No.', 'full_name']);
    expect(r).toEqual({ collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3 });
  });

  it('supports 单位 / 部门 alias for college', () => {
    const r = resolveRosterColumns(['姓名', '单位', '班级']);
    expect(r.nameCol).toBe(0);
    expect(r.collegeCol).toBe(1);
    expect(r.classCol).toBe(2);
  });

  it('reorders columns regardless of position', () => {
    const r = resolveRosterColumns(['姓名', '学号', '班级', '院系']);
    expect(r.nameCol).toBe(0);
    expect(r.numberCol).toBe(1);
    expect(r.classCol).toBe(2);
    expect(r.collegeCol).toBe(3);
  });

  it('handles 学号/工号 combined header', () => {
    const r = resolveRosterColumns(['学号/工号', '姓名', '性别', '单位/学院', '专业', '班级']);
    expect(r.numberCol).toBe(0);
    expect(r.nameCol).toBe(1);
    expect(r.collegeCol).toBe(3);
    expect(r.classCol).toBe(5);
  });

  it('falls back to legacy positional layout when headers are unknown', () => {
    const r = resolveRosterColumns(['A', 'B', 'C', 'D']);
    expect(r).toEqual({ collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3 });
  });

  it('name-only single column still resolves nameCol', () => {
    const r = resolveRosterColumns(['姓名']);
    expect(r.nameCol).toBe(0);
  });
});

describe('buildClassRosterPreview - row preservation', () => {
  it('imports a headerless one-column 30-person spreadsheet without treating first row as a header', () => {
    const rows = Array.from({ length: 30 }, (_, i) => [`学生${String(i + 1).padStart(2, '0')}`]);
    const result = buildClassRosterPreview(rows, {
      defaultCollegeName: '默认学院',
      defaultClassName: '默认班级',
    });

    expect(result.preview).toHaveLength(30);
    expect(result.skippedRows).toBe(0);
    expect(result.preview.map(row => row.name)).toEqual(rows.map(row => row[0]));
    expect(result.preview.every(row => row.college === '默认学院' && row.className === '默认班级')).toBe(true);
  });

  it('preserves same-name rows in class-library spreadsheet imports instead of deduplicating 30 to 27', () => {
    const names = [
      '学生01',
      '学生02', '学生02',
      '学生03', '学生03',
      ...Array.from({ length: 25 }, (_, i) => `学生${String(i + 4).padStart(2, '0')}`),
    ];
    const rows = [
      ['院系', '班级', '学号', '姓名'],
      ...names.map((name, index) => ['文学院', '一班', String(index + 1), name]),
    ];

    const result = buildClassRosterPreview(rows);

    expect(result.preview).toHaveLength(30);
    expect(result.skippedRows).toBe(0);
    expect(result.preview.map(row => row.name)).toEqual(names);
    expect(result.preview.filter(row => row.name === '学生02')).toHaveLength(2);
    expect(result.preview.filter(row => row.name === '学生03')).toHaveLength(2);
  });

  it('preserves all rows from a 59-person class-library import with repeated names', () => {
    const names = [
      '闫振华','郑灿灿','李名莉','刘亚闯','张子扬','马欢欢','晋懿普','常文博','魏三营','文紫薇',
      '郭文超','耿卓凡','王增华','贾小朋','许庆峰','胡志涛','李志林','李晓苗','胡瑞','徐亚光',
      '柴佳新','宋沛乐','杨凯丽','黄帅娜','李自玉','柴晓芳','李泽坤','张山','陈牧','袁素君',
      '王宇晨','潘振南','杨琦琦','侯英','孙源','王文花','李甜甜','左东祥','谢耀坤','邹洪亮',
      '张明阳','关庆辉','祝夏斌','贺秀秀','陈闻欣','魏宁宁','张昕','李啸林','张姗姗','刘志敏',
      '陈艺文','邢淏鑫','毕博文','魏华阳','姚梦娟','郭宇航','陈明月','闫丽娟','黄帅娜'
    ];
    const result = buildClassRosterPreview(names.map(name => [name]));

    expect(result.preview).toHaveLength(59);
    expect(result.preview.map(row => row.name)).toEqual(names);
    expect(result.preview.filter(row => row.name === '黄帅娜')).toHaveLength(2);
  });
});
