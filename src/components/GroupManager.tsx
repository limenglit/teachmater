import { useState, useCallback } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Shuffle, Star, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface Group {
  id: string;
  name: string;
  members: { id: string; name: string; isLeader: boolean }[];
}

export default function GroupManager() {
  const { students } = useStudents();
  const [groupCount, setGroupCount] = useState(4);
  const [groups, setGroups] = useState<Group[]>([]);

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
      return {
        ...g,
        members: g.members.map(m => ({
          ...m,
          isLeader: m.id === memberId ? !m.isLeader : false,
        })),
      };
    }));
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">人员分组</h2>
            <p className="text-sm text-muted-foreground mt-1">将 {students.length} 名学生随机分成若干组</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              组数
              <Input
                type="number"
                min={2}
                max={10}
                value={groupCount}
                onChange={e => setGroupCount(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="w-16 h-8 text-center"
              />
            </label>
            <Button onClick={autoGroup} className="gap-2">
              <Shuffle className="w-4 h-4" /> 自动分组
            </Button>
          </div>
        </div>

        {/* Group cards */}
        {groups.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动分组」开始分配学生</p>
            <p className="text-sm">支持 2-10 组，可自定义组名和指定组长</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {groups.map((group, gi) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05 }}
                  className="bg-card rounded-xl border border-border shadow-card p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      value={group.name}
                      onChange={e => updateGroupName(group.id, e.target.value)}
                      className="h-7 text-sm font-semibold border-none shadow-none px-0 focus-visible:ring-0"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {group.members.length}人
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <span className="flex-1 text-sm text-foreground">{member.name}</span>
                        <button
                          onClick={() => toggleLeader(group.id, member.id)}
                          className={`transition-all ${
                            member.isLeader
                              ? 'text-warning opacity-100'
                              : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Star className="w-4 h-4" fill={member.isLeader ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    ))}
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
