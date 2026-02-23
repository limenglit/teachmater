import { useState, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { User, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props {
  onClose?: () => void;
}

export default function StudentSidebar({ onClose }: Props) {
  const { students, addStudent, removeStudent, clearAll, importFromText } = useStudents();
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

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">📋</span>
            <h2 className="font-semibold text-foreground">学生名单</h2>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-medium">
              {students.length} 人
            </span>
            {onClose && (
              <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="flex-1 overflow-y-auto p-2">
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
            暂无学生，请导入名单
          </div>
        )}
      </div>

      {/* Add Student */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="flex gap-1.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="添加学生..."
            className="h-8 text-sm"
          />
          <Button size="sm" variant="ghost" onClick={handleAdd} className="h-8 px-2">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-1.5">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
                <Upload className="w-3 h-3 mr-1" /> 导入
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>导入学生名单</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">粘贴姓名（每行一个）：</p>
                  <Textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder="张三&#10;李四&#10;王五"
                    rows={8}
                  />
                  <Button onClick={handleImport} className="mt-2 w-full" size="sm">确认导入</Button>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground mb-2">或上传 TXT 文件：</p>
                  <input ref={fileRef} type="file" accept=".txt" onChange={handleFileUpload} className="text-sm" />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={clearAll} className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5">
            <Trash2 className="w-3 h-3 mr-1" /> 清空
          </Button>
        </div>
      </div>
    </div>
  );
}
