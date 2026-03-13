import { useState, useRef, useEffect } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { User, Plus, Trash2, Upload, X, PanelLeftClose, PanelLeftOpen, ClipboardPaste, Download, Building2 } from 'lucide-react';
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
  const { students, addStudent, removeStudent, clearAll, importFromText } = useStudents();
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
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
      importFromText(text);
      setImportOpen(false);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (importText.trim()) {
      importFromText(importText);
      setImportText('');
      setImportOpen(false);
    }
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
              <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
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
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-sm text-foreground truncate">{student.name}</span>
            <button
              onClick={() => removeStudent(student.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('sidebar.importTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t('sidebar.importPaste')}</p>
                  <Textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder="张三&#10;李四&#10;王五"
                    rows={8}
                  />
                  <Button onClick={handleImport} className="mt-2 w-full" size="sm">{t('sidebar.importConfirm')}</Button>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground mb-2">{t('sidebar.importFile')}</p>
                  <input ref={fileRef} type="file" accept=".txt" onChange={handleFileUpload} className="text-sm" />
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
