import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function CodeVisualizerTool({ code }: { code?: string }) {
  const [open, setOpen] = useState(false);
  // 生成带代码参数的 PythonTutor URL
  const getUrl = () => {
    if (!code) return 'https://pythontutor.com/visualize.html';
    const encoded = encodeURIComponent(code);
    // 只支持 Python3，其他语言可扩展
    return `https://pythontutor.com/visualize.html#code=${encoded}&cumulative=false&heapPrimitives=nevernest&mode=edit&origin=opt-frontend.js&py=3&rawInputLstJSON=%5B%5D&textReferences=false`;
  };
  return (
    <div>
      <Button variant="outline" className="w-full flex gap-2 items-center" onClick={() => setOpen(true)}>
        <ExternalLink className="w-5 h-5" /> 代码可视化
      </Button>
      {open && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-4xl w-full relative" style={{height:'80vh'}} onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="absolute top-2 right-2" onClick={() => setOpen(false)}>关闭</Button>
            <iframe
              src={getUrl()}
              title="Python Tutor 可视化"
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
