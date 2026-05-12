import { useState } from 'react';
import { Copy, Check, Code, ShieldAlert, CheckCircle, AlertCircle, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EndpointSectionProps {
  method: string;
  path: string;
  description: string;
}

function EndpointSection({ method, path, description }: EndpointSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">
          {method}
        </span>
        <code className="text-sm font-mono text-foreground bg-muted px-2 py-0.5 rounded">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  lang?: string;
}

function CodeBlock({ code, lang = 'json' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/80 rounded-xl p-4 overflow-x-auto text-xs font-mono leading-relaxed text-foreground">
        <code>{code.trim()}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">API 文档</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            以下说明生成词库卡片（generate-vocab-cards）端点的请求与响应格式。
          </p>
        </div>

        {/* Endpoint */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            端点
          </h2>
          <EndpointSection
            method="POST"
            path="/functions/v1/generate-vocab-cards"
            description="通过 Lovable Cloud Edge Function 调用。需要有效的 Bearer Token 进行身份验证。"
          />
        </section>

        {/* Auth */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            认证
          </h2>
          <p className="text-sm text-muted-foreground">
            所有请求必须在 <code>Authorization</code> 请求头中携带有效的 Bearer Token：
          </p>
          <CodeBlock code={`Authorization: Bearer <access_token>`} lang="http" />
        </section>

        {/* Request */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            请求体
          </h2>
          <CodeBlock
            code={JSON.stringify(
              {
                topic: "string (必填) — 生成主题",
                count: "number (可选) — 卡片数量，范围 2~40，默认 10",
                audience: "string (可选) — 适用对象说明",
                hint: "string (可选) — 补充说明"
              },
              null,
              2
            )}
          />
          <p className="text-sm text-muted-foreground">
            示例：围绕主题 "Python 基础" 生成 6 对卡片：
          </p>
          <CodeBlock
            code={`POST /functions/v1/generate-vocab-cards
Content-Type: application/json
Authorization: Bearer eyJhbG...

{
  "topic": "Python 基础",
  "count": 6,
  "audience": "初中信息课",
  "hint": "侧重基础语法"
}`}
            lang="http"
          />
        </section>

        {/* Success Response */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            成功响应 — 200 OK
          </h2>
          <CodeBlock
            code={JSON.stringify(
              {
                cards: [
                  {
                    word: "string — 题面/术语/英文/缩写",
                    definition: "string — 中文释义/解释/对照",
                    example: "string (可选) — 一句话示例"
                  }
                ]
              },
              null,
              2
            )}
          />
          <p className="text-sm text-muted-foreground">
            返回的 <code>cards</code> 数组长度至少为 2，每张卡片包含必填的 <code>word</code> 和 <code>definition</code>，以及可选的 <code>example</code>。
          </p>
        </section>

        {/* Error Responses */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            错误响应
          </h2>

          <div className="space-y-6">
            {/* 401 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-500/10 text-red-500">
                  401 Unauthorized
                </span>
              </div>
              <CodeBlock code={`{ "error": "Unauthorized" }`} />
              <p className="text-sm text-muted-foreground">缺少或无效的 Bearer Token。</p>
            </div>

            {/* 429 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-500">
                  429 Too Many Requests
                </span>
              </div>
              <CodeBlock code={`{ "error": "已达今日 AI 使用上限" }`} />
              <p className="text-sm text-muted-foreground">当前用户今日 AI 配额已耗尽。</p>
            </div>

            {/* 422 — sanitized */}
            <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-500">
                  422 Unprocessable Entity
                </span>
                <span className="text-xs text-amber-600 font-medium">已脱敏</span>
              </div>
              <CodeBlock code={`{ "error": "AI 未返回有效卡片，请换个主题再试" }`} />
              <p className="text-sm text-muted-foreground">
                当上游 AI 返回的卡片数量不足（少于 2 张）或格式校验失败时，返回此统一脱敏错误。响应中<strong>不包含</strong>任何原始解析错误、JSON 语法错误、工具调用详情或 schema 描述，避免向客户端泄露内部实现细节。
              </p>
            </div>

            {/* 500 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-500/10 text-red-500">
                  500 Internal Server Error
                </span>
              </div>
              <CodeBlock code={`{ "error": "AI 生成失败，请稍后重试" }`} />
              <p className="text-sm text-muted-foreground">AI 服务调用失败（包括主服务和降级服务均不可用）。</p>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            响应摘要
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">状态码</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">场景</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">响应体</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-green-600">200</td>
                  <td className="py-2 pr-4">成功生成 ≥2 张有效卡片</td>
                  <td className="py-2 font-mono">{"{ cards: [...] }"}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-red-500">401</td>
                  <td className="py-2 pr-4">未认证</td>
                  <td className="py-2 font-mono">{"{ error: \"Unauthorized\" }"}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-amber-500">422</td>
                  <td className="py-2 pr-4">卡片不足或格式无效（已脱敏）</td>
                  <td className="py-2 font-mono">{"{ error: \"AI 未返回有效卡片，请换个主题再试\" }"}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-amber-500">429</td>
                  <td className="py-2 pr-4">AI 配额耗尽</td>
                  <td className="py-2 font-mono">{"{ error: \"已达今日 AI 使用上限\" }"}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-red-500">500</td>
                  <td className="py-2 pr-4">AI 服务调用失败</td>
                  <td className="py-2 font-mono">{"{ error: \"AI 生成失败，请稍后重试\" }"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
