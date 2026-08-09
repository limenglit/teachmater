import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseStudentsFromText } from '@/hooks/useStudentStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import {
  Building2, GraduationCap, Plus, Trash2, Edit2, Upload, Download, Check, X,
  ChevronRight, ChevronDown, Users, ArrowRight, Loader2, PanelLeftOpen, ArrowUpToLine, GripVertical
} from 'lucide-react';
import { readSpreadsheetFile, writeExcelFile, writeCsvFile } from '@/lib/excel-utils';
import { buildClassRosterPreview, type ClassRosterPreviewRow } from '@/lib/roster-import';
import { setActiveClassName } from '@/lib/class-context';
import { decodeTextBytes } from '@/lib/text-file';
import { buildClassStudentInserts, chunkClassStudentInserts, type ClassStudentInsertRow } from '@/lib/class-roster-import';

interface College { id: string; name: string; user_id: string; sort_order?: number; }
interface ClassItem { id: string; college_id: string; name: string; user_id: string; sort_order?: number; }
interface ClassStudent { id: string; class_id: string; name: string; student_number: string; user_id: string; }
type PreviewRow = ClassRosterPreviewRow;

const CLASS_STUDENTS_PAGE_SIZE = 1000;

interface ClassLibraryProps {
  onBackToList?: () => void;
}

export default function ClassLibrary({ onBackToList }: ClassLibraryProps) {
  const { user } = useAuth();
  const { replaceStudents } = useStudents();
  const { t } = useLanguage();

  const [colleges, setColleges] = useState<College[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [expandedColleges, setExpandedColleges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [newCollegeName, setNewCollegeName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNumber, setNewStudentNumber] = useState('');
  const [editingCollege, setEditingCollege] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importMode, setImportMode] = useState<'overwrite' | 'append'>('append');
  const [importDedupe, setImportDedupe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [textImportOpen, setTextImportOpen] = useState(false);
  const [textImportContent, setTextImportContent] = useState('');
  const [textImportMode, setTextImportMode] = useState<'overwrite' | 'append'>('append');
  const [textDedupe, setTextDedupe] = useState(false);
  const textFileRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;

  const handleIconKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, action?: () => void) => {
    if (!action) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadAll();
  }, [userId]);

  const fetchAllClassStudents = async () => {
    const all: ClassStudent[] = [];
    for (let from = 0; ; from += CLASS_STUDENTS_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('class_students')
        .select('*')
        .order('name')
        .range(from, from + CLASS_STUDENTS_PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data || []) as ClassStudent[];
      all.push(...page);
      if (page.length < CLASS_STUDENTS_PAGE_SIZE) break;
    }
    return all;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c1, c2, classStudents] = await Promise.all([
        supabase.from('colleges').select('*').order('sort_order' as never, { ascending: true }).order('name'),
        supabase.from('classes').select('*').order('sort_order' as never, { ascending: true }).order('name'),
        fetchAllClassStudents(),
      ]);
      if (c1.data) setColleges(c1.data as College[]);
      if (c2.data) setClasses(c2.data as ClassItem[]);
      setStudents(classStudents);
    } catch {
      toast({ title: '班级库加载失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const insertClassStudentRows = async (inserts: ClassStudentInsertRow[]) => {
    for (const batch of chunkClassStudentInserts(inserts)) {
      const { error } = await supabase.from('class_students').insert(batch as never);
      if (error) throw error;
    }
  };

  const addCollege = async () => {
    if (!newCollegeName.trim() || !userId) return;
    const maxOrder = colleges.reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0);
    const { data, error } = await supabase.from('colleges').insert({ name: newCollegeName.trim(), user_id: userId, sort_order: maxOrder + 1 } as never).select().single();
    if (data) { setColleges(prev => [...prev, data as College]); setNewCollegeName(''); }
    if (error) toast({ title: t('library.addFailed'), variant: 'destructive' });
  };

  const deleteCollege = async (id: string) => {
    await supabase.from('colleges').delete().eq('id', id);
    setColleges(prev => prev.filter(c => c.id !== id));
    setClasses(prev => prev.filter(c => c.college_id !== id));
    if (selectedCollege === id) { setSelectedCollege(null); setSelectedClass(null); }
  };

  const saveCollegeEdit = async (id: string) => {
    if (!editName.trim()) return;
    await supabase.from('colleges').update({ name: editName.trim() }).eq('id', id);
    setColleges(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
    setEditingCollege(null);
  };

  const addClass = async () => {
    if (!newClassName.trim() || !selectedCollege || !userId) return;
    const siblingMax = classes.filter(c => c.college_id === selectedCollege).reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0);
    const { data } = await supabase.from('classes').insert({ name: newClassName.trim(), college_id: selectedCollege, user_id: userId, sort_order: siblingMax + 1 } as never).select().single();
    if (data) { setClasses(prev => [...prev, data as ClassItem]); setNewClassName(''); }
  };

  // ===== Reorder helpers (pin-to-top + drag) =====
  const persistCollegeOrder = async (ordered: College[]) => {
    setColleges(ordered);
    await Promise.all(
      ordered.map((c, idx) => supabase.from('colleges').update({ sort_order: idx + 1 } as never).eq('id', c.id)),
    );
  };

  const persistClassOrder = async (collegeId: string, ordered: ClassItem[]) => {
    setClasses(prev => {
      const others = prev.filter(c => c.college_id !== collegeId);
      return [...others, ...ordered];
    });
    await Promise.all(
      ordered.map((c, idx) => supabase.from('classes').update({ sort_order: idx + 1 } as never).eq('id', c.id)),
    );
  };

  const pinCollege = async (id: string) => {
    const target = colleges.find(c => c.id === id);
    if (!target) return;
    const next = [target, ...colleges.filter(c => c.id !== id)];
    await persistCollegeOrder(next);
    toast({ title: '已置顶学院', description: target.name });
  };

  const pinClass = async (id: string) => {
    const target = classes.find(c => c.id === id);
    if (!target) return;
    const siblings = classes.filter(c => c.college_id === target.college_id);
    const next = [target, ...siblings.filter(c => c.id !== id)];
    await persistClassOrder(target.college_id, next);
    toast({ title: '已置顶班级', description: target.name });
  };

  const [draggingCollegeId, setDraggingCollegeId] = useState<string | null>(null);
  const [draggingClass, setDraggingClass] = useState<{ id: string; collegeId: string } | null>(null);

  const handleCollegeDrop = async (targetId: string) => {
    if (!draggingCollegeId || draggingCollegeId === targetId) { setDraggingCollegeId(null); return; }
    const fromIdx = colleges.findIndex(c => c.id === draggingCollegeId);
    const toIdx = colleges.findIndex(c => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDraggingCollegeId(null); return; }
    const next = [...colleges];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraggingCollegeId(null);
    await persistCollegeOrder(next);
  };

  const handleClassDrop = async (targetId: string, collegeId: string) => {
    if (!draggingClass || draggingClass.collegeId !== collegeId || draggingClass.id === targetId) { setDraggingClass(null); return; }
    const siblings = classes.filter(c => c.college_id === collegeId);
    const fromIdx = siblings.findIndex(c => c.id === draggingClass.id);
    const toIdx = siblings.findIndex(c => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDraggingClass(null); return; }
    const next = [...siblings];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraggingClass(null);
    await persistClassOrder(collegeId, next);
  };

  const deleteClass = async (id: string) => {
    await supabase.from('classes').delete().eq('id', id);
    setClasses(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.filter(s => s.class_id !== id));
    if (selectedClass === id) setSelectedClass(null);
  };

  const saveClassEdit = async (id: string) => {
    if (!editName.trim()) return;
    await supabase.from('classes').update({ name: editName.trim() }).eq('id', id);
    setClasses(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
    setEditingClass(null);
  };

  const addStudent = async () => {
    if (!newStudentName.trim() || !selectedClass || !userId) return;
    const { data } = await supabase.from('class_students').insert({ name: newStudentName.trim(), student_number: newStudentNumber.trim(), class_id: selectedClass, user_id: userId }).select().single();
    if (data) { setStudents(prev => [...prev, data as ClassStudent]); setNewStudentName(''); setNewStudentNumber(''); }
  };

  const deleteStudent = async (id: string) => {
    await supabase.from('class_students').delete().eq('id', id);
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const saveStudentEdit = async (id: string) => {
    if (!editName.trim()) return;
    await supabase.from('class_students').update({ name: editName.trim() }).eq('id', id);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, name: editName.trim() } : s));
    setEditingStudent(null);
  };

  const loadToWorkspace = () => {
    if (!selectedClass) return;
    const classStudents = students.filter(s => s.class_id === selectedClass);
    const selectedClassItem = classes.find(c => c.id === selectedClass);
    if (classStudents.length === 0) {
      toast({ title: t('library.noStudentsInClass'), variant: 'destructive' });
      return;
    }
    // Keep 学号 so the seating "学号顺序" rule can sort by it.
    replaceStudents(classStudents.map(s => ({
      id: s.id,
      name: s.name,
      gender: 'unknown' as const,
      studentNumber: s.student_number || undefined,
    })));
    setActiveClassName(selectedClassItem?.name || '');
    toast({ title: t('library.loadedToList'), description: `${classStudents.length} ${t('library.students')}` });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows: any[][] = await readSpreadsheetFile(file);

      if (rows.length < 1) {
        toast({ title: t('library.fileEmpty'), variant: 'destructive' });
        return;
      }

      const warnings: string[] = [];
      const fallbackClass = selectedClass ? classes.find(c => c.id === selectedClass) : null;
      const fallbackCollege = fallbackClass ? colleges.find(c => c.id === fallbackClass.college_id) : null;
      const defaultCollegeName = fallbackCollege?.name || '未分类院系';
      const defaultClassName = fallbackClass?.name || '未分类班级';
      const { preview, skippedRows, usedDefaultClass } = buildClassRosterPreview(rows, { defaultCollegeName, defaultClassName });

      // Check for garbled encoding (common sign: replacement chars survived decoding)
      const allText = preview.map(r => r.name + r.college + r.className).join('');
      const garbledChars = (allText.match(/[\ufffd]/g) || []).length;
      if (allText.length > 0 && garbledChars > 0 && garbledChars / allText.length > 0.05) {
        warnings.push('检测到疑似编码问题（乱码），请将 CSV 文件另存为 UTF-8 编码后重试');
      }

      if (skippedRows > 0) warnings.push(`已跳过 ${skippedRows} 个空行或缺少姓名的行`);
      if (!selectedClass && usedDefaultClass) {
        warnings.push('部分行未填写院系/班级，已使用「未分类」占位，可在选中目标班级后重新导入');
      }

      if (preview.length === 0) {
        toast({ title: t('library.fileEmpty'), variant: 'destructive' });
        return;
      }

      if (warnings.length > 0) {
        toast({ title: '导入预览提示', description: warnings.join('；') });
      }

      setPreviewData(preview);
      setImportOpen(true);
    } catch {
      toast({ title: t('library.parseFailed'), description: '文件解析失败，请检查文件格式或编码（建议使用 UTF-8 编码的 .xlsx 或 .csv 文件）', variant: 'destructive' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!userId || previewData.length === 0) return;
    setLoading(true);
    try {
      const grouped = new Map<string, Map<string, PreviewRow[]>>();
      for (const row of previewData) {
        if (!grouped.has(row.college)) grouped.set(row.college, new Map());
        const classMap = grouped.get(row.college)!;
        if (!classMap.has(row.className)) classMap.set(row.className, []);
        classMap.get(row.className)!.push(row);
      }

      let totalInserted = 0;
      let totalSkippedByDedupe = 0;

      for (const [collegeName, classMap] of grouped) {
        let college = colleges.find(c => c.name === collegeName);
        if (!college) {
          const { data, error } = await supabase.from('colleges').insert({ name: collegeName, user_id: userId }).select().single();
          if (error) throw error;
          if (data) college = data as College;
        }
        if (!college) continue;

        for (const [className, rows] of classMap) {
          let cls = classes.find(c => c.college_id === college!.id && c.name === className);
          if (!cls) {
            const { data, error } = await supabase.from('classes').insert({ name: className, college_id: college.id, user_id: userId }).select().single();
            if (error) throw error;
            if (data) cls = data as ClassItem;
          }
          if (!cls) continue;

          if (importMode === 'overwrite') {
            const { error } = await supabase.from('class_students').delete().eq('class_id', cls.id);
            if (error) throw error;
          }

          let effectiveRows = rows;
          if (importDedupe) {
            const existing = importMode === 'overwrite'
              ? new Set<string>()
              : new Set(students.filter(s => s.class_id === cls!.id).map(s => `${s.name}|${s.student_number || ''}`));
            const seenBatch = new Set<string>();
            effectiveRows = [];
            for (const row of rows) {
              const key = `${row.name}|${row.studentNumber || ''}`;
              if (existing.has(key) || seenBatch.has(key)) {
                totalSkippedByDedupe++;
                continue;
              }
              seenBatch.add(key);
              effectiveRows.push(row);
            }
          }

          const inserts = buildClassStudentInserts(effectiveRows, cls.id, userId);
          await insertClassStudentRows(inserts);
          totalInserted += inserts.length;
        }
      }

      await loadAll();
      setImportOpen(false);
      setPreviewData([]);

      const desc = [
        `成功导入 ${totalInserted} 名学生`,
        importDedupe && totalSkippedByDedupe > 0 ? `去重跳过 ${totalSkippedByDedupe} 名` : '',
      ].filter(Boolean).join('；');
      toast({
        title: totalInserted > 0 ? t('library.importSuccess') : '无新增学生',
        description: desc,
        variant: totalInserted > 0 ? 'default' : 'destructive',
      });
    } catch {
      toast({ title: '导入失败', description: '名单未完整写入，请稍后重试', variant: 'destructive' });
      setLoading(false);
    }
  };

  const handleTextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = decodeTextBytes(await file.arrayBuffer());
      // Detect encoding issues
      const garbledChars = (text.match(/[�\ufffd]/g) || []).length;
      if (garbledChars > 0 && text.length > 0 && garbledChars / text.length > 0.05) {
        toast({
          title: '编码问题',
          description: '检测到文件可能存在编码问题（乱码），请确认文件编码为 UTF-8 后重试',
          variant: 'destructive',
        });
      }
      setTextImportContent(text);
    } catch {
      toast({ title: t('library.parseFailed'), variant: 'destructive' });
    } finally {
      if (textFileRef.current) textFileRef.current.value = '';
    }
  };

  const confirmTextImport = async () => {
    if (!textImportContent.trim() || !selectedClass || !userId) return;
    // 与「学校/导入」一致：保留解析出的学号列，供按学号排座使用。
    const rawEntries = parseStudentsFromText(textImportContent)
      .map(student => ({ name: student.name.trim(), studentNumber: (student.studentNumber || '').trim() }))
      .filter(s => s.name);
    if (rawEntries.length === 0) return;

    // Build warning messages
    const warnings: string[] = [];
    const emptyLineCount = textImportContent.split(/\r\n|[\n\r\u2028\u2029]/).length - rawEntries.length;
    if (emptyLineCount > 0) {
      warnings.push(`已跳过 ${emptyLineCount} 个空行`);
    }

    setLoading(true);
    try {
      if (textImportMode === 'overwrite') {
        const { error } = await supabase.from('class_students').delete().eq('class_id', selectedClass);
        if (error) throw error;
      }

      let effectiveEntries = rawEntries;
      let dedupeSkipped = 0;
      if (textDedupe) {
        const keyOf = (name: string, no: string) => `${name}|${no}`;
        const existing = textImportMode === 'overwrite'
          ? new Set<string>()
          : new Set(students.filter(s => s.class_id === selectedClass).map(s => keyOf(s.name, s.student_number || '')));
        const seen = new Set<string>();
        effectiveEntries = [];
        for (const entry of rawEntries) {
          const key = keyOf(entry.name, entry.studentNumber);
          if (existing.has(key) || seen.has(key)) { dedupeSkipped++; continue; }
          seen.add(key);
          effectiveEntries.push(entry);
        }
      }

      const inserts = effectiveEntries.map(entry => ({
        class_id: selectedClass,
        user_id: userId,
        name: entry.name,
        student_number: entry.studentNumber,
      }));

      await insertClassStudentRows(inserts);
      await loadAll();
      setTextImportContent('');
      setTextImportOpen(false);

      const desc = [
        `成功导入 ${effectiveNames.length} 名学生`,
        textDedupe && dedupeSkipped > 0 ? `去重跳过 ${dedupeSkipped} 名` : '',
        ...warnings,
      ].filter(Boolean).join('；');
      toast({ title: t('library.importSuccess'), description: desc });
    } catch {
      toast({ title: '导入失败', description: '名单未完整写入，请稍后重试', variant: 'destructive' });
      setLoading(false);
    }
  };

  const exportClassToExcel = () => {
    if (!selectedClass) return;
    const cls = classes.find(c => c.id === selectedClass);
    const college = cls ? colleges.find(c => c.id === cls.college_id) : null;
    const classStudents = students.filter(s => s.class_id === selectedClass);

    const data = [
      [t('library.college'), t('library.class'), t('library.studentNumber'), t('library.studentName')],
      ...classStudents.map(s => [college?.name || '', cls?.name || '', s.student_number, s.name]),
    ];
    writeExcelFile(data, t('sidebar.studentList'), `${cls?.name || t('sidebar.studentList')}.xlsx`);
  };

  const downloadTemplate = () => {
    const data = [
      ['学生院系', '行政班', '学号', '姓名'],
      ['计算机学院', '计科2201', '220101001', '张三'],
      ['计算机学院', '计科2201', '220101002', '李四'],
      ['', '', '', '王五'],
    ];
    writeExcelFile(data, '学生信息', '学生信息导入模板.xlsx');
    // Also offer a UTF-8 BOM CSV so Excel on zh-CN opens it without garbling characters
    writeCsvFile(data, '学生信息导入模板.csv');
  };

  const exportAllToExcel = () => {
    const data: string[][] = [[t('library.college'), t('library.class'), t('library.studentNumber'), t('library.studentName')]];
    for (const college of colleges) {
      const collegeClasses = classes.filter(c => c.college_id === college.id);
      for (const cls of collegeClasses) {
        const classStudents = students.filter(s => s.class_id === cls.id);
        for (const s of classStudents) {
          data.push([college.name, cls.name, s.student_number, s.name]);
        }
      }
    }
    writeExcelFile(data, t('library.title'), `${t('library.title')}.xlsx`);
  };

  const toggleExpand = (id: string) => {
    setExpandedColleges(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const collegeClasses = selectedCollege ? classes.filter(c => c.college_id === selectedCollege) : [];
  const classStudents = selectedClass ? students.filter(s => s.class_id === selectedClass) : [];
  const currentClass = selectedClass ? classes.find(c => c.id === selectedClass) : null;
  const currentCollege = currentClass ? colleges.find(c => c.id === currentClass.college_id) : null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
    <div className="flex-1 flex overflow-hidden transition-opacity duration-150">
      {onBackToList && (
        <div className="w-10 border-r border-border bg-card flex flex-col h-full items-center py-3 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onBackToList}
                onKeyDown={(e) => handleIconKeyDown(e, onBackToList)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                title={t('sidebar.current')}
                aria-label={t('sidebar.current')}
                type="button"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.current')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1.5 rounded-lg bg-accent text-accent-foreground"
                title={t('sidebar.library')}
                aria-label={t('sidebar.library')}
                type="button"
              >
                <Building2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.library')}</TooltipContent>
          </Tooltip>
        </div>
      )}
      {/* Left: Tree */}
      <div className="w-56 lg:w-64 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 min-w-0 truncate">
              <Building2 className="w-4 h-4" /> {t('library.title')}
            </h3>
            <div className="flex flex-wrap justify-end gap-1 shrink-0">
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv,.txt,.tsv" onChange={handleFileSelect} className="hidden" />
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs whitespace-nowrap" onClick={downloadTemplate} title={t('library.downloadTemplate')}>
                <Download className="w-3 h-3 mr-0 sm:mr-1" />
                <span className="hidden sm:inline">{t('library.downloadTemplate')}</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs whitespace-nowrap" onClick={() => fileRef.current?.click()} title={t('library.import')}>
                <Upload className="w-3 h-3 mr-0 sm:mr-1" />
                <span className="hidden sm:inline">{t('library.import')}</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs whitespace-nowrap" onClick={exportAllToExcel} disabled={colleges.length === 0} title={t('library.export')}>
                <Download className="w-3 h-3 mr-0 sm:mr-1" />
                <span className="hidden sm:inline">{t('library.export')}</span>
              </Button>
            </div>
          </div>
          <div className="flex gap-1">
            <Input
              value={newCollegeName}
              onChange={e => setNewCollegeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCollege()}
              placeholder={t('library.addCollege')}
              className="h-7 text-xs"
            />
            <Button size="sm" variant="ghost" onClick={addCollege} className="h-7 px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {colleges.map(college => (
            <div key={college.id}>
              <div
                draggable
                onDragStart={e => { setDraggingCollegeId(college.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => { if (draggingCollegeId && draggingCollegeId !== college.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                onDrop={e => { e.preventDefault(); void handleCollegeDrop(college.id); }}
                onDragEnd={() => setDraggingCollegeId(null)}
                className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm
                  ${selectedCollege === college.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-foreground'}
                  ${draggingCollegeId === college.id ? 'opacity-50' : ''}`}
                onClick={() => { setSelectedCollege(college.id); setSelectedClass(null); toggleExpand(college.id); }}
                title="拖动可调整顺序"
              >
                <GripVertical className="w-3 h-3 flex-shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing" onClick={e => e.stopPropagation()} />
                {expandedColleges.has(college.id) ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                {editingCollege === college.id ? (
                  <Input value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCollegeEdit(college.id); if (e.key === 'Escape') setEditingCollege(null); }}
                    onBlur={() => saveCollegeEdit(college.id)} className="h-5 text-xs flex-1" autoFocus onClick={e => e.stopPropagation()} />
                ) : (
                  <span className="flex-1 truncate">{college.name}</span>
                )}
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                  <button onClick={e => { e.stopPropagation(); void pinCollege(college.id); }} title="置顶">
                    <ArrowUpToLine className="w-3 h-3 text-muted-foreground hover:text-primary" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setEditingCollege(college.id); setEditName(college.name); }}>
                    <Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteCollege(college.id); }}>
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
              {expandedColleges.has(college.id) && (
                <div className="ml-4 space-y-0.5">
                  {classes.filter(c => c.college_id === college.id).map(cls => (
                    <div key={cls.id}
                      draggable
                      onDragStart={e => { setDraggingClass({ id: cls.id, collegeId: college.id }); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }}
                      onDragOver={e => { if (draggingClass && draggingClass.collegeId === college.id && draggingClass.id !== cls.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                      onDrop={e => { e.preventDefault(); e.stopPropagation(); void handleClassDrop(cls.id, college.id); }}
                      onDragEnd={() => setDraggingClass(null)}
                      className={`group flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-sm transition-colors
                        ${selectedClass === cls.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}
                        ${draggingClass?.id === cls.id ? 'opacity-50' : ''}`}
                      onClick={() => { setSelectedCollege(college.id); setSelectedClass(cls.id); }}
                      title="拖动可调整顺序"
                    >
                      <GripVertical className="w-3 h-3 flex-shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing" onClick={e => e.stopPropagation()} />
                      <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                      {editingClass === cls.id ? (
                        <Input value={editName} onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveClassEdit(cls.id); if (e.key === 'Escape') setEditingClass(null); }}
                          onBlur={() => saveClassEdit(cls.id)} className="h-5 text-xs flex-1" autoFocus onClick={e => e.stopPropagation()} />
                      ) : (
                        <span className="flex-1 truncate">{cls.name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {students.filter(s => s.class_id === cls.id).length}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                        <button onClick={e => { e.stopPropagation(); void pinClass(cls.id); }} title="置顶">
                          <ArrowUpToLine className="w-3 h-3 text-muted-foreground hover:text-primary" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setEditingClass(cls.id); setEditName(cls.name); }}>
                          <Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteClass(cls.id); }}>
                          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {selectedCollege === college.id && (
                    <div className="flex gap-1 px-2 py-1">
                      <Input value={newClassName} onChange={e => setNewClassName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addClass()} placeholder={t('library.addClass')} className="h-6 text-xs" />
                      <Button size="sm" variant="ghost" onClick={addClass} className="h-6 px-1.5">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {colleges.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <p>{t('library.noColleges')}</p>
              <p className="mt-1">{t('library.noCollegesHint')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Student list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedClass ? (
          <>
            <div className="p-3 border-b border-border bg-card flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{currentCollege?.name}</div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 min-w-0">
                  <GraduationCap className="w-4 h-4" /> {currentClass?.name}
                  <span className="text-xs font-normal text-muted-foreground">({classStudents.length}{t('random.persons')})</span>
                </h3>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 whitespace-nowrap" onClick={() => setTextImportOpen(true)} title={t('sidebar.import')}>
                  <Upload className="w-3 h-3" /> <span className="hidden sm:inline">{t('sidebar.import')}</span>
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 whitespace-nowrap" onClick={loadToWorkspace} title={t('library.loadToList')}>
                  <ArrowRight className="w-3 h-3" /> <span className="hidden sm:inline">{t('library.loadToList')}</span>
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 whitespace-nowrap" onClick={exportClassToExcel} title={t('library.export')}>
                  <Download className="w-3 h-3" /> <span className="hidden sm:inline">{t('library.export')}</span>
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {classStudents.map(s => (
                <div key={s.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
                  {editingStudent === s.id ? (
                    <>
                      <Input value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveStudentEdit(s.id); if (e.key === 'Escape') setEditingStudent(null); }}
                        className="h-7 text-sm flex-1" autoFocus />
                      <Button size="sm" variant="ghost" onClick={() => saveStudentEdit(s.id)} className="h-7 px-1.5"><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingStudent(null)} className="h-7 px-1.5"><X className="w-3 h-3" /></Button>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      {s.student_number && <span className="text-xs text-muted-foreground w-16 truncate">{s.student_number}</span>}
                      <span className="flex-1 text-sm text-foreground">{s.name}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                        <button onClick={() => { setEditingStudent(s.id); setEditName(s.name); }}><Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => deleteStudent(s.id)}><Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-border flex gap-1.5">
              <Input value={newStudentNumber} onChange={e => setNewStudentNumber(e.target.value)} placeholder={t('library.studentNumber')} className="h-7 text-xs w-20" />
              <Input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStudent()} placeholder={t('library.studentName')} className="h-7 text-xs flex-1" />
              <Button size="sm" variant="ghost" onClick={addStudent} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <GraduationCap className="w-10 h-10 mx-auto opacity-30" />
              <p>{t('library.selectClass')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Excel import preview dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('library.importPreview')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('library.recordsParsed')} <span className="font-medium text-foreground">{previewData.length}</span> {t('library.records')}
            </p>
            <div className="max-h-[min(55vh,26rem)] overflow-y-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('library.college')}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('library.class')}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('library.studentNumber')}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('library.studentName')}</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1 text-foreground">{r.college}</td>
                      <td className="px-2 py-1 text-foreground">{r.className}</td>
                      <td className="px-2 py-1 text-muted-foreground">{r.studentNumber}</td>
                      <td className="px-2 py-1 text-foreground">{r.name}</td>
                    </tr>
                  ))}
                  {previewData.length > 50 && (
                    <tr><td colSpan={4} className="px-2 py-1 text-center text-muted-foreground">{t('library.moreRecords').replace('{0}', String(previewData.length - 50))}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="text-sm text-foreground">{t('library.existingClassHandling')}</label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={importMode === 'append'} onChange={() => setImportMode('append')} />
                {(() => {
                  const targets = new Set(previewData.map(r => `${r.college}||${r.className}`));
                  let existing = 0;
                  for (const key of targets) {
                    const [cn, kn] = key.split('||');
                    const col = colleges.find(c => c.name === cn);
                    const cls = col ? classes.find(c => c.college_id === col.id && c.name === kn) : null;
                    if (cls) existing += students.filter(s => s.class_id === cls.id).length;
                  }
                  return `${t('library.append')}（保留现有 ${existing} 人）`;
                })()}
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} />
                {t('library.overwrite')}
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer ml-auto">
                <input type="checkbox" checked={importDedupe} onChange={e => setImportDedupe(e.target.checked)} />
                去重
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmImport} className="flex-1">{t('library.confirmImport')}</Button>
              <Button variant="outline" onClick={() => setImportOpen(false)}>{t('library.cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Text import dialog */}
      <Dialog open={textImportOpen} onOpenChange={setTextImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sidebar.importTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('sidebar.importPaste')}</p>
              <Textarea
                value={textImportContent}
                onChange={e => setTextImportContent(e.target.value)}
                placeholder="张三&#10;李四&#10;王五"
                rows={8}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                <label className="text-sm text-foreground">{t('library.existingClassHandling')}</label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={textImportMode === 'append'} onChange={() => setTextImportMode('append')} />
                  {t('library.append')}（保留现有 {classStudents.length} 人）
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={textImportMode === 'overwrite'} onChange={() => setTextImportMode('overwrite')} />
                  {t('library.overwrite')}
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer ml-auto">
                  <input type="checkbox" checked={textDedupe} onChange={e => setTextDedupe(e.target.checked)} />
                  去重
                </label>
              </div>
              <Button onClick={confirmTextImport} className="mt-2 w-full" size="sm">{t('sidebar.importConfirm')}</Button>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-2">{t('sidebar.importFile')}</p>
              <input ref={textFileRef} type="file" accept=".txt" onChange={handleTextFileUpload} className="text-sm" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
