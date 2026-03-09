import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  Building2, GraduationCap, Plus, Trash2, Edit2, Upload, Download, Check, X,
  ChevronRight, ChevronDown, Users, ArrowRight, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface College { id: string; name: string; user_id: string; }
interface ClassItem { id: string; college_id: string; name: string; user_id: string; }
interface ClassStudent { id: string; class_id: string; name: string; student_number: string; user_id: string; }
interface PreviewRow { college: string; className: string; studentNumber: string; name: string; }

export default function ClassLibrary() {
  const { user } = useAuth();
  const { importFromText } = useStudents();
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [textImportOpen, setTextImportOpen] = useState(false);
  const [textImportContent, setTextImportContent] = useState('');
  const textFileRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    loadAll();
  }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    const [c1, c2, c3] = await Promise.all([
      supabase.from('colleges').select('*').order('name'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('class_students').select('*').order('name'),
    ]);
    if (c1.data) setColleges(c1.data as College[]);
    if (c2.data) setClasses(c2.data as ClassItem[]);
    if (c3.data) setStudents(c3.data as ClassStudent[]);
    setLoading(false);
  };

  const addCollege = async () => {
    if (!newCollegeName.trim() || !userId) return;
    const { data, error } = await supabase.from('colleges').insert({ name: newCollegeName.trim(), user_id: userId }).select().single();
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
    const { data } = await supabase.from('classes').insert({ name: newClassName.trim(), college_id: selectedCollege, user_id: userId }).select().single();
    if (data) { setClasses(prev => [...prev, data as ClassItem]); setNewClassName(''); }
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
    if (classStudents.length === 0) {
      toast({ title: t('library.noStudentsInClass'), variant: 'destructive' });
      return;
    }
    importFromText(classStudents.map(s => s.name).join('\n'));
    toast({ title: t('library.loadedToList'), description: `${classStudents.length} ${t('library.students')}` });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (rows.length < 2) {
          toast({ title: t('library.fileEmpty'), variant: 'destructive' });
          return;
        }

        const preview: PreviewRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 3) continue;
          if (row.length >= 4) {
            preview.push({ college: String(row[0] || '').trim(), className: String(row[1] || '').trim(), studentNumber: String(row[2] || '').trim(), name: String(row[3] || '').trim() });
          } else {
            preview.push({ college: String(row[0] || '').trim(), className: String(row[1] || '').trim(), studentNumber: '', name: String(row[2] || '').trim() });
          }
        }

        setPreviewData(preview.filter(r => r.name && r.college && r.className));
        setImportOpen(true);
      } catch {
        toast({ title: t('library.parseFailed'), variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!userId || previewData.length === 0) return;
    setLoading(true);

    const grouped = new Map<string, Map<string, PreviewRow[]>>();
    for (const row of previewData) {
      if (!grouped.has(row.college)) grouped.set(row.college, new Map());
      const classMap = grouped.get(row.college)!;
      if (!classMap.has(row.className)) classMap.set(row.className, []);
      classMap.get(row.className)!.push(row);
    }

    for (const [collegeName, classMap] of grouped) {
      let college = colleges.find(c => c.name === collegeName);
      if (!college) {
        const { data } = await supabase.from('colleges').insert({ name: collegeName, user_id: userId }).select().single();
        if (data) college = data as College;
      }
      if (!college) continue;

      for (const [className, rows] of classMap) {
        let cls = classes.find(c => c.college_id === college!.id && c.name === className);
        if (!cls) {
          const { data } = await supabase.from('classes').insert({ name: className, college_id: college.id, user_id: userId }).select().single();
          if (data) cls = data as ClassItem;
        }
        if (!cls) continue;

        if (importMode === 'overwrite') {
          await supabase.from('class_students').delete().eq('class_id', cls.id);
        }

        const inserts = rows.map(r => ({ class_id: cls!.id, user_id: userId, name: r.name, student_number: r.studentNumber }));
        await supabase.from('class_students').insert(inserts);
      }
    }

    await loadAll();
    setImportOpen(false);
    setPreviewData([]);
    toast({ title: t('library.importSuccess'), description: `${previewData.length} ${t('library.students')}` });
  };

  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTextImportContent(ev.target?.result as string);
    };
    reader.readAsText(file);
    if (textFileRef.current) textFileRef.current.value = '';
  };

  const confirmTextImport = async () => {
    if (!textImportContent.trim() || !selectedClass || !userId) return;
    const names = textImportContent.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    
    setLoading(true);
    const inserts = names.map(name => ({
      class_id: selectedClass,
      user_id: userId,
      name,
      student_number: ''
    }));
    
    await supabase.from('class_students').insert(inserts);
    await loadAll();
    setTextImportContent('');
    setTextImportOpen(false);
    toast({ title: t('library.importSuccess'), description: `${names.length} ${t('library.students')}` });
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
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('sidebar.studentList'));
    XLSX.writeFile(wb, `${cls?.name || t('sidebar.studentList')}.xlsx`);
  };

  const downloadTemplate = () => {
    const data = [
      ['学生院系', '行政班', '学号', '姓名'],
      ['计算机学院', '计科2201', '220101001', '张三'],
      ['计算机学院', '计科2201', '220101002', '李四'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '学生信息');
    XLSX.writeFile(wb, '学生信息导入模板.xlsx');
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
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('library.title'));
    XLSX.writeFile(wb, `${t('library.title')}.xlsx`);
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
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Tree */}
      <div className="w-56 lg:w-64 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> {t('library.title')}
            </h3>
            <div className="flex gap-1">
              <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleFileSelect} className="hidden" />
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={downloadTemplate}>
                <Download className="w-3 h-3 mr-1" /> {t('library.downloadTemplate')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3 h-3 mr-1" /> {t('library.import')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={exportAllToExcel} disabled={colleges.length === 0}>
                <Download className="w-3 h-3 mr-1" /> {t('library.export')}
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
                className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm
                  ${selectedCollege === college.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-foreground'}`}
                onClick={() => { setSelectedCollege(college.id); setSelectedClass(null); toggleExpand(college.id); }}
              >
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
                      className={`group flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-sm transition-colors
                        ${selectedClass === cls.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                      onClick={() => { setSelectedCollege(college.id); setSelectedClass(cls.id); }}
                    >
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
            <div className="p-3 border-b border-border bg-card flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{currentCollege?.name}</div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" /> {currentClass?.name}
                  <span className="text-xs font-normal text-muted-foreground">({classStudents.length}{t('random.persons')})</span>
                </h3>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setTextImportOpen(true)}>
                  <Upload className="w-3 h-3" /> {t('sidebar.import')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadToWorkspace}>
                  <ArrowRight className="w-3 h-3" /> {t('library.loadToList')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportClassToExcel}>
                  <Download className="w-3 h-3" /> {t('library.export')}
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
            <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
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
            <div className="flex items-center gap-4">
              <label className="text-sm text-foreground">{t('library.existingClassHandling')}</label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={importMode === 'append'} onChange={() => setImportMode('append')} />
                {t('library.append')}
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} />
                {t('library.overwrite')}
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmImport} className="flex-1">{t('library.confirmImport')}</Button>
              <Button variant="outline" onClick={() => setImportOpen(false)}>{t('library.cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
