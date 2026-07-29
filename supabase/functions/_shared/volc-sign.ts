// 火山引擎 Visual (即梦/Seedream) API 签名工具 —— Volcengine Signature V4
// Region 固定 cn-north-1，Service 固定 cv，Host 固定 visual.volcengineapi.com

const enc = new TextEncoder();

async function hmac(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return new Uint8Array(sig);
}

function hex(buf: Uint8Array): string {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return hex(new Uint8Array(digest));
}

export interface VolcVisualOptions {
  accessKeyId: string;
  secretAccessKey: string;
  action: string;
  version?: string;
  body: unknown;
  region?: string;
  service?: string;
  host?: string;
}

export async function callVolcVisual(opts: VolcVisualOptions): Promise<Response> {
  const region = opts.region ?? "cn-north-1";
  const service = opts.service ?? "cv";
  const host = opts.host ?? "visual.volcengineapi.com";
  const version = opts.version ?? "2022-08-31";


  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const payload = JSON.stringify(opts.body);
  const payloadHash = await sha256Hex(payload);

  const canonicalQuery = `Action=${encodeURIComponent(opts.action)}&Version=${encodeURIComponent(version)}`;
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-content-sha256:${payloadHash}\n` +
    `x-date:${amzDate}\n`;

  const canonicalRequest = [
    "POST",
    "/",
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  let key = await hmac(enc.encode(opts.secretAccessKey.trim()), dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, service);
  key = await hmac(key, "request");
  const signature = hex(await hmac(key, stringToSign));

  const authorization =
    `HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return await fetch(`https://${host}/?${canonicalQuery}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: host,
      "X-Date": amzDate,
      "X-Content-Sha256": payloadHash,
      Authorization: authorization,
    },
    body: payload,
  });
}
