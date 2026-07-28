import { supabase } from '@/integrations/supabase/client';

export interface AIImageHistoryRecord {
  id: string;
  title: string;
  prompt: string;
  doc_text: string;
  chart_type: string;
  sub_style: string;
  params: Record<string, unknown>;
  model: string;
  provider: string;
  size: string;
  storage_path: string;
  created_at: string;
}

const BUCKET = 'ai-images';

async function toBlob(imageUrl: string): Promise<Blob> {
  if (imageUrl.startsWith('data:')) {
    const [meta, b64] = imageUrl.split(',');
    const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/png';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error('下载图片失败');
  return await res.blob();
}

export async function saveAIImageToHistory(input: {
  imageUrl: string;
  title: string;
  prompt: string;
  docText: string;
  chartType: string;
  subStyle: string;
  params: Record<string, unknown>;
  model: string;
  provider: string;
  size: string;
}): Promise<AIImageHistoryRecord | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const blob = await toBlob(input.imageUrl);
  const ext = blob.type.includes('jpeg') ? 'jpg' : blob.type.includes('webp') ? 'webp' : 'png';
  const path = `${uid}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/png', upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('ai_image_history')
    .insert({
      user_id: uid,
      title: input.title.slice(0, 120),
      prompt: input.prompt.slice(0, 4000),
      doc_text: input.docText.slice(0, 2000),
      chart_type: input.chartType,
      sub_style: input.subStyle,
      params: input.params as never,
      model: input.model,
      provider: input.provider,
      size: input.size,
      storage_path: path,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as AIImageHistoryRecord;
}

export async function listAIImageHistory(keyword = ''): Promise<AIImageHistoryRecord[]> {
  let query = supabase
    .from('ai_image_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const kw = keyword.trim();
  if (kw) {
    const safe = kw.replace(/[%,()]/g, ' ');
    query = query.or(`title.ilike.%${safe}%,prompt.ilike.%${safe}%,sub_style.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AIImageHistoryRecord[];
}

export async function getAIImageUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) throw error ?? new Error('无法生成图片链接');
  return data.signedUrl;
}

export async function downloadAIImage(record: AIImageHistoryRecord) {
  const { data, error } = await supabase.storage.from(BUCKET).download(record.storage_path);
  if (error || !data) throw error ?? new Error('下载失败');
  const ext = record.storage_path.split('.').pop() || 'png';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data);
  a.download = `${(record.title || 'ai-image').replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function deleteAIImageHistory(record: AIImageHistoryRecord) {
  await supabase.storage.from(BUCKET).remove([record.storage_path]);
  const { error } = await supabase.from('ai_image_history').delete().eq('id', record.id);
  if (error) throw error;
}
