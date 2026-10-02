import React, { useEffect, useState } from 'react';
import { Quest } from '../types';
import { Camera, Clock, ExternalLink, MapPin, Navigation, X, Zap } from 'lucide-react';
import { UI_STRINGS, rememberUiLang } from './world/ui/strings';
import { QUEST_ICON, toneClass } from './world/ui/questVisual';
import './world/ui/worldUi.css';

interface ActiveQuestHUDProps {
  quest: Quest;
  startTime: number | null;
  isAutoNavigating: boolean;
  onStartAutoNav: () => void;
  onStopAutoNav: () => void;
  onSubmitProof: () => void;
  onAbort: () => void;
  onRecenter: () => void;
  lang: 'zh' | 'en';
}

/**
 * 进行中委托的 HUD：TopHud 正下方一张白色软糖卡，左侧一道委托类型色竖条（风格指南 7.1）。
 *
 * 高度是锁死的：App 在有进行中委托时把定位告知条放在 12.25rem，聚焦卡片的顶边也按 HUD 约在 12rem 收住来算，
 * 所以标题行固定 36px、按钮行固定 44px，标题再长也只截断不折行。
 * 按钮上的字是玩家看得懂的话（自动 / 地图 / 提交证明），不再是上一版终端腔的 AUTO / MAPS / SUBMIT。
 */
const ActiveQuestHUD: React.FC<ActiveQuestHUDProps> = ({
  quest, startTime, isAutoNavigating, onStartAutoNav, onStopAutoNav, onSubmitProof, onAbort, onRecenter, lang
}) => {
  const [elapsed, setElapsed] = useState(0);
  // 提交证明面板（ProofSubmission）还没从 App 拿到 lang 时，会读这里记下的语言兜底
  rememberUiLang(lang);
  const t = UI_STRINGS[lang === 'en' ? 'en' : 'zh'];
  /*
   * 放弃要点两次（QA-R1-09）：原先右上角的 X 一碰就清掉进行中的委托、计时归零，
   * 走路时手机在口袋里或单手操作很容易误触。第一次点只「上膛」并写明后果，3 秒内再点才真的放弃。
   * 用行内确认而不是弹窗：不挡地图，也不多一层要关的界面。
   */
  const [abortArmed, setAbortArmed] = useState(false);
  useEffect(() => {
    if (!abortArmed) return;
    const id = setTimeout(() => setAbortArmed(false), 3000);
    return () => clearTimeout(id);
  }, [abortArmed]);
  useEffect(() => setAbortArmed(false), [quest.id]);

  useEffect(() => {
    if (!startTime) return;
    // 先算一次：切语言、换皮重挂时计时不该先闪一秒 00:00 再跳回真值
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const TypeIcon = QUEST_ICON[quest.type] ?? MapPin;

  return (
    <div className="absolute top-[calc(5.375rem+env(safe-area-inset-top))] left-4 right-4 z-[900] pointer-events-none">
      <section
        data-testid="active-quest-hud"
        aria-label={t.aqhLabel}
        className={`cute-root cute-panel-float wui-aqh relative overflow-hidden flex flex-col gap-1.5 w-full max-w-[26rem] mx-auto pt-2 pr-2.5 pb-2 pl-4 rounded-cute-card pointer-events-auto ${toneClass(quest.type)}`}
      >
        {/* 标题组可以收缩（标题本来就截断成省略号）：放弃按钮展开成「确认放弃？」时不会把整行挤出面板 */}
        <div className="flex items-center gap-2 h-9">
          <span className="wui-aqh-medal wui-tint shrink-0 w-[30px] h-[30px] rounded-full" aria-hidden="true"><TypeIcon size={18} strokeWidth={2.5} /></span>
          <h3 className="wui-aqh-t flex-1 m-0 truncate text-cute-body font-extrabold leading-5" title={quest.title}>{quest.title}</h3>
          {/* 计时每秒都在变，不放进 live region，免得读屏每秒念一次 */}
          <span className="cute-chip cute-chip-sm cute-num wui-time shrink-0" data-testid="aqh-timer" title={`${t.elapsed} ${timeString}`}>
            <Clock strokeWidth={2.5} aria-hidden="true" />{timeString}
          </span>
          <button
            type="button"
            data-testid="aqh-abort"
            data-armed={abortArmed ? 'true' : 'false'}
            onClick={() => (abortArmed ? onAbort() : setAbortArmed(true))}
            aria-label={abortArmed ? t.abortArmed : t.abort}
            className="wui-abort flex shrink-0 items-center justify-end min-w-[44px] h-11"
          >
            <span data-testid="aqh-abort-chip" className="wui-abort-chip inline-flex items-center justify-center gap-1 min-w-[32px] h-8 px-2 rounded-full text-cute-sm font-extrabold whitespace-nowrap">
              <X size={16} strokeWidth={2.75} aria-hidden="true" />
              {abortArmed && <span>{t.abortConfirm}</span>}
            </span>
          </button>
        </div>

        <div className="wui-acts grid gap-1.5 pb-[3px]">
          <button
            type="button"
            data-testid="aqh-autonav"
            onClick={isAutoNavigating ? onStopAutoNav : onStartAutoNav}
            title={isAutoNavigating ? t.autoStopTitle : t.autoGoTitle}
            className={`cute-btn cute-btn-secondary cute-btn-sm wui-abtn${isAutoNavigating ? ' wui-on' : ''}`}
          >
            {isAutoNavigating ? <Zap strokeWidth={2.5} fill="currentColor" aria-hidden="true" /> : <Navigation strokeWidth={2.5} aria-hidden="true" />}
            {isAutoNavigating ? t.autoStop : t.autoGo}
          </button>

          <button
            type="button"
            data-testid="aqh-maps"
            onClick={() => {
              const [lat, lng] = quest.location;
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
            }}
            title={t.mapsTitle}
            className="cute-btn cute-btn-secondary cute-btn-sm wui-abtn"
          >
            <ExternalLink strokeWidth={2.5} aria-hidden="true" />
            {t.maps}
          </button>

          <button
            type="button"
            data-testid="aqh-submit"
            onClick={onSubmitProof}
            className="cute-btn cute-btn-primary cute-btn-sm wui-abtn"
          >
            <Camera strokeWidth={2.5} aria-hidden="true" />
            {t.submit}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ActiveQuestHUD;
