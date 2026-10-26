// Runtime glue that lets the background service code (originally written for the
// Deno edge runtime under supabase/functions) run inside this site's own server.
// Generated modules import { Deno, createServe } from here.

type EdgeHandler = (req: Request) => Response | Promise<Response>;

function readEnv(key: string): string | undefined {
  const env = typeof process !== "undefined" ? process.env : ({} as Record<string, string | undefined>);
  const direct = env[key];
  if (direct) return direct;
  if (key === "SUPABASE_ANON_KEY") {
    return env["SUPABASE_PUBLISHABLE_KEY"] || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);
  }
  if (key === "SUPABASE_URL") return import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return undefined;
}

export const Deno = {
  env: {
    get: readEnv,
    toObject: () => ({ ...(typeof process !== "undefined" ? process.env : {}) }),
  },
};

/** Captures the handler a module passes to serve()/Deno.serve(). */
export function createServe() {
  let registered: EdgeHandler | null = null;
  const serve = (handler: EdgeHandler) => {
    registered = handler;
  };
  const handler = async (req: Request): Promise<Response> => {
    if (!registered) throw new Error("edge function did not register a handler");
    return await registered(req);
  };
  return { serve, handler };
}
