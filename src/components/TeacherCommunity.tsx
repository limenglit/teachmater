import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, Download } from 'lucide-react';

interface CommunityPost {
  id: string;
  user_id: string;
  author_name: string;
  title: string;
  course: string;
  region: string;
  tags: string[];
  knowledge_points: string[];
  method: string;
  content: string;
  file_url: string;
  file_name: string;
  url: string;
  likes_count: number;
  status: string;
  created_at: string;
  approved_at: string | null;
}

interface CommunityComment {
  id: string;
  post_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export default function TeacherCommunity() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ course: '', region: '', tag: '', keyword: '' });
  const [showUpload, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [showPending, setShowPending] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '', course: '', region: '', tags: '', knowledgePoints: '', method: '', content: '', file: null as File | null, url: ''
  });

  // Generate a stable liker token
  const getLikerToken = () => {
    let token = localStorage.getItem('community_liker_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('community_liker_token', token);
    }
    return token;
  };

  // Load posts
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch approved posts (public) + own pending posts + admin sees all
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts((data as any[]) || []);
    } catch (err: any) {
      console.error('Failed to load community posts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load comments for all posts
  const loadComments = useCallback(async (postIds: string[]) => {
    if (!postIds.length) return;
    const { data, error } = await supabase
      .from('community_comments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load comments:', error);
      return;
    }

    const grouped: Record<string, CommunityComment[]> = {};
    (data as any[])?.forEach(c => {
      if (!grouped[c.post_id]) grouped[c.post_id] = [];
      grouped[c.post_id].push(c);
    });
    setComments(grouped);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (posts.length > 0) {
      loadComments(posts.map(p => p.id));
    }
  }, [posts, loadComments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('community-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => loadPosts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments' }, (payload) => {
        const newComment = payload.new as CommunityComment;
        setComments(prev => ({
          ...prev,
          [newComment.post_id]: [...(prev[newComment.post_id] || []), newComment]
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadPosts]);

  // Filter posts
  const filteredPosts = posts.filter(p => {
    // Visibility: approved posts + own pending + admin sees all pending
    const isOwn = user && p.user_id === user.id;
    const visible = p.status === 'approved' || isOwn || isAdmin;
    if (!visible) return false;

    // If showPending toggle is on (admin), show only pending
    if (showPending && p.status !== 'pending') return false;
    if (!showPending && p.status !== 'approved' && !isOwn) return false;

    const tags = Array.isArray(p.tags) ? p.tags : [];
    return (
      (!filter.course || p.course.includes(filter.course)) &&
      (!filter.region || p.region.includes(filter.region)) &&
      (!filter.tag || tags.some(t => t.includes(filter.tag))) &&
      (!filter.keyword || p.title.includes(filter.keyword) || p.content.includes(filter.keyword))
    );
  });

  // Like
  const handleLike = async (postId: string) => {
    if (likedPosts.has(postId)) return;
    const token = getLikerToken();
    const { error } = await supabase.from('community_likes').insert({ post_id: postId, liker_token: token });
    if (error) {
      if (error.code === '23505') {
        toast({ title: '已经点过赞了', variant: 'destructive' });
      }
      return;
    }
    setLikedPosts(prev => new Set(prev).add(postId));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
  };

  // Comment
  const handleComment = async (postId: string) => {
    const text = commentDraft[postId]?.trim();
    if (!text) return;
    const authorName = user?.email?.split('@')[0] || '匿名';
    const { error } = await supabase.from('community_comments').insert({
      post_id: postId, author_name: authorName, content: text
    });
    if (error) {
      toast({ title: '评论失败', variant: 'destructive' });
      return;
    }
    setCommentDraft(d => ({ ...d, [postId]: '' }));
  };

  // Submit new post
  const handleUpload = async () => {
    if (!user) {
      toast({ title: '请先登录', variant: 'destructive' });
      return;
    }
    if (!newPost.title.trim()) {
      toast({ title: '请填写标题', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      let fileUrl = '';
      let fileName = '';

      // Upload file if present
      if (newPost.file) {
        fileName = newPost.file.name;
        const ext = fileName.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('community-files')
          .upload(path, newPost.file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('community-files').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        author_name: user.email?.split('@')[0] || '匿名',
        title: newPost.title,
        course: newPost.course,
        region: newPost.region,
        tags: newPost.tags ? newPost.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        knowledge_points: newPost.knowledgePoints ? newPost.knowledgePoints.split(',').map(s => s.trim()).filter(Boolean) : [],
        method: newPost.method,
        content: newPost.content,
        file_url: fileUrl,
        file_name: fileName,
        url: newPost.url,
        status: 'pending'
      });

      if (error) throw error;

      toast({ title: '✅ 发布成功，等待管理员审核' });
      setShowUpload(false);
      setNewPost({ title: '', course: '', region: '', tags: '', knowledgePoints: '', method: '', content: '', file: null, url: '' });
      loadPosts();
    } catch (err: any) {
      toast({ title: '发布失败: ' + err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Admin approve/reject
  const handleApprove = async (postId: string) => {
    const { error } = await supabase.from('community_posts')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', postId);
    if (error) {
      toast({ title: '审核失败', variant: 'destructive' });
      return;
    }
    toast({ title: '✅ 已通过审核' });
    loadPosts();
  };

  const handleReject = async (postId: string) => {
    const { error } = await supabase.from('community_posts')
      .update({ status: 'rejected' })
      .eq('id', postId);
    if (error) {
      toast({ title: '操作失败', variant: 'destructive' });
      return;
    }
    toast({ title: '❌ 已拒绝' });
    loadPosts();
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> 已通过</span>;
    if (status === 'pending') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> 待审核</span>;
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> 已拒绝</span>;
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="bg-card rounded-2xl shadow border border-border p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-extrabold text-primary flex items-center gap-2">
            <span>👩‍🏫</span> 教师社区
          </h2>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant={showPending ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowPending(!showPending)}
              >
                🛡️ {showPending ? '查看全部' : '待审核'}
              </Button>
            )}
            {user && (
              <Button className="font-bold" onClick={() => setShowUpload(true)}>+ 发布新主题</Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Input className="rounded-lg max-w-[160px]" placeholder="按课程筛选" value={filter.course} onChange={e => setFilter(f => ({ ...f, course: e.target.value }))} />
          <Input className="rounded-lg max-w-[160px]" placeholder="按地区筛选" value={filter.region} onChange={e => setFilter(f => ({ ...f, region: e.target.value }))} />
          <Input className="rounded-lg max-w-[160px]" placeholder="按标签筛选" value={filter.tag} onChange={e => setFilter(f => ({ ...f, tag: e.target.value }))} />
          <Input className="rounded-lg max-w-[160px]" placeholder="关键词" value={filter.keyword} onChange={e => setFilter(f => ({ ...f, keyword: e.target.value }))} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中...
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredPosts.map(p => {
              const postComments = comments[p.id] || [];
              const tags = Array.isArray(p.tags) ? p.tags : [];
              const kps = Array.isArray(p.knowledge_points) ? p.knowledge_points : [];
              return (
                <div key={p.id} className="border border-border rounded-2xl p-6 bg-card shadow-sm hover:shadow-md transition-all">
                  {/* Status & admin actions */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      {statusBadge(p.status)}
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    {isAdmin && p.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => handleApprove(p.id)}>
                          <CheckCircle className="w-4 h-4 mr-1" /> 通过
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => handleReject(p.id)}>
                          <XCircle className="w-4 h-4 mr-1" /> 拒绝
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Post header */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-foreground shadow">
                        {p.author_name?.[0] || '?'}
                      </div>
                      <div>
                        <span className="font-bold text-lg text-primary">{p.title}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">by {p.author_name} | {p.region} | {p.course}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {tags.map(tag => (
                        <span key={tag} className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs font-semibold">#{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mt-2 text-foreground leading-relaxed text-base">{p.content}</div>
                  {kps.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">知识点：{kps.join('，')} | 方法：{p.method}</div>
                  )}

                  {/* File & Link */}
                  {(p.file_url || p.url) && (
                    <div className="mt-3 flex flex-col gap-2">
                      {p.file_url && (
                        <div className="text-sm text-foreground flex items-center gap-2">
                          <span className="font-semibold">附件：</span>
                          <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="underline text-primary inline-flex items-center gap-1">
                            <Download className="w-3 h-3" /> {p.file_name || '下载'}
                          </a>
                        </div>
                      )}
                      {p.url && (
                        <div className="text-sm text-foreground flex items-center gap-2">
                          <span className="font-semibold">链接：</span>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline text-primary">{p.url}</a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Like & stats */}
                  <div className="mt-4 flex gap-6 items-center">
                    <Button variant="ghost" className="hover:scale-110 transition-transform font-bold text-lg" onClick={() => handleLike(p.id)}>
                      👍 {p.likes_count}
                    </Button>
                    <span className="text-muted-foreground">💬 {postComments.length} 评论</span>
                  </div>

                  {/* Comments */}
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="font-semibold text-sm text-foreground mb-1">评论区</div>
                    {postComments.map(com => (
                      <div key={com.id} className="text-xs text-muted-foreground mb-1">
                        <span className="font-bold text-foreground">{com.author_name}</span>：{com.content}
                        <span className="text-muted-foreground ml-2">{new Date(com.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <Input
                        className="rounded"
                        placeholder="写评论..."
                        value={commentDraft[p.id] || ''}
                        onChange={e => setCommentDraft(d => ({ ...d, [p.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleComment(p.id)}
                      />
                      <Button onClick={() => handleComment(p.id)}>评论</Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredPosts.length === 0 && (
              <div className="text-muted-foreground text-center py-8">
                {showPending ? '暂无待审核的主题' : '暂无符合条件的主题'}
              </div>
            )}
          </div>
        )}

        {/* Upload dialog */}
        {showUpload && (
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-2xl shadow-lg w-full max-w-lg border border-border">
              <h3 className="text-lg font-bold mb-2 text-foreground">发布新主题</h3>
              <p className="text-xs text-muted-foreground mb-4">提交后需管理员审核通过才会公开显示</p>
              <Input className="mb-2 rounded" placeholder="主题标题 *" value={newPost.title} onChange={e => setNewPost(n => ({ ...n, title: e.target.value }))} />
              <Input className="mb-2 rounded" placeholder="课程名" value={newPost.course} onChange={e => setNewPost(n => ({ ...n, course: e.target.value }))} />
              <Input className="mb-2 rounded" placeholder="地区" value={newPost.region} onChange={e => setNewPost(n => ({ ...n, region: e.target.value }))} />
              <Input className="mb-2 rounded" placeholder="标签（逗号分隔）" value={newPost.tags} onChange={e => setNewPost(n => ({ ...n, tags: e.target.value }))} />
              <Input className="mb-2 rounded" placeholder="知识点（逗号分隔）" value={newPost.knowledgePoints} onChange={e => setNewPost(n => ({ ...n, knowledgePoints: e.target.value }))} />
              <Input className="mb-2 rounded" placeholder="教学方法/策略" value={newPost.method} onChange={e => setNewPost(n => ({ ...n, method: e.target.value }))} />
              <Textarea className="mb-2 rounded" placeholder="主题内容/创新点描述" value={newPost.content} onChange={e => setNewPost(n => ({ ...n, content: e.target.value }))} />
              <div className="mb-2">
                <label className="block text-sm text-muted-foreground mb-1">可选：上传文件（PPT、PDF、视频、DOC等）</label>
                <input type="file" accept=".ppt,.pptx,.pdf,.mp4,.mov,.avi,.doc,.docx" onChange={e => setNewPost(n => ({ ...n, file: e.target.files?.[0] || null }))} />
              </div>
              <Input className="mb-2 rounded" placeholder="可选：相关链接" value={newPost.url} onChange={e => setNewPost(n => ({ ...n, url: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowUpload(false)}>取消</Button>
                <Button onClick={handleUpload} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  提交审核
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
