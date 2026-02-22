import { useState, useCallback, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Shuffle, Star, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ExportButtons from '@/components/ExportButtons';

interface GroupMember { id: string; name: string; isLeader: boolean }
interface Group { id: string; name: string; members: GroupMember[] }

export default function GroupManager() {
  const { students } = useStudents();
  const [groupCount, setGroupCount] = useState(4);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dragItem, setDragItem] = useState<{ groupId: string; memberIdx: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ groupId: string; memberIdx: number } | null>(null);

  const autoGroup = useCallback(() => {
    if (students.length === 0) return;
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const newGroups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
      id: `g_${i}`,
      name: `第${['一','二','三','四','五','六','七','八','九','十'][i] || i + 1}组`,
      members: [],
    }));
    shuffled.forEach((s, i) => {
      newGroups[i % groupCount].members.push({ ...s, isLeader: false });
    });
    setGroups(newGroups);
  }, [students, groupCount]);

  const toggleLeader = (groupId: string, memberId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, members: g.members.map(m => ({ ...m, isLeader: m.id === memberId ? !m.isLeader : false })) };
    }));
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
  };

  // Drag handlers
  const handleDragStart = (groupId: string, memberIdx: number) => {
    setDragItem({ groupId, memberIdx });
  };

  const handleDragOver = (e: React.DragEvent, groupId: string, memberIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ groupId, memberIdx });
  };

  const handleDragOverGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const group = groups.find(g => g.id === groupId);
    if (group) setDropTarget({ groupId, memberIdx: group.members.length });
  };

  const handleDrop = (e: React.DragEvent, targetGroupId: string, targetIdx: number) => {
    e.preventDefault();
    if (!dragItem) return;

    setGroups(prev => {
      const next = prev.map(g => ({ ...g, members: [...g.members] }));
      const srcGroup = next.find(g => g.id === dragItem.groupId)!;
      const dstGroup = next.find(g => g.id === targetGroupId)!;
      const [moved] = srcGroup.members.splice(dragItem.memberIdx, 1);

      // Adjust target index if same group and source is before target
      let insertIdx = targetIdx;
      if (dragItem.groupId === targetGroupId && dragItem.memberIdx < targetIdx) {
        insertIdx = Math.max(0, insertIdx - 1);
      }
      dstGroup.members.splice(insertIdx, 0, moved);
      return next;
    });

    setDragItem(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDropTarget(null);
  };

  const printRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">人员分组</h2>
            <p className="text-sm text-muted-foreground mt-1">将 {students.length} 名学生随机分成若干组，可拖拽调整</p>
          </div>
          <div className="flex items-center gap-3">
            {groups.length > 0 && <ExportButtons targetRef={printRef} filename="分组结果" />}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              组数
              <Input type="number" min={2} max={10} value={groupCount}
                onChange={e => setGroupCount(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="w-16 h-8 text-center" />
            </label>
            <Button onClick={autoGroup} className="gap-2">
              <Shuffle className="w-4 h-4" /> 自动分组
            </Button>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动分组」开始分配学生</p>
            <p className="text-sm">支持 2-10 组，可自定义组名、指定组长、拖拽调整</p>
          </div>
        ) : (
          <div ref={printRef} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {groups.map((group, gi) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05 }}
                  className="bg-card rounded-xl border border-border shadow-card p-4"
                  onDragOver={e => handleDragOverGroup(e, group.id)}
                  onDrop={e => handleDrop(e, group.id, group.members.length)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Input value={group.name} onChange={e => updateGroupName(group.id, e.target.value)}
                      className="h-7 text-sm font-semibold border-none shadow-none px-0 focus-visible:ring-0" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{group.members.length}人</span>
                  </div>
                  <div className="space-y-0.5 min-h-[2rem]">
                    {group.members.map((member, mi) => {
                      const isOver = dropTarget?.groupId === group.id && dropTarget?.memberIdx === mi;
                      const isDragging = dragItem?.groupId === group.id && dragItem?.memberIdx === mi;
                      return (
                        <div key={member.id}>
                          {isOver && <div className="h-0.5 bg-primary rounded-full mx-2 my-0.5" />}
                          <div
                            draggable
                            onDragStart={() => handleDragStart(group.id, mi)}
                            onDragOver={e => handleDragOver(e, group.id, mi)}
                            onDrop={e => { e.stopPropagation(); handleDrop(e, group.id, mi); }}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-1 py-1.5 px-2 rounded-lg hover:bg-muted transition-all cursor-grab active:cursor-grabbing group
                              ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
                          >
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                            <span className="flex-1 text-sm text-foreground">{member.name}</span>
                            <button onClick={() => toggleLeader(group.id, member.id)}
                              className={`transition-all ${member.isLeader ? 'text-warning opacity-100' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'}`}>
                              <Star className="w-4 h-4" fill={member.isLeader ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
