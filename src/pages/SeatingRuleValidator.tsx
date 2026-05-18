import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, XCircle, FileText, Trash2 } from 'lucide-react';
import { parseStudentsFromText, type Student } from '@/hooks/useStudentStore';
import { runAllRules, type RuleReport } from '@/lib/seating-rules';

interface DatasetResult {
  fileName: string;
  studentCount: number;
  students: Student[];
  reports: RuleReport[];
  error?: string;
}

const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });

export default function SeatingRuleValidator() {
  const [results, setResults] = useState<DatasetResult[]>([]);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const next: DatasetResult[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await readFile(file);
        const students = parseStudentsFromText(text);
        if (students.length === 0) {
          next.push({ fileName: file.name, studentCount: 0, students: [], reports: [], error: '未解析到任何学生' });
          continue;
        }
        const reports = runAllRules(students);
        next.push({ fileName: file.name, studentCount: students.length, students, reports });
      } catch (e) {
        next.push({ fileName: file.name, studentCount: 0, students: [], reports: [], error: String(e) });
      }
    }
    setResults(prev => [...prev, ...next]);
    setBusy(false);
  }, []);

  const clear = () => setResults([]);

  const summary = results.reduce(
    (acc, r) => {
      r.reports.forEach(rep => { acc.total++; if (rep.pass) acc.passed++; });
      return acc;
    },
    { total: 0, passed: 0 },
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold">排座规则回归校验</h1>
          <p className="text-muted-foreground text-sm">
            上传一份或多份学生名单（CSV / TXT），自动运行智能集中、男女交错、按单位集中等规则，并输出每条规则的通过 / 失败原因。
          </p>
        </header>

        <Card className="p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition">
              <Upload className="w-4 h-4" />
              <span>{busy ? '解析中…' : '选择名单文件'}</span>
              <input
                type="file"
                accept=".csv,.txt"
                multiple
                hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              />
            </label>
            {results.length > 0 && (
              <>
                <Badge variant="outline" className="text-sm">
                  数据集 {results.length} / 规则总数 {summary.total} / 通过 {summary.passed}
                </Badge>
                <Button variant="ghost" size="sm" onClick={clear} className="gap-1">
                  <Trash2 className="w-4 h-4" /> 清空
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            提示：支持 <code className="px-1 bg-muted rounded">docs/test-rosters/</code> 下的所有测试名单（智慧教室/音乐厅/宴会厅 等）。
          </p>
        </Card>

        {results.map((dataset, idx) => (
          <Card key={idx} className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-medium">{dataset.fileName}</h2>
                <Badge variant="secondary">{dataset.studentCount} 人</Badge>
              </div>
              {dataset.reports.length > 0 && (
                <Badge variant={dataset.reports.every(r => r.pass) ? 'default' : 'destructive'}>
                  {dataset.reports.filter(r => r.pass).length} / {dataset.reports.length} 规则通过
                </Badge>
              )}
            </div>

            {dataset.error && (
              <p className="text-sm text-destructive">解析失败：{dataset.error}</p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {dataset.reports.map(rep => (
                <div
                  key={rep.ruleId}
                  className={`rounded-md border p-3 space-y-2 ${rep.pass ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20' : 'border-red-200 bg-red-50/40 dark:bg-red-950/20'}`}
                >
                  <div className="flex items-center gap-2">
                    {rep.pass
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <XCircle className="w-4 h-4 text-red-600" />}
                    <span className="font-medium text-sm">{rep.ruleLabel}</span>
                  </div>

                  {rep.stats && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(rep.stats).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="text-xs font-normal">
                          {k}: {v}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {rep.issues.length > 0 ? (
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      {rep.issues.map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">所有检查项通过。</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}

        {results.length === 0 && !busy && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            尚未上传任何名单。可以从 <code className="px-1 bg-muted rounded">docs/test-rosters/</code> 拖入 CSV / TXT 一键校验。
          </Card>
        )}
      </div>
    </div>
  );
}
