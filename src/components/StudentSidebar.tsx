import { useState, useRef, useEffect, useMemo } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseStudentsFromText, type Student } from '@/hooks/useStudentStore';
import { User, Plus, Trash2, Upload, X, PanelLeftClose, PanelLeftOpen, ClipboardPaste, Download, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

interface Props {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenLibrary?: () => void;
}

export default function StudentSidebar({ onClose, collapsed, onToggleCollapse, onOpenLibrary }: Props) {
  const { students, addStudent, removeStudent, clearAll, importFromText, appendFromText } = useStudents();
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (collapsed) {
      setImportOpen(false);
    }
  }, [collapsed]);

  const handleIconKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, action?: () => void) => {
    if (!action) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const handleAdd = () => {
    if (newName.trim()) {
      addStudent(newName);
      setNewName('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  // Parse + validate the current import text on the fly.
  const preview = useMemo(() => {
    const parsed = parseStudentsFromText(importText);
    const rawLineCount = importText
      .replace(/^\uFEFF/, '')
      .split(/\r\n|[\n\r\u2028\u2029]/)
      .map(l => l.trim())
      .filter(Boolean).length;
    // Header row is stripped by the parser when detected, so account for it.
    const hasHeader = /姓名|name/i.test(importText.split(/\r?\n/)[0] ?? '');
    const expected = hasHeader ? Math.max(0, rawLineCount - 1) : rawLineCount;
    const skipped = Math.max(0, expected - parsed.length);

    const existingNames = new Set(students.map(s => s.name.trim()));
    const seen = new Map<string, number>();
    const rows = parsed.map((s) => {
      const name = s.name.trim();
      const issues: Array<{ kind: 'error' | 'warn' | 'info'; key: string }> = [];
      if (!name) issues.push({ kind: 'error', key: 'sidebar.issueMissingName' });
      const prev = seen.get(name) ?? 0;
      if (prev > 0) issues.push({ kind: 'error', key: 'sidebar.issueDupInImport' });
      seen.set(name, prev + 1);
      if (existingNames.has(name)) issues.push({ kind: 'warn', key: 'sidebar.issueDupInRoster' });
      if (!s.gender || s.gender === 'unknown') issues.push({ kind: 'info', key: 'sidebar.issueOptionalMissing' });
      return { student: s, issues };
    });

    const dupCount = rows.filter(r => r.issues.some(i => i.key === 'sidebar.issueDupInImport')).length;
    const validCount = rows.filter(r => !r.issues.some(i => i.kind === 'error')).length;
    return { rows, skipped, dupCount, validCount, total: rows.length };
  }, [importText, students]);

  const handleImport = () => {
    if (preview.validCount === 0) {
      toast({ title: t('sidebar.importNothing'), variant: 'destructive' });
      return;
    }
    // De-duplicate within the import while preserving order.
    const seen = new Set<string>();
    const deduped: Student[] = [];
    preview.rows.forEach(({ student }) => {
      const name = student.name.trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      deduped.push(student);
    });
    const text = deduped
      .map(s => [s.name, s.gender ?? '', s.organization ?? '', s.title ?? ''].join(','))
      .join('\n');
    // Prepend a header row so the parser keeps gender/org/title columns.
    importFromText(`姓名,性别,单位,职务\n${text}`);
    setImportText('');
    setImportOpen(false);
    toast({ title: t('sidebar.importConfirm'), description: `${deduped.length} ${t('sidebar.persons')}` });
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        importFromText(text);
        toast({ title: t('sidebar.pasteSuccess'), description: `${text.trim().split(/\n/).filter(Boolean).length} ${t('sidebar.persons')}` });
      }
    } catch {
      toast({ title: t('sidebar.pasteFailed'), variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    if (students.length === 0) return;
    const text = students.map(s => s.name).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${t('sidebar.studentList')}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: t('sidebar.downloadSuccess') });
  };

  const handleDownloadTemplate = () => {
    // UTF-8 BOM so Excel renders Chinese headers correctly
    const BOM = '\uFEFF';
    const rows = [
      ['姓名', '性别', '单位', '职务'],
      ['张三', '男', '物理学院', '组长'],
      ['李四', '女', '化学学院', '组员'],
      ['王五', '男', '生物学院', '副组长'],
    ];
    const csv = BOM + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = '学生名单导入模板.csv';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: t('sidebar.downloadSuccess') });
  };

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={250}>
        <div
          className="w-10 border-r border-border bg-card flex flex-col h-full items-center py-3 gap-2 transition-[width] duration-150 ease-out"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                onKeyDown={(e) => handleIconKeyDown(e, onToggleCollapse)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                title={t('sidebar.expandPanel')}
                aria-label={t('sidebar.expandPanel')}
                type="button"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.expandPanel')}</TooltipContent>
          </Tooltip>
        <span className="text-xs text-muted-foreground font-medium writing-vertical">{students.length}{t('sidebar.persons')}</span>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
    <div className="w-64 border-r border-border bg-card flex flex-col h-full min-h-0 overflow-hidden transition-[width] duration-150 ease-out">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">📋</span>
            <h2 className="font-semibold text-foreground">{t('sidebar.studentList')}</h2>
          </div>
          <div className="flex items-center gap-1">
            {onOpenLibrary && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenLibrary}
                    onKeyDown={(e) => handleIconKeyDown(e, onOpenLibrary)}
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                    title={t('sidebar.library')}
                    aria-label={t('sidebar.library')}
                    type="button"
                  >
                    <Building2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('sidebar.library')}</TooltipContent>
              </Tooltip>
            )}
            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-medium">
              {students.length} {t('sidebar.persons')}
            </span>
            {onToggleCollapse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleCollapse}
                    onKeyDown={(e) => handleIconKeyDown(e, onToggleCollapse)}
                    className="hidden lg:flex p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                    title={t('sidebar.collapsePanel')}
                    aria-label={t('sidebar.collapsePanel')}
                    type="button"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('sidebar.collapsePanel')}</TooltipContent>
              </Tooltip>
            )}
            {onClose && (
              <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-muted transition-colors text-muted-foreground" aria-label="关闭学生名单侧边栏">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {students.map((student) => (
          <div
            key={student.id}
            className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 text-sm text-foreground truncate">{student.name}</span>
            <button
              onClick={() => removeStudent(student.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`移除学生 ${student.name}`}
            >
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" aria-hidden="true" />
            </button>

          </div>
        ))}
        {students.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t('sidebar.noStudents')}
          </div>
        )}
      </div>

      {/* Bottom Actions - no longer sticky, just a normal bottom section */}
      <div className="flex-shrink-0 p-3 border-t border-border bg-card space-y-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        {/* Add student row */}
        <div className="flex gap-1.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={t('sidebar.addStudent')}
            className="h-9 text-sm"
          />
          <Button size="sm" variant="ghost" onClick={handleAdd} className="h-9 px-2.5">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {/* Action buttons row */}
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePasteFromClipboard} className="flex-1 h-8 text-xs font-medium min-w-0" title={t('sidebar.paste')}>
            <ClipboardPaste className="w-3 h-3 mr-1 flex-shrink-0" /> {t('sidebar.paste')}
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs font-medium min-w-0">
                <Upload className="w-3 h-3 mr-1 flex-shrink-0" /> {t('sidebar.import')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('sidebar.importTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t('sidebar.importPaste')}</p>
                  <Textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder="姓名,性别,单位,职务&#10;张三,男,物理学院,组长&#10;李四,女,化学学院,组员"
                    rows={6}
                  />
                </div>
                <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{t('sidebar.importFile')}</p>
                    <input ref={fileRef} type="file" accept=".txt,.csv" onChange={handleFileUpload} className="text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{t('sidebar.templateHint')}</p>
                    <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="w-full">
                      <Download className="w-3 h-3 mr-1.5" /> {t('sidebar.downloadTemplate')}
                    </Button>
                  </div>
                </div>

                {/* Preview & validation */}
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{t('sidebar.previewTitle')}</p>
                    {preview.total > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t('sidebar.previewSummary')
                          .replace('{valid}', String(preview.validCount))
                          .replace('{dup}', String(preview.dupCount))
                          .replace('{skipped}', String(preview.skipped))}
                      </span>
                    )}
                  </div>

                  {preview.total === 0 ? (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-4 text-center">
                      {t('sidebar.previewEmpty')}
                    </p>
                  ) : (
                    <>
                      {preview.dupCount > 0 && (
                        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>{t('sidebar.fixHintDup')}</span>
                        </div>
                      )}
                      {preview.skipped > 0 && (
                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md px-3 py-2">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>{t('sidebar.fixHintHeader')}</span>
                        </div>
                      )}
                      {students.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {t('sidebar.previewReplaceWarn').replace('{count}', String(students.length))}
                        </p>
                      )}
                      <div className="border border-border rounded-md overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr className="text-left">
                                <th className="px-2 py-1.5 w-8">#</th>
                                <th className="px-2 py-1.5">{t('sidebar.colName')}</th>
                                <th className="px-2 py-1.5">{t('sidebar.colGender')}</th>
                                <th className="px-2 py-1.5">{t('sidebar.colOrg')}</th>
                                <th className="px-2 py-1.5">{t('sidebar.colTitle')}</th>
                                <th className="px-2 py-1.5">{t('sidebar.colIssue')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.rows.map((row, idx) => {
                                const hasError = row.issues.some(i => i.kind === 'error');
                                const hasWarn = row.issues.some(i => i.kind === 'warn');
                                return (
                                  <tr
                                    key={idx}
                                    className={`border-t border-border ${hasError ? 'bg-destructive/5' : hasWarn ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}
                                  >
                                    <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                                    <td className="px-2 py-1.5 font-medium text-foreground">{row.student.name || '—'}</td>
                                    <td className="px-2 py-1.5">{row.student.gender && row.student.gender !== 'unknown' ? (row.student.gender === 'male' ? '男' : '女') : <span className="text-muted-foreground">—</span>}</td>
                                    <td className="px-2 py-1.5">{row.student.organization || <span className="text-muted-foreground">—</span>}</td>
                                    <td className="px-2 py-1.5">{row.student.title || <span className="text-muted-foreground">—</span>}</td>
                                    <td className="px-2 py-1.5">
                                      {row.issues.length === 0 ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-600">
                                          <CheckCircle2 className="w-3 h-3" />
                                        </span>
                                      ) : (
                                        <div className="flex flex-wrap gap-1">
                                          {row.issues.map((iss, i) => (
                                            <span
                                              key={i}
                                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                iss.kind === 'error'
                                                  ? 'bg-destructive/10 text-destructive'
                                                  : iss.kind === 'warn'
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                                    : 'bg-muted text-muted-foreground'
                                              }`}
                                            >
                                              {t(iss.key)}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    onClick={handleImport}
                    disabled={preview.validCount === 0}
                    className="w-full"
                    size="sm"
                  >
                    {t('sidebar.importConfirm')}
                    {preview.validCount > 0 && ` (${preview.validCount})`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={students.length === 0} className="h-8 text-xs font-medium px-2" title={t('sidebar.download')}>
            <Download className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="h-8 text-xs font-medium px-2 text-destructive border-destructive/30 hover:bg-destructive/5" title={t('sidebar.clear')}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
