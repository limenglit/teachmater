import { useState, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { User, Plus, Trash2, Upload, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function StudentSidebar({ onClose, collapsed, onToggleCollapse }: Props) {
  const { students, addStudent, removeStudent, clearAll, importFromText } = useStudents();
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  if (collapsed) {
    return (
      <div className="w-10 border-r border-border bg-card flex flex-col h-full items-center py-3 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title={t('sidebar.expandPanel')}
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <span className="text-xs text-muted-foreground font-medium writing-vertical">{students.length}{t('sidebar.persons')}</span>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">📋</span>
            <h2 className="font-semibold text-foreground">{t('sidebar.studentList')}</h2>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-medium">
              {students.length} {t('sidebar.persons')}
            </span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                title={t('sidebar.collapsePanel')}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
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
      <div className="flex-1 min-h-0 overflow-y-auto p-2 pb-24">
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

      {/* Add Student */}
      <div className="sticky bottom-0 p-3 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 space-y-2 shadow-[0_-6px_16px_-12px_hsl(var(--foreground)/0.35)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
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
        <div className="flex gap-1.5">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs font-medium">
                <Upload className="w-3 h-3 mr-1" /> {t('sidebar.import')}
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
          <Button variant="outline" size="sm" onClick={clearAll} className="h-8 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/5">
            <Trash2 className="w-3 h-3 mr-1" /> {t('sidebar.clear')}
          </Button>
        </div>
      </div>
    </div>
  );
}
