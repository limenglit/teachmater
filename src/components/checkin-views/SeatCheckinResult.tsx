import '@/student-seat-result.css';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useLanguage, LanguageCoreContext } from '@/contexts/language-core';
import { cachedDict, loadDict } from '@/lib/student-i18n-loader';
// 中文内置在结果页里：网络再差也能显示可读文字
import seatResultZh from '@/lib/student-i18n/seatResult-zh';
import { getSeatNeighbors, pickCheckedInNeighbor, describeNeighbor, type SeatNeighbor } from '@/lib/seat-neighbors';
import { studentSupabase as supabase } from '@/lib/student-supabase';
import { buildSeatHint } from '@/lib/seat-hint';
import { prepareMarkers, markerNamePool, describeMarker, findMarkerByName } from '@/lib/seat-chart-markers';
import FindFriendPanel from './FindFriendPanel';
import { CheckCircle2, Crosshair, Sparkles } from '@/components/student-icons-extra';
const ClassroomCheckinView = lazy(() => import('./ClassroomCheckinView'));
const RoundTableCheckinView = lazy(() => import('./RoundTableCheckinView'));
const ConferenceCheckinView = lazy(() => import('./ConferenceCheckinView'));
const ConcertCheckinView = lazy(() => import('./ConcertCheckinView'));
const ComputerLabCheckinView = lazy(() => import('./ComputerLabCheckinView'));
const ArtStudioCheckinView = lazy(() => import('./ArtStudioCheckinView'));
const SeatChartImageView = lazy(() => import('./SeatChartImageView'));

/** 签到成功后的座位展示：单独打包，只有签到成功才下载（含座位图、找同学、邻座提示）。 */
const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

const collectSeatNames = (node: unknown, out: string[] = []): string[] => {
  if (typeof node === 'string') {
    const n = normalizeStudentName(node);
    if (n) out.push(n);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach(item => collectSeatNames(item, out));
    return out;
  }
  if (node && typeof node === 'object') {
    Object.values(node as Record<string, unknown>).forEach(value => collectSeatNames(value, out));
  }
  return out;
};

const TEACHMATE_URL = 'https://teachermate.org.cn';

function TeachMateEntryBar() {
  return (
    <a
      href={TEACHMATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-primary/95 via-primary to-primary/95 text-primary-foreground text-sm font-medium shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur-sm active:opacity-90 transition-opacity"
    >
      <Sparkles className="w-4 h-4 animate-pulse" />
      <span>AI助力教学创新入口</span>
    </a>
  );
}

export interface SeatCheckinResultProps {
  sessionId: string | undefined;
  session: { seat_data: unknown; student_names: string[]; scene_config: Record<string, unknown>; scene_type: string };
  name: string;
  displaySeatData: unknown | null;
  assignedSeatHint: string | null;
  alreadyCheckedIn: boolean;
  isGuestAssigned: boolean;
}

function SeatCheckinResultView({ sessionId, session, name, displaySeatData, assignedSeatHint, alreadyCheckedIn, isGuestAssigned }: SeatCheckinResultProps) {
  const { t } = useLanguage();
  const checkedIn = true;
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [neighbor, setNeighbor] = useState<SeatNeighbor | null>(null);
  const [friendName, setFriendName] = useState<string | null>(null);
  const handleRecenter = useCallback(() => {
    setRecenterSignal(s => s + 1);
  }, []);

  // Poll the neighbouring seats (front / back / left / right) so we can tell the
  // student "您在 XX 的后面" as soon as one of them has checked in.
  const neighborSeatData = displaySeatData ?? session?.seat_data ?? null;
  const checkedName = checkedIn ? normalizeStudentName(name) : '';
  useEffect(() => {
    if (!sessionId || !session || !checkedName) { setNeighbor(null); return; }
    const candidates = getSeatNeighbors(session.scene_type, neighborSeatData, checkedName).slice(0, 8);
    if (candidates.length === 0) { setNeighbor(null); return; }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await (supabase.rpc as any)('get_seat_checkin_neighbor_status', {
        p_session_id: sessionId,
        p_names: candidates.map(c => c.name),
      });
      if (cancelled || error) return;
      setNeighbor(pickCheckedInNeighbor(candidates, (data as string[]) || []));
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [sessionId, session, neighborSeatData, checkedName]);
  const sceneType = session.scene_type;
  const studentName = name.trim();
  const effectiveSeatData = displaySeatData ?? session.seat_data;
  // Resolve a clean seat-position label even if the assignedSeatHint is missing
  const seatLabel = assignedSeatHint
    || buildSeatHint(sceneType, effectiveSeatData, studentName, session.scene_config)
    || t('seatCheckin.viewOnMap');

  const checkinOnlyMode = session.scene_config?.checkinOnlyMode === true;
  const seatChartImageUrl = typeof session.scene_config?.seatChartImageUrl === 'string'
    ? (session.scene_config.seatChartImageUrl as string)
    : '';
  const seatChartMarkers = prepareMarkers(session.scene_config?.seatChartMarkers).markers;

  if (checkinOnlyMode) {
    return (
      <div className="min-h-[100dvh] bg-background overflow-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/8 to-primary/5 border border-primary/25 px-4 py-4 shadow-xs flex items-center gap-3">
            <div className="shrink-0 w-11 h-11 rounded-full bg-primary/20 text-primary flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-primary/80 uppercase tracking-wide">
                {t('seatCheckin.success')}
                {alreadyCheckedIn && (
                  <span className="ml-1.5 text-[10px] bg-primary/15 text-primary/90 px-1.5 py-0.5 rounded normal-case">{t('seatCheckin.checkInBadge')}</span>
                )}
              </div>
              <div className="text-base font-bold text-foreground truncate">{studentName}</div>
            </div>
          </div>

          {seatChartImageUrl ? (
            <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">座次图加载中…</div>}>
              <SeatChartImageView
                imageUrl={seatChartImageUrl}
                recenterSignal={recenterSignal}
                markers={seatChartMarkers}
                selfName={studentName}
                friendName={friendName}
              />
              {seatChartMarkers.length > 0
                && (session.scene_config as Record<string, unknown> | null)?.findFriendEnabled !== false && (
                <FindFriendPanel
                  names={markerNamePool(seatChartMarkers)}
                  selfName={studentName}
                  resolveLabel={(n) => describeMarker(findMarkerByName(seatChartMarkers, n)) || '已在座次表上标出'}
                  selected={friendName}
                  onSelect={setFriendName}
                />
              )}
            </Suspense>
          ) : (
            <div className="text-center text-sm text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-6">
              签到已完成，请按现场安排入座。
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-[100dvh] bg-background overflow-auto pb-[max(9rem,env(safe-area-inset-bottom))]">
      {/* Sticky "我的座位" info card */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/60 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/8 to-primary/5 border border-primary/25 px-4 py-3 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="shrink-0 w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary/80 uppercase tracking-wide">
                    <span>{t('seatCheckin.success')}</span>
                    {alreadyCheckedIn && (
                      <span className="text-[10px] bg-primary/15 text-primary/90 px-1.5 py-0.5 rounded normal-case">{t('seatCheckin.checkInBadge')}</span>
                    )}
                  </div>
                  <div className="text-base font-bold text-foreground truncate">
                    {studentName} <span className="text-primary">·</span> <span className="text-primary">{seatLabel}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleRecenter}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20 px-3 py-2 rounded-lg border border-primary/20 transition-colors"
                aria-label={t('seatCheckin.backToMySeat')}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('seatCheckin.backToMySeat')}</span>
                <span className="inline sm:hidden">{t('seatCheckin.center')}</span>
              </button>
            </div>
            {isGuestAssigned && (
              <div className="mt-2 text-xs text-foreground/80 bg-card/60 rounded-lg px-2.5 py-1.5 border border-primary/15">
                💡 {t('seatCheckin.guestAssignedHint')}
              </div>
            )}
            {neighbor && (
              <div className="mt-2 text-xs font-medium text-foreground bg-card/70 rounded-lg px-2.5 py-1.5 border border-primary/20">
                🧭 {describeNeighbor(neighbor)}（{neighbor.name} 已签到）
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">座位图加载中…</div>}>
        {sceneType === 'classroom' && (
          <ClassroomCheckinView seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} neighborName={neighbor?.name} friendName={friendName ?? undefined} />

        )}
        {(sceneType === 'smartClassroom' || sceneType === 'banquet') && (
          <RoundTableCheckinView friendName={friendName ?? undefined} seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} sceneType={sceneType} recenterSignal={recenterSignal} />
        )}
        {sceneType === 'conference' && (
          <ConferenceCheckinView friendName={friendName ?? undefined} seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        {sceneType === 'concertHall' && (
          <ConcertCheckinView friendName={friendName ?? undefined} seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        {sceneType === 'artStudio' && (
          <ArtStudioCheckinView friendName={friendName ?? undefined} seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        {sceneType === 'computerLab' && (
          <ComputerLabCheckinView friendName={friendName ?? undefined} seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        </Suspense>
        {(session.scene_config as any)?.findFriendEnabled !== false && (
        <FindFriendPanel
          names={collectSeatNames(effectiveSeatData).concat(session.student_names)}
          selfName={studentName}
          resolveLabel={(n) => buildSeatHint(sceneType, effectiveSeatData, n, session.scene_config)}
          selected={friendName}
          onSelect={setFriendName}
        />
        )}
        {!['classroom', 'smartClassroom', 'banquet', 'conference', 'concertHall', 'artStudio', 'computerLab'].includes(sceneType) && (
          <div className="text-center text-sm text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-6">
            暂不支持该座位场景的可视化展示，请按提示「{seatLabel}」入座。
          </div>
        )}
      </div>
      <TeachMateEntryBar />
    </div>
  );
}

/** 先补齐座位展示用的小词典（与签到表单词典合并），再显示座位图。 */
export default function SeatCheckinResult(props: SeatCheckinResultProps) {
  const core = useLanguage();
  const [extra, setExtra] = useState<Record<string, string> | null>(() => core.lang === 'zh' ? seatResultZh : cachedDict('seatResult', core.lang));
  useEffect(() => {
    if (core.lang === 'zh') { setExtra(seatResultZh); return; }
    let alive = true;
    loadDict('seatResult', core.lang).then((d) => { if (alive) setExtra(d); }, () => { if (alive) setExtra((x) => x || seatResultZh); });
    return () => { alive = false; };
  }, [core.lang]);
  const t = useCallback((k: string) => (extra && extra[k]) ?? seatResultZh[k] ?? core.t(k), [extra, core]);
  if (!extra) return <div className="flex items-center justify-center min-h-[100dvh] px-4 text-muted-foreground">{core.t('seatCheckin.loading')}</div>;
  return (
    <LanguageCoreContext.Provider value={{ ...core, t }}>
      <SeatCheckinResultView {...props} />
    </LanguageCoreContext.Provider>
  );
}
