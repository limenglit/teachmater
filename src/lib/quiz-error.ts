/**
 * Unified error handling for the quiz module.
 *
 * - classifyQuizError(error): returns a user-readable Chinese message and a
 *   semantic kind (network / timeout / auth / server / rls / app).
 * - withTimeout(promise, ms): rejects after `ms` so a hung request can be
 *   surfaced and retried.
 * - runQuizCall(fn, opts): wraps a Supabase call with timeout + optional retry
 *   on transient errors (network/server/timeout). Auth/RLS errors never retry.
 *
 * Designed to keep call sites short:
 *   const { data, error, kind, message } = await runQuizCall(
 *     () => supabase.rpc('foo', { ... }),
 *     { timeoutMs: 8000, retries: 1 },
 *   );
 *   if (error) toast({ title: message, variant: 'destructive' });
 */

export type QuizErrorKind =
  | 'network'    // offline / fetch failure / CORS
  | 'timeout'    // request did not respond in time
  | 'auth'       // 401 / session expired / not authenticated
  | 'forbidden'  // 403 / RLS denial / role check failed
  | 'notfound'   // 404 / row missing
  | 'conflict'   // 409 / already submitted / unique violation
  | 'server'     // 5xx
  | 'app'        // application-level (validation, RPC RAISE)
  | 'unknown';

export interface ClassifiedError {
  kind: QuizErrorKind;
  /** Short Chinese message safe to show in a toast. */
  message: string;
  /** Whether retrying the same call is likely to help. */
  retryable: boolean;
  /** Original error for logging. */
  original: unknown;
}

const NETWORK_HINTS = [
  'failed to fetch', 'networkerror', 'load failed', 'fetch failed',
  'err_internet', 'err_network', 'err_connection', 'net::',
];

export function classifyQuizError(error: unknown): ClassifiedError {
  if (!error) {
    return { kind: 'unknown', message: '未知错误', retryable: false, original: error };
  }

  // AbortError from our timeout wrapper
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { kind: 'timeout', message: '请求超时，请检查网络后重试', retryable: true, original: error };
  }
  if ((error as any)?.name === 'AbortError' || (error as any)?.code === 20) {
    return { kind: 'timeout', message: '请求超时，请检查网络后重试', retryable: true, original: error };
  }

  const anyErr = error as any;
  const rawMsg: string = String(anyErr?.message || anyErr?.error_description || anyErr || '');
  const lower = rawMsg.toLowerCase();
  const status: number | undefined =
    typeof anyErr?.status === 'number' ? anyErr.status
    : typeof anyErr?.statusCode === 'number' ? anyErr.statusCode
    : undefined;
  const code: string | undefined = typeof anyErr?.code === 'string' ? anyErr.code : undefined;

  // Network — TypeError from fetch is the most common signal
  if (anyErr instanceof TypeError || NETWORK_HINTS.some(h => lower.includes(h))) {
    return { kind: 'network', message: '网络连接失败，请检查网络后重试', retryable: true, original: error };
  }

  // Auth — Supabase returns 401 with explicit messages on expired JWT
  if (status === 401 || lower.includes('jwt expired') || lower.includes('invalid jwt') || lower.includes('not authenticated')) {
    return { kind: 'auth', message: '登录已过期，请重新登录后再操作', retryable: false, original: error };
  }

  // Forbidden / RLS — Postgres permission denials surface as 403 or 42501
  if (status === 403 || code === '42501' || lower.includes('permission denied') || lower.includes('unauthorized') || lower.includes('row-level security')) {
    return { kind: 'forbidden', message: '没有权限执行此操作', retryable: false, original: error };
  }

  if (status === 404 || code === 'pgrst116' || lower.includes('not found')) {
    return { kind: 'notfound', message: '资源不存在或已被删除', retryable: false, original: error };
  }

  // Conflicts (e.g. submit_quiz_answers "Already submitted", unique violation 23505)
  if (status === 409 || code === '23505' || lower.includes('already submitted') || lower.includes('duplicate key')) {
    return { kind: 'conflict', message: rawMsg.includes('Already submitted') ? '你已提交过本次测验，无法重复提交' : '数据冲突，请刷新后重试', retryable: false, original: error };
  }

  if (typeof status === 'number' && status >= 500 && status < 600) {
    return { kind: 'server', message: '服务器繁忙，请稍后重试', retryable: true, original: error };
  }

  // Application-level (RAISE EXCEPTION from RPC) — return the message verbatim so
  // teachers see "Student name not found in session roster" etc.
  if (rawMsg) {
    return { kind: 'app', message: rawMsg, retryable: false, original: error };
  }

  return { kind: 'unknown', message: '操作失败，请稍后重试', retryable: true, original: error };
}

/** Reject the underlying promise if it doesn't settle within `ms`. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => {
      reject(new DOMException('Request timed out', 'AbortError'));
    }, ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(handle); resolve(v); },
      (e) => { clearTimeout(handle); reject(e); },
    );
  });
}

export interface RunQuizCallOptions {
  /** Max ms before the call is aborted with a timeout error. Default 10s. */
  timeoutMs?: number;
  /** Extra retry attempts on transient errors. Default 0. */
  retries?: number;
  /** Base backoff in ms; doubles each attempt. Default 400. */
  backoffMs?: number;
}

export interface QuizCallResult<T> {
  data: T | null;
  error: ClassifiedError | null;
}

/**
 * Wrap a Supabase call (`{ data, error }` shape) with timeout, classification,
 * and optional retry on transient failures.
 */
export async function runQuizCall<T>(
  fn: () => PromiseLike<{ data: T | null; error: any }>,
  opts: RunQuizCallOptions = {},
): Promise<QuizCallResult<T>> {
  const { timeoutMs = 10_000, retries = 0, backoffMs = 400 } = opts;
  let lastClassified: ClassifiedError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const res = await withTimeout(Promise.resolve(fn()), timeoutMs);
      if (!res.error) return { data: res.data, error: null };
      lastClassified = classifyQuizError(res.error);
      if (!lastClassified.retryable) return { data: null, error: lastClassified };
    } catch (thrown) {
      lastClassified = classifyQuizError(thrown);
      if (!lastClassified.retryable) return { data: null, error: lastClassified };
    }
  }

  return { data: null, error: lastClassified ?? classifyQuizError(new Error('Unknown error')) };
}

/**
 * Defensive sanitizer for quiz session payloads coming from the server.
 * Backend rows can be malformed (missing `type`, null options, non-array
 * correct_answer, etc.) when imported, migrated, or hand-edited. Rather than
 * crashing the student page, drop invalid questions and coerce fields to safe
 * defaults so the rest of the quiz renders.
 *
 * Returns `{ questions, dropped }` so the UI can warn when items were skipped.
 */
const VALID_TYPES = new Set(['single', 'multi', 'tf', 'short']);
export function sanitizeQuizQuestions(raw: unknown): {
  questions: Array<{
    type: 'single' | 'multi' | 'tf' | 'short';
    content: string;
    options: string[];
    correct_answer?: string | string[];
  }>;
  dropped: number;
} {
  if (!Array.isArray(raw)) return { questions: [], dropped: 0 };
  const out: any[] = [];
  let dropped = 0;
  for (const q of raw) {
    if (!q || typeof q !== 'object') { dropped++; continue; }
    const type = VALID_TYPES.has((q as any).type) ? (q as any).type : 'single';
    const content = typeof (q as any).content === 'string' ? (q as any).content : '';
    if (!content.trim()) { dropped++; continue; }
    let options: string[] = Array.isArray((q as any).options)
      ? (q as any).options.map((o: unknown) => (o == null ? '' : String(o)))
      : [];
    if (type === 'tf' && options.length < 2) options = ['正确', '错误'];
    if ((type === 'single' || type === 'multi') && options.filter(o => o.trim()).length < 2) {
      // not enough options to render — skip
      dropped++; continue;
    }
    const correct_answer = (q as any).correct_answer;
    out.push({
      type, content, options,
      correct_answer: Array.isArray(correct_answer) || typeof correct_answer === 'string'
        ? correct_answer : '',
    });
  }
  return { questions: out, dropped };
}

