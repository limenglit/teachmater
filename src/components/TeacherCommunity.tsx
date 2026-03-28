import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// 示例数据结构
const demoPosts = [
  {
    id: 1,
    title: '项目式学习在初中物理中的应用',
    author: '张老师',
    course: '物理',
    region: '江苏南京',
    tags: ['项目式学习', '创新教学'],
    knowledgePoints: ['力与运动'],
    method: '小组合作',
    content: '通过真实项目驱动学生探究力学知识...',
    likes: 12,
    comments: [
      { user: '李老师', text: '很有启发！', time: '2026-03-28 10:00' }
    ],
    invites: [
      { topic: '跨学科主题研究', initiator: '王老师', time: '2026-03-28 09:00' }
    ],
    fileUrl: '',
    fileName: '',
    url: ''
  },
];

export default function Community() {
  const [posts, setPosts] = useState(demoPosts);
  const [filter, setFilter] = useState({ course: '', region: '', tag: '', keyword: '' });
  const [showUpload, setShowUpload] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', course: '', region: '', tags: '', knowledgePoints: '', method: '', content: '', file: null, url: '' });
  const [commentDraft, setCommentDraft] = useState({});
  const [inviteDraft, setInviteDraft] = useState({});

  // 筛选
  const filteredPosts = posts.filter(p =>
    (!filter.course || p.course.includes(filter.course)) &&
    (!filter.region || p.region.includes(filter.region)) &&
    (!filter.tag || p.tags.includes(filter.tag)) &&
    (!filter.keyword || p.title.includes(filter.keyword) || p.content.includes(filter.keyword))
  );

  // 点赞
  const handleLike = id => {
    setPosts(posts => posts.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
  };

  // 邀约
  const handleInvite = (id, text) => {
    if (!text) return;
    setPosts(posts => posts.map(p => p.id === id ? { ...p, invites: [...(p.invites || []), { initiator: '当前用户', topic: text, time: new Date().toLocaleString() }] } : p));
    setInviteDraft(d => ({ ...d, [id]: '' }));
  };

  // 评论
  const handleComment = (id, text) => {
    if (!text) return;
    setPosts(posts => posts.map(p => p.id === id ? { ...p, comments: [...p.comments, { user: '当前用户', text, time: new Date().toLocaleString() }] } : p));
    setCommentDraft(d => ({ ...d, [id]: '' }));
  };

  // 发帖
  const handleUpload = () => {
    let fileUrl = '';
    let fileName = '';
    if (newPost.file) {
      fileUrl = URL.createObjectURL(newPost.file);
      fileName = newPost.file.name;
    }
    setPosts([
      {
        ...newPost,
        id: Date.now(),
        author: '当前用户',
        tags: newPost.tags.split(','),
        knowledgePoints: newPost.knowledgePoints.split(','),
        fileUrl,
        fileName,
        likes: 0,
        comments: [],
        invites: []
      },
      ...posts
    ]);
    setShowUpload(false);
    setNewPost({ title: '', course: '', region: '', tags: '', knowledgePoints: '', method: '', content: '', file: null, url: '' });
  };

  return (
    <div className="teacher-community p-6 bg-white rounded-2xl shadow mb-10 border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-extrabold text-purple-700 flex items-center gap-2">
          <span>👩‍🏫</span> 教师社区
        </h2>
        <Button className="bg-black text-white font-bold px-4 py-2 rounded-lg shadow-none hover:bg-gray-800 transition" onClick={() => setShowUpload(true)}>+ 发布新主题</Button>
      </div>
      <div className="flex gap-3 mb-6">
        <Input className="rounded-lg" placeholder="按课程筛选" value={filter.course} onChange={e => setFilter(f => ({ ...f, course: e.target.value }))} />
        <Input className="rounded-lg" placeholder="按地区筛选" value={filter.region} onChange={e => setFilter(f => ({ ...f, region: e.target.value }))} />
        <Input className="rounded-lg" placeholder="按标签/关注点筛选" value={filter.tag} onChange={e => setFilter(f => ({ ...f, tag: e.target.value }))} />
        <Input className="rounded-lg" placeholder="关键词" value={filter.keyword} onChange={e => setFilter(f => ({ ...f, keyword: e.target.value }))} />
      </div>
      <div className="grid gap-6">
        {filteredPosts.map(p => (
          <div key={p.id} className="border rounded-2xl p-6 bg-white shadow-sm hover:shadow-md transition-all">
            {/* 附件与链接展示区 */}
            {(p.fileUrl || p.url) && (
              <div className="mt-3 flex flex-col gap-2">
                {p.fileUrl && (
                  <div className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="font-semibold">附件：</span>
                    <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">{p.fileName}</a>
                    {p.fileUrl.match(/\.(pdf)$/i) && <iframe src={p.fileUrl} title="PDF预览" className="w-full h-40 border rounded mt-2" />}
                    {p.fileUrl.match(/\.(mp4|mov|avi)$/i) && <video src={p.fileUrl} controls className="w-full h-40 rounded mt-2" />}
                    {p.fileUrl.match(/\.(ppt|pptx)$/i) && <span className="text-xs text-gray-400">（PPT可下载，在线预览需集成第三方）</span>}
                    {p.fileUrl.match(/\.(doc|docx)$/i) && <span className="text-xs text-gray-400">（DOC可下载，在线预览需集成第三方）</span>}
                  </div>
                )}
                {p.url && (
                  <div className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="font-semibold">链接：</span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">{p.url}</a>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700 shadow">{p.author[0]}</div>
                <div>
                  <span className="font-bold text-lg text-purple-800">{p.title}</span>
                  <div className="text-xs text-gray-400 mt-0.5">by {p.author} | {p.region} | {p.course}</div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {p.tags.map(tag => <span key={tag} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">#{tag}</span>)}
              </div>
            </div>
            <div className="mt-2 text-gray-700 leading-relaxed text-base">{p.content}</div>
            <div className="mt-2 text-xs text-gray-500">知识点：{p.knowledgePoints.join('，')} | 方法：{p.method}</div>
            <div className="mt-4 flex gap-6 items-center">
              <Button className="hover:scale-110 transition-transform font-bold text-lg text-gray-700" variant="ghost" onClick={() => handleLike(p.id)}>👍 {p.likes}</Button>
              <span className="text-gray-500">💬 {p.comments.length} 评论</span>
              <span className="text-gray-500">📢 {p.invites?.length || 0} 主题邀约</span>
            </div>
            {/* 评论区 */}
            <div className="mt-4 border-t pt-3">
              <div className="font-semibold text-sm text-gray-700 mb-1">评论区</div>
              {p.comments.map((com, i) => <div key={i} className="text-xs text-gray-600 mb-1"><span className="font-bold text-gray-800">{com.user}</span>：{com.text} <span className="text-gray-400">{com.time}</span></div>)}
              <div className="flex gap-2 mt-2">
                <Input className="rounded" placeholder="写评论..." value={commentDraft[p.id] || ''} onChange={e => setCommentDraft(d => ({ ...d, [p.id]: e.target.value }))} />
                <Button className="bg-black text-white font-bold" onClick={() => handleComment(p.id, commentDraft[p.id])}>评论</Button>
              </div>
            </div>
            {/* 主题研究邀约 */}
            <div className="mt-4 border-t pt-3">
              <div className="font-semibold text-sm text-gray-700 mb-1">主题研究邀约</div>
              <div className="flex gap-2 items-center mb-1">
                <Input className="rounded" placeholder="发起主题研究邀约..." value={inviteDraft[p.id] || ''} onChange={e => setInviteDraft(d => ({ ...d, [p.id]: e.target.value }))} />
                <Button className="bg-black text-white font-bold" onClick={() => handleInvite(p.id, inviteDraft[p.id])}>邀约</Button>
              </div>
              {p.invites?.map((inv, i) => <div key={i} className="text-xs text-purple-700 mt-1">{inv.initiator} 邀请参与“{inv.topic}” ({inv.time})</div>)}
            </div>
          </div>
        ))}
        {filteredPosts.length === 0 && <div className="text-gray-400">暂无符合条件的主题</div>}
      </div>
      {showUpload && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow w-full max-w-lg border border-gray-100">
            <h3 className="text-lg font-bold mb-2 text-gray-800">发布新主题</h3>
            <Input className="mb-2 rounded" placeholder="主题标题" value={newPost.title} onChange={e => setNewPost(n => ({ ...n, title: e.target.value }))} />
            <Input className="mb-2 rounded" placeholder="课程名" value={newPost.course} onChange={e => setNewPost(n => ({ ...n, course: e.target.value }))} />
            <Input className="mb-2 rounded" placeholder="地区" value={newPost.region} onChange={e => setNewPost(n => ({ ...n, region: e.target.value }))} />
            <Input className="mb-2 rounded" placeholder="标签（逗号分隔）" value={newPost.tags} onChange={e => setNewPost(n => ({ ...n, tags: e.target.value }))} />
            <Input className="mb-2 rounded" placeholder="知识点（逗号分隔）" value={newPost.knowledgePoints} onChange={e => setNewPost(n => ({ ...n, knowledgePoints: e.target.value }))} />
            <Input className="mb-2 rounded" placeholder="教学方法/策略" value={newPost.method} onChange={e => setNewPost(n => ({ ...n, method: e.target.value }))} />
            <Textarea className="mb-2 rounded" placeholder="主题内容/创新点描述" value={newPost.content} onChange={e => setNewPost(n => ({ ...n, content: e.target.value }))} />
            <div className="mb-2">
              <label className="block text-sm text-gray-600 mb-1">可选：上传文件（PPT、PDF、视频、DOC等）</label>
              <input type="file" accept=".ppt,.pptx,.pdf,.mp4,.mov,.avi,.doc,.docx" onChange={e => setNewPost(n => ({ ...n, file: e.target.files[0] }))} />
            </div>
            <Input className="mb-2 rounded" placeholder="可选：相关链接（如B站、腾讯文档、网盘等）" value={newPost.url} onChange={e => setNewPost(n => ({ ...n, url: e.target.value }))} />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowUpload(false)}>取消</Button>
              <Button className="bg-black text-white font-bold" onClick={handleUpload}>提交</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
