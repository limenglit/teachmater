import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  CheckCircle2, Lock, Send, User, Paperclip, X, Search, Plus,
  Heart, MessageCircle, ChevronDown, RefreshCw, Mic, Square,
} from 'lucide-react';
import type { Board, BoardCard } from '@/components/BoardPanel';
import { getFileCategory, getCardType, getDocIcon, ACCEPT_ALL_MEDIA } from '@/lib/board-file-utils';
import { compressImage, validateFile, UPLOAD_CONFIG } from '@/lib/upload-queue';
import BoardCardItem from '@/components/board/BoardCardItem';

const CARD_COLORS = ['#ffffff', '#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#fed7aa'];
const RECORDING_MAX_SECONDS = 60;

const formatSeconds = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/* ───── Mobile Board Page: Browse + FAB Submit ───── */
export default function BoardSubmitPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { t, lang } = useLanguage();

  /* ── board & auth state ── */
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  /* ── browse state ── */
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string>('');

  /* ── submit sheet state ── */
  const [showSubmit, setShowSubmit] = useState(false);
  const [columnId, setColumnId] = useState('');
  const [columnStep, setColumnStep] = useState(false); // picking column for storyboard
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileCategory, setFileCategory] = useState<'image' | 'video' | 'audio' | 'document'>('image');
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveBars, setWaveBars] = useState<number[]>(() => Array.from({ length: 20 }, () => 12));
  const [asrPreview, setAsrPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const reachedMaxDurationRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const asrFinalTextRef = useRef('');

  const isStoryboard = board?.view_mode === 'storyboard' && Array.isArray(board?.columns) && (board?.columns?.length || 0) > 0;

  /* ── Load board ── */
  useEffect(() => {
    if (!boardId) return;
    supabase.from('boards').select('*').eq('id', boardId).single()
      .then(({ data }) => {
        if (data) {
          setBoard(data as any);
          const cols = (data as any).columns;
          if (Array.isArray(cols) && cols.length > 0) setColumnId(cols[0]);
        }
        setLoading(false);
      });

    const saved = localStorage.getItem(`board-nick-${boardId}`);
    if (saved) {
      setNickname(saved);
      setNicknameConfirmed(true);
    }
  }, [boardId]);

  /* ── Load cards once nickname confirmed ── */
  const loadCards = useCallback(async () => {
    if (!boardId) return;
    setCardsLoading(true);
    const { data } = await supabase
      .from('board_cards')
      .select('*')
      .eq('board_id', boardId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setCards(data as BoardCard[]);
    setCardsLoading(false);
  }, [boardId]);

  /* ── Pull-to-refresh ── */
  const feedRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const PULL_THRESHOLD = 64;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (feedRef.current && feedRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    } else {
      pullStartY.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null || refreshing) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.5, 120));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullStartY.current === null) return;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      await loadCards();
      setRefreshing(false);
    }
    pullStartY.current = null;
    setPullDistance(0);
  }, [pullDistance, refreshing, loadCards]);

  useEffect(() => {
    if (!nicknameConfirmed || !boardId) return;
    loadCards();

    // Realtime subscribe
    const channel = supabase
      .channel(`board-mobile-${boardId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'board_cards',
        filter: `board_id=eq.${boardId}`,
      }, (payload) => {
        const newCard = payload.new as BoardCard;
        if (newCard.is_approved) {
          setCards(prev => {
            if (prev.find(c => c.id === newCard.id)) return prev;
            return [newCard, ...prev];
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [nicknameConfirmed, boardId, loadCards]);

  /* ── Like handler ── */
  const handleLike = async (cardId: string) => {
    const token = localStorage.getItem('creator_token') || `anon-${boardId}`;
    await supabase.from('board_likes').insert({ card_id: cardId, liker_token: token });
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, likes_count: c.likes_count + 1 } : c));
  };

  /* ── Nickname helpers ── */
  const confirmNickname = () => {
    if (!nickname.trim()) return;
    setNicknameConfirmed(true);
    localStorage.setItem(`board-nick-${boardId}`, nickname.trim());
  };
  const selectName = (name: string) => {
    setNickname(name);
    setNicknameConfirmed(true);
    localStorage.setItem(`board-nick-${boardId}`, name);
  };

  /* ── FAB tap ── */
  const openSubmit = () => {
    if (isStoryboard) {
      setColumnStep(true);
      setShowSubmit(false);
    } else {
      setShowSubmit(true);
      setColumnStep(false);
    }
  };
  const pickColumn = (col: string) => {
    setColumnId(col);
    setColumnStep(false);
    setShowSubmit(true);
  };

  /* ── Upload ── */
  const uploadFileToBoardMedia = useCallback(async (file: File) => {
    if (!boardId) return;
    const validationError = validateFile(file);
    if (validationError) { toast({ title: validationError, variant: 'destructive' }); return; }

    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const category = file.type.startsWith('audio/') ? 'audio' : getFileCategory(ext);
    let fileToUpload: File = file;
    if (category === 'image') fileToUpload = await compressImage(file);
    const path = `${boardId}/${crypto.randomUUID()}.${ext}`;
    let lastError: string | undefined;
    for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, UPLOAD_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1)));
      const { data, error } = await supabase.storage.from('board-media').upload(path, fileToUpload);
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('board-media').getPublicUrl(data.path);
        setMediaUrl(urlData.publicUrl);
        setFileName(file.name);
        setFileCategory(category);
        lastError = undefined;
        break;
      }
      lastError = error?.message;
    }
    if (lastError) toast({ title: `上传失败: ${lastError}`, variant: 'destructive' });
    setUploading(false);
  }, [boardId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFileToBoardMedia(file);
  };

  const stopRecordingTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore stop errors from browser speech engine.
      }
      speechRecognitionRef.current = null;
    }
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      return false;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
      asrFinalTextRef.current = '';
      setAsrPreview('');

      recognition.onresult = (event: any) => {
        let finalText = asrFinalTextRef.current;
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript?.trim();
          if (!transcript) continue;
          if (event.results[i].isFinal) {
            finalText = `${finalText} ${transcript}`.trim();
          } else {
            interimText = `${interimText} ${transcript}`.trim();
          }
        }
        asrFinalTextRef.current = finalText;
        setAsrPreview(`${finalText} ${interimText}`.trim());
      };

      recognition.onerror = () => {
        setAsrPreview(asrFinalTextRef.current);
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
      return true;
    } catch {
      return false;
    }
  }, [lang]);

  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.85;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const freq = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        const currentAnalyser = analyserRef.current;
        if (!currentAnalyser) return;
        currentAnalyser.getByteFrequencyData(freq);

        const avg = freq.reduce((sum, val) => sum + val, 0) / (freq.length || 1);
        const normalized = Math.min(100, Math.round((avg / 255) * 100 * 2.2));
        setAudioLevel(normalized);

        const nextBars = Array.from({ length: 20 }, (_, i) => {
          const idx = Math.floor((i / 20) * freq.length);
          const val = freq[idx] || 0;
          return 8 + Math.round((val / 255) * 28);
        });
        setWaveBars(nextBars);

        rafRef.current = requestAnimationFrame(update);
      };

      rafRef.current = requestAnimationFrame(update);
    } catch {
      // Level meter is optional enhancement, fail silently.
    }
  }, []);

  const resetRecordingVisuals = useCallback(() => {
    setRecordingSeconds(0);
    setAudioLevel(0);
    setWaveBars(Array.from({ length: 20 }, () => 12));
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || uploading) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({ title: t('board.recordNotSupported'), variant: 'destructive' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      const mimeType = preferredMimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      reachedMaxDurationRef.current = false;

      recordedChunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearRecordingTimer();
        stopAudioAnalysis();
        stopSpeechRecognition();
        stopRecordingTracks();

        if (recordedChunksRef.current.length === 0) {
          setIsRecording(false);
          resetRecordingVisuals();
          return;
        }

        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const ext = mime.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mime });

        await uploadFileToBoardMedia(file);
        if (asrFinalTextRef.current.trim()) {
          setContent(prev => prev.trim() ? `${prev.trim()}\n${asrFinalTextRef.current.trim()}` : asrFinalTextRef.current.trim());
          toast({ title: t('board.asrFilled') });
        }
        toast({ title: reachedMaxDurationRef.current ? t('board.recordMaxDurationReached') : t('board.audioUploaded') });
        setIsRecording(false);
        reachedMaxDurationRef.current = false;
        asrFinalTextRef.current = '';
        setAsrPreview('');
        resetRecordingVisuals();
        mediaRecorderRef.current = null;
      };

      recorder.onerror = () => {
        clearRecordingTimer();
        stopAudioAnalysis();
        stopSpeechRecognition();
        stopRecordingTracks();
        setIsRecording(false);
        resetRecordingVisuals();
        toast({ title: t('board.recordStartFailed'), variant: 'destructive' });
      };

      setRecordingSeconds(0);
      resetRecordingVisuals();
      startAudioAnalysis(stream);
      const asrStarted = startSpeechRecognition();
      if (!asrStarted) {
        setAsrPreview(t('board.asrNotSupported'));
      }

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      clearRecordingTimer();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          if (next >= RECORDING_MAX_SECONDS) {
            reachedMaxDurationRef.current = true;
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      clearRecordingTimer();
      stopAudioAnalysis();
      stopSpeechRecognition();
      stopRecordingTracks();
      resetRecordingVisuals();
      toast({ title: t('board.recordPermissionDenied'), variant: 'destructive' });
    }
  }, [
    isRecording,
    uploading,
    stopRecordingTracks,
    t,
    uploadFileToBoardMedia,
    clearRecordingTimer,
    stopAudioAnalysis,
    stopSpeechRecognition,
    resetRecordingVisuals,
    startAudioAnalysis,
    startSpeechRecognition,
    stopRecording,
  ]);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      stopSpeechRecognition();
      stopAudioAnalysis();
      stopRecording();
      stopRecordingTracks();
    };
  }, [clearRecordingTimer, stopRecording, stopRecordingTracks, stopSpeechRecognition, stopAudioAnalysis]);

  const clearMedia = () => { setMediaUrl(''); setFileName(''); };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if ((!content.trim() && !mediaUrl) || !boardId || !board) return;
    setSubmitting(true);
    let isApproved = !board.moderation_enabled;
    if (board.banned_words) {
      const words = board.banned_words.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      if (words.some(w => content.toLowerCase().includes(w))) isApproved = false;
    }
    const { error } = await supabase.from('board_cards').insert({
      board_id: boardId,
      content: content.trim(),
      card_type: mediaUrl ? getCardType(fileCategory) : url.trim() ? 'url' : 'text',
      url: url.trim(),
      color,
      author_nickname: nickname.trim() || t('board.anonymous'),
      is_approved: isApproved,
      column_id: columnId,
      media_url: mediaUrl,
      position_x: Math.random() * 600,
      position_y: Math.random() * 400,
      sort_order: 0,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
    } else {
      setSubmitted(true);
      setContent(''); setUrl(''); clearMedia(); setColor('#ffffff');
      toast({ title: !isApproved ? t('board.blockedWord') : t('board.submitSuccess') });
      setTimeout(() => { setSubmitted(false); setShowSubmit(false); }, 1500);
    }
  };

  /* ── Loading / Not Found / Locked ── */
  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">{t('common.loading')}</div>;
  if (!board) return <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">{t('board.noBoards')}</div>;
  if (board.is_locked) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{t('board.locked')}</h1>
          <p className="text-sm text-muted-foreground">{t('board.lockedMsg')}</p>
        </div>
      </div>
    );
  }

  /* ── Name selection screen ── */
  const studentNames: string[] = Array.isArray(board.student_names) ? board.student_names : [];
  const hasRoster = studentNames.length > 0;

  if (!nicknameConfirmed) {
    return (
      <div className="min-h-[100dvh] bg-background overflow-y-auto px-4 py-[max(1rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm space-y-6 text-center mx-auto min-h-[calc(100dvh-max(2rem,env(safe-area-inset-top))-env(safe-area-inset-bottom))] flex flex-col justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div>
            <div className="text-4xl mb-3">🎨</div>
            <h1 className="text-xl font-bold text-foreground">{board.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('board.joinBoard')}</p>
          </div>
          {hasRoster && !showManualInput ? (
            <div className="space-y-3 text-left">
              <p className="text-sm font-medium text-foreground text-center">{t('board.selectYourName')}</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={nameSearch} onChange={e => setNameSearch(e.target.value)} placeholder={t('board.searchName')} className="pl-9" autoFocus />
              </div>
              <div className="max-h-[40vh] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {studentNames.filter(n => !nameSearch || n.toLowerCase().includes(nameSearch.toLowerCase())).map(name => (
                  <button key={name} onClick={() => selectName(name)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />{name}
                  </button>
                ))}
                {studentNames.filter(n => !nameSearch || n.toLowerCase().includes(nameSearch.toLowerCase())).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('board.searchName')}</p>
                )}
              </div>
              <button onClick={() => setShowManualInput(true)} className="w-full text-center text-xs text-primary hover:underline py-1">{t('board.nameNotFound')}</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 12))} placeholder={t('board.nicknamePlaceholder')} className="pl-9" maxLength={12} onKeyDown={e => e.key === 'Enter' && confirmNickname()} autoFocus />
              </div>
              <Button onClick={confirmNickname} disabled={!nickname.trim()} className="w-full gap-2">{t('board.joinBoard')} 🚀</Button>
              {hasRoster && showManualInput && (
                <button onClick={() => setShowManualInput(false)} className="w-full text-center text-xs text-primary hover:underline py-1">{t('board.selectYourName')}</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Filtered cards ── */
  const displayCards = filterColumn ? cards.filter(c => c.column_id === filterColumn) : cards;
  const columns = Array.isArray(board.columns) ? board.columns as string[] : [];

  /* ── Main browse + FAB UI ── */
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{board.title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />{nickname}
              </span>
              <button onClick={() => { setNicknameConfirmed(false); setShowManualInput(false); }} className="text-primary hover:underline">{t('common.edit')}</button>
              <span className="text-muted-foreground">·</span>
              <span>{cards.length} {t('board.cardTypeText')}</span>
            </div>
          </div>
        </div>

        {/* Column filter tabs (storyboard or kanban) */}
        {columns.length > 1 && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <button
              onClick={() => setFilterColumn('')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${!filterColumn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {t('board.clear') === '清除' ? '全部' : 'All'}
            </button>
            {columns.map(col => (
              <button
                key={col}
                onClick={() => setFilterColumn(col)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterColumn === col ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {col}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Card feed with pull-to-refresh ── */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto px-3 py-3 pb-24 space-y-3"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull indicator */}
        <div
          className="flex flex-col items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullDistance > 0 || refreshing ? Math.max(pullDistance, refreshing ? 48 : 0) : 0 }}
        >
          <RefreshCw
            className={`w-5 h-5 text-primary transition-transform ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: !refreshing ? `rotate(${pullDistance * 3}deg)` : undefined }}
          />
          <span className="text-xs text-muted-foreground mt-1">
            {refreshing ? t('common.loading') : pullDistance >= PULL_THRESHOLD ? (t('board.releaseToRefresh') || '松开刷新') : (t('board.pullToRefresh') || '下拉刷新')}
          </span>
        </div>
        {cardsLoading && cards.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">{t('common.loading')}</div>
        )}
        {!cardsLoading && displayCards.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <div className="text-4xl">📝</div>
            <p className="text-sm text-muted-foreground">{t('board.mobileEmptyHint')}</p>
          </div>
        )}
        {displayCards.map(card => (
          <BoardCardItem
            key={card.id}
            card={card}
            onManage={() => {}}
            onLike={handleLike}
            isCreator={false}
            isCloud={true}
          />
        ))}
      </div>

      {/* ── FAB ── */}
      {!showSubmit && !columnStep && (
        <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-40">
          <div className="relative group">
            <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              {t('board.fabHint')}
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground" />
            </div>
            <button
              onClick={openSubmit}
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            >
              <Plus className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {/* ── Column picker overlay (storyboard) ── */}
      {columnStep && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end" onClick={() => setColumnStep(false)}>
          <div className="w-full bg-background rounded-t-2xl border-t border-border shadow-xl max-h-[70vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-background px-4 pt-4 pb-2 border-b border-border">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3" />
              <h2 className="text-base font-bold text-foreground">{t('board.chooseColumnFirst')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t('board.chooseColumnHint')}</p>
            </div>
            <div className="p-4 space-y-2">
              {columns.map((col, idx) => (
                <button
                  key={col}
                  onClick={() => pickColumn(col)}
                  className="w-full text-left rounded-xl border border-border p-4 hover:bg-muted/60 active:bg-muted transition-colors"
                >
                  <div className="text-xs text-muted-foreground">{t('board.storyPanel')} {idx + 1}</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">{col}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Submit sheet ── */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end" onClick={() => setShowSubmit(false)}>
          <div className="w-full bg-background rounded-t-2xl border-t border-border shadow-xl max-h-[85vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-background px-4 pt-4 pb-2 border-b border-border z-10">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">{t('board.submitPage')}</h2>
                <button onClick={() => setShowSubmit(false)} className="p-1 rounded-full hover:bg-muted">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {isStoryboard && columnId && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{t('board.selectedColumn')}:</span>
                  <span className="text-xs font-medium text-foreground">{columnId}</span>
                  <button onClick={() => { setShowSubmit(false); setColumnStep(true); }} className="text-xs text-primary hover:underline">{t('common.edit')}</button>
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={t('board.cardContent')}
                className="min-h-[100px] text-base"
                rows={4}
                autoFocus
              />

              {mediaUrl && (
                <div className="relative inline-block">
                  {fileCategory === 'image' && <img src={mediaUrl} alt="" className="h-24 rounded-lg object-cover" />}
                  {fileCategory === 'video' && <video src={mediaUrl} className="h-24 rounded-lg object-cover" controls={false} />}
                  {fileCategory === 'audio' && (
                    <div className="h-16 px-3 rounded-lg bg-muted flex items-center text-sm">
                      <audio src={mediaUrl} controls preload="metadata" className="max-w-[250px]" />
                    </div>
                  )}
                  {fileCategory === 'document' && (
                    <div className="h-16 px-4 rounded-lg bg-muted flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="text-lg">{getDocIcon(fileName.split('.').pop() || '')}</span>
                      <span className="truncate max-w-[200px]">{fileName}</span>
                    </div>
                  )}
                  <button onClick={clearMedia} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"><X className="w-3 h-3" /></button>
                </div>
              )}

              <div className="flex gap-2">
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder={t('board.cardUrl')} className="flex-1" />
                <input ref={fileRef} type="file" accept={ACCEPT_ALL_MEDIA} onChange={handleUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1 flex-shrink-0">
                  <Paperclip className="w-4 h-4" />
                  {uploading ? t('board.uploading') : t('board.uploadFile')}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={uploading || submitting}
                  className="gap-1"
                >
                  {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isRecording ? t('board.stopRecording') : t('board.recordAudio')}
                </Button>
                {isRecording && (
                  <span className="text-xs text-destructive">{t('board.recording')}</span>
                )}
              </div>

              {(isRecording || asrPreview) && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('board.recordingTime')}</span>
                    <span>{formatSeconds(recordingSeconds)} / {formatSeconds(RECORDING_MAX_SECONDS)}</span>
                  </div>
                  <div className="h-9 flex items-end gap-1">
                    {waveBars.map((bar, idx) => (
                      <span
                        key={`wave-${idx}`}
                        className="flex-1 rounded-sm bg-primary/70 transition-all"
                        style={{ height: `${bar}px` }}
                      />
                    ))}
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${audioLevel}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground break-words">
                    {t('board.asrPreview')}: {asrPreview || t('board.asrListening')}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('board.cardColor')}:</span>
                {CARD_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-primary scale-110' : 'border-border'}`} style={{ backgroundColor: c }} />
                ))}
              </div>

              <Button onClick={handleSubmit} disabled={(!content.trim() && !mediaUrl) || submitting} className="w-full h-12 text-base gap-2">
                <Send className="w-4 h-4" />
                {submitting ? t('board.submitting') : t('board.submit')}
              </Button>

              {submitted && (
                <div className="flex items-center justify-center gap-2 text-primary font-medium animate-pulse">
                  <CheckCircle2 className="w-5 h-5" /> {t('board.submitSuccess')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
