// supabase-js for the ported background services. Opaque sb_ keys are not JWTs:
// send them only as apikey so the backend accepts them (same rule as client.server).
import { createClient as baseCreateClient } from "@supabase/supabase-js";

export * from "@supabase/supabase-js";

function keyAwareFetch(key: string, inner?: typeof fetch): typeof fetch {
  const doFetch = inner ?? fetch;
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return doFetch(input, { ...init, headers });
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(url: string, key: string, options: any = {}): any {
  return baseCreateClient(url, key, {
    ...options,
    auth: { persistSession: false, autoRefreshToken: false, ...(options.auth ?? {}) },
    global: { ...(options.global ?? {}), fetch: keyAwareFetch(key, options.global?.fetch) },
  });
}
