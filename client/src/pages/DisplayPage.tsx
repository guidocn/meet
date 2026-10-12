import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions, Engine } from '@tsparticles/engine';
import { Wrench, Hexagon } from 'lucide-react';
const logger = { warn: console.warn, error: console.error, info: console.log, debug: console.log };
const resolveAppUrl = (path: string): string => (path.startsWith('http') ? path : path);
import { Image } from '@client/src/components/ui/image';

import { candidates } from '@client/src/api';
import type {
  BigScreenData,
  BigScreenGroupData,
} from '@shared/api.interface';
import logoImg from '@client/src/assets/logo.png';

let particlesInitialized = false;

const TAGS = [
  '技术分享',
  '三下乡',
  '校外义修',
  '冬至团建',
  '电脑维修',
  '技术培训',
  '志愿服务',
  '技能提升',
];

const GROUP_GRADIENTS: Record<string, string> = {
  A: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
  B: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #3b82f6 100%)',
  C: 'linear-gradient(135deg, #f97316 0%, #f59e0b 50%, #10b981 100%)',
  D: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #06b6d4 100%)',
};

const getGroupGradient = (groupName: string): string =>
  GROUP_GRADIENTS[groupName] ?? GROUP_GRADIENTS.A;

const formatNumber = (num: number | null | undefined): string => {
  if (num == null) return '--';
  return num.toString().padStart(3, '0');
};

const formatTime = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const mo = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${y}年${mo}月${d}日 ${weekdays[date.getDay()]}`;
};

const NUM_FONT =
  "'Orbitron', 'Chakra Petch', 'Rajdhani', 'SF Mono', 'JetBrains Mono', monospace";

interface GroupCardProps {
  data: BigScreenGroupData;
}

const GroupCard = ({ data }: GroupCardProps) => {
  const nextItem = data.waitingList[0] ?? null;
  const isInterviewing = !!data.current;
  const isPendingApproval = data.current?.status === 'pending_approval';
  const prevNum = useRef<string>('');
  const [displayNum, setDisplayNum] = useState<string>(
    data.current ? formatNumber(data.current.globalNumber) : '--'
  );
  const [numFading, setNumFading] = useState<boolean>(false);
  const gradient = getGroupGradient(data.groupName);

  useEffect(() => {
    const newNum = data.current ? formatNumber(data.current.globalNumber) : '--';
    if (newNum !== prevNum.current) {
      setNumFading(true);
      const t = setTimeout(() => {
        setDisplayNum(newNum);
        setNumFading(false);
        prevNum.current = newNum;
      }, 200);
      return () => clearTimeout(t);
    }
  }, [data.current?.globalNumber, data.current]);

  const currentNumStyle = {
    fontSize: 'clamp(2rem, 7vw, 5rem)',
    lineHeight: 1,
    background: 'linear-gradient(180deg, #ffb547 0%, #ff6b35 50%, #ff4500 100%)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    backgroundClip: 'text' as const,
    filter: numFading ? 'none' : 'drop-shadow(0 0 16px rgba(255,107,53,0.5))',
    opacity: numFading ? 0 : 1,
    fontFamily: NUM_FONT,
    fontWeight: 900 as const,
    letterSpacing: '0.05em',
    transition: 'opacity 200ms ease',
    animation: !numFading ? 'num-pulse 2.5s ease-in-out infinite' : 'none',
  };

  const idleNumStyle = {
    fontSize: 'clamp(2rem, 7vw, 5rem)',
    lineHeight: 1,
    fontFamily: NUM_FONT,
    fontWeight: 900 as const,
    letterSpacing: '0.05em',
  };

  const nextNumStyle = {
    fontSize: 'clamp(1.5rem, 4.5vw, 3rem)',
    fontFamily: NUM_FONT,
    fontWeight: 700 as const,
    letterSpacing: '0.05em',
    textShadow: '0 0 12px rgba(6,182,212,0.5)',
  };

  const nextIdleStyle = {
    fontSize: 'clamp(1.5rem, 4.5vw, 3rem)',
    fontFamily: NUM_FONT,
    fontWeight: 700 as const,
    letterSpacing: '0.05em',
  };

  const groupNameStyle = {
    fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)',
    background: gradient,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    backgroundClip: 'text' as const,
    fontFamily: NUM_FONT,
    fontWeight: 900 as const,
    letterSpacing: '0.05em',
  };

  return (
    <div
      data-ai-section-type="card-list"
      className={`relative rounded-xl overflow-hidden transition-all duration-500 ${
        isInterviewing ? 'md:scale-[1.02]' : 'opacity-80'
      }`}
      style={{
        background: isInterviewing ? gradient : 'linear-gradient(135deg, #3f3f46, #52525b)',
        padding: '1px',
        boxShadow: isInterviewing
          ? '0 0 40px rgba(6,182,212,0.25), 0 0 80px rgba(59,130,246,0.15)'
          : '0 4px 20px rgba(0,0,0,0.3)',
        animation: isInterviewing ? 'card-glow 3s ease-in-out infinite' : 'none',
      }}
    >
      <div
        className="relative rounded-[11px] h-full overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(30,30,35,0.85), rgba(20,20,25,0.9))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden pointer-events-none">
          <div
            className="h-full w-1/3"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.8), transparent)',
              animation: 'dataflow 3s linear infinite',
            }}
          />
        </div>

        <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-cyan-400/50" />
        <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-cyan-400/50" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-cyan-400/50" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-cyan-400/50" />

        {isInterviewing && (
          <div className="absolute top-3 right-4 flex items-center gap-1.5 z-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span
              className="text-xs font-bold text-red-400 tracking-widest"
              style={{ fontFamily: NUM_FONT }}
            >
              LIVE
            </span>
          </div>
        )}

        <div className="p-4 sm:p-5 md:p-6 xl:p-7 flex flex-col gap-3 sm:gap-4 md:gap-5 h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div style={groupNameStyle}>{data.groupName}</div>
              <span className="text-base sm:text-lg text-white/70 font-bold">组</span>
            </div>
            <span
              className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                isInterviewing ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              }`}
              style={{
                boxShadow: isInterviewing ? '0 0 10px rgba(52,211,153,0.8)' : 'none',
              }}
            />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div
              className="text-[10px] sm:text-xs text-cyan-300/60 tracking-widest mb-1 sm:mb-2"
              style={{ fontFamily: NUM_FONT }}
            >
              正在面试
            </div>
            {isInterviewing ? (
              <div className="relative flex items-center justify-center py-1 sm:py-2">
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <div
                    className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 xl:w-32 xl:h-32 rounded-full border-2 border-orange-400/30"
                    style={{
                      borderLeftColor: 'transparent',
                      borderBottomColor: 'transparent',
                      animation: 'spin-slow 8s linear infinite',
                    }}
                  />
                </div>
                <div className="relative" style={currentNumStyle}>
                  {displayNum}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-1 sm:py-2">
                <div className="text-zinc-700" style={idleNumStyle}>
                  — —
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 sm:pt-3 border-t border-zinc-700/50">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <span
                className="text-cyan-400 font-bold text-xs sm:text-sm tracking-widest"
                style={{ fontFamily: NUM_FONT }}
              >
                NEXT
              </span>
              <span className="text-cyan-400/40 text-xs">→</span>
            </div>
            {nextItem && !isPendingApproval ? (
              <div className="text-cyan-400" style={nextNumStyle}>
                {formatNumber(nextItem.globalNumber)}
              </div>
            ) : isPendingApproval && nextItem ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-cyan-400" style={nextNumStyle}>
                  {formatNumber(nextItem.globalNumber)}
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/40">
                  待审批
                </span>
              </div>
            ) : (
              <div className="text-zinc-700" style={nextIdleStyle}>
                —
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DisplayPage = () => {
  const [data, setData] = useState<BigScreenData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [now, setNow] = useState<Date>(new Date());

  const signInUrl = useMemo(() => resolveAppUrl('/'), []);

  const particlesInit = useCallback(async (engine: Engine) => {
    if (particlesInitialized) return;
    particlesInitialized = true;
    await loadSlim(engine);
  }, []);

  const particlesOptions: ISourceOptions = useMemo(
    () => ({
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'grab' },
          resize: { enable: true },
        },
        modes: {
          grab: { distance: 160, links: { opacity: 0.6 } },
        },
      },
      particles: {
        color: { value: '#22d3ee' },
        links: {
          color: '#06b6d4',
          distance: 130,
          enable: true,
          opacity: 0.2,
          width: 1,
        },
        move: {
          direction: 'none',
          enable: true,
          outModes: { default: 'bounce' },
          random: true,
          speed: 0.5,
          straight: false,
        },
        number: {
          density: { enable: true, area: 1000 },
          value: 140,
        },
        opacity: { value: 0.5 },
        shape: { type: 'circle' },
        size: { value: { min: 1, max: 2.5 } },
      },
      detectRetina: true,
    }),
    []
  );

  const fetchData = async (): Promise<void> => {
    try {
      const result = await candidates.getBigScreenData();
      setData(result);
    } catch (error) {
      logger.error('大屏数据刷新失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        void fetchData();
      }, 15000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // 页面可见时才轮询，隐藏时暂停，减少服务器压力
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchData();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const waitingNum = data?.totalWaiting ?? 0;

  const clockStyle = {
    fontSize: 'clamp(1.5rem, 5vw, 3.5rem)',
    fontFamily: NUM_FONT,
    fontWeight: 700 as const,
    letterSpacing: '0.1em',
    textShadow: '0 0 20px rgba(6,182,212,0.5)',
  };

  const totalNumStyle = {
    fontSize: 'clamp(2.5rem, 8vw, 5rem)',
    background: 'linear-gradient(180deg, #67e8f9 0%, #06b6d4 50%, #0891b2 100%)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    backgroundClip: 'text' as const,
    filter: 'drop-shadow(0 0 16px rgba(6,182,212,0.5))',
    fontFamily: NUM_FONT,
    fontWeight: 900 as const,
    letterSpacing: '0.05em',
  };

  const qrSize = typeof window !== 'undefined' && window.innerWidth < 768 ? 160 : 220;

  return (
    <div
      className="w-screen min-h-screen md:h-screen text-white flex flex-col relative overflow-x-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 40%, #0a0a0a 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div
        className="absolute top-[10%] left-[5%] w-64 sm:w-96 h-64 sm:h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'float-slow 12s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[15%] right-[8%] w-56 sm:w-[28rem] h-56 sm:h-[28rem] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'float-slow 15s ease-in-out infinite reverse',
        }}
      />

      <div className="absolute inset-0 z-0">
        <ParticlesProvider init={particlesInit}>
          <Particles
            id="tsparticles"
            options={particlesOptions}
            className="absolute inset-0"
          />
        </ParticlesProvider>
      </div>

      <header className="relative z-10 px-4 sm:px-6 md:px-10 py-3 sm:py-4 flex-shrink-0">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(6,182,212,0.08) 0%, transparent 100%)',
          }}
        />
        <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-2 sm:gap-4 relative">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-xl"
                style={{
                  padding: '2px',
                  background: 'conic-gradient(from 0deg, #06b6d4, #3b82f6, #8b5cf6, #06b6d4)',
                  animation: 'spin-slow 10s linear infinite',
                  filter: 'blur(4px)',
                  opacity: 0.6,
                }}
              />
              <Image
                src={logoImg}
                alt="党支部义务电脑维修队"
                className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl object-cover"
              />
            </div>
            <div>
              <h1
                className="text-base sm:text-xl md:text-3xl font-bold tracking-wide text-center sm:text-left"
                style={{
                  background: 'linear-gradient(90deg, #ffffff 0%, #a5f3fc 50%, #22d3ee 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 2px 8px rgba(6,182,212,0.3))',
                }}
              >
                党支部义务电脑维修队
              </h1>
              <p
                className="text-xs sm:text-sm text-cyan-400 tracking-widest mt-0.5 text-center sm:text-left"
                style={{ fontFamily: NUM_FONT, fontWeight: 500 }}
              >
                招新面试候场系统
              </p>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <div className="text-cyan-400" style={clockStyle}>
              {formatTime(now)}
            </div>
            <div className="mt-0.5 text-xs sm:text-sm text-zinc-400">
              {formatDate(now)}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
          <div
            className="h-full w-1/2"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), rgba(59,130,246,0.6), transparent)',
              animation: 'dataflow 4s linear infinite',
            }}
          />
        </div>
      </header>

      <main className="flex-1 relative z-10 px-4 sm:px-6 md:px-10 py-4 sm:py-6 min-h-0">
        {loading || !data ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-zinc-500 text-lg" style={{ fontFamily: NUM_FONT }}>
              加载中...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 h-full">
            {data.groups.map((group: BigScreenGroupData) => (
              <GroupCard key={group.groupName} data={group} />
            ))}
          </div>
        )}
      </main>

      <footer className="relative z-10 px-4 sm:px-6 md:px-10 py-3 sm:py-5 flex-shrink-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 md:gap-6">
          <div className="flex flex-col justify-center md:flex-shrink-0 md:w-44 lg:w-56">
            <span
              className="text-xs sm:text-sm text-cyan-300/70 tracking-widest mb-0.5 sm:mb-1"
              style={{ fontFamily: NUM_FONT }}
            >
              全场待面试
            </span>
            <div className="relative flex items-baseline gap-2">
              <div className="absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 opacity-20">
                <Hexagon
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 text-cyan-400"
                  strokeWidth={1}
                  style={{ animation: 'spin-slow 20s linear infinite' }}
                />
              </div>
              <span className="relative text-cyan-400" style={totalNumStyle}>
                {waitingNum}
              </span>
              <span
                className="text-base sm:text-lg md:text-xl text-zinc-400"
              >
                人
              </span>
            </div>
          </div>

          <div className="w-full md:flex-1 md:max-w-xl lg:max-w-2xl flex items-center justify-center">
            <div
              className="relative w-full rounded-xl overflow-hidden"
              style={{
                padding: '1px',
                background:
                  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
                boxShadow: '0 0 24px rgba(6,182,212,0.15)',
              }}
            >
              <div
                className="relative rounded-[11px] p-4 sm:p-5 md:p-6 overflow-hidden"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(30,30,35,0.8), rgba(20,20,25,0.9))',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div className="absolute top-2 left-2 w-3 h-3 border-l border-t border-cyan-400/50" />
                <div className="absolute top-2 right-2 w-3 h-3 border-r border-t border-cyan-400/50" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-l border-b border-cyan-400/50" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-r border-b border-cyan-400/50" />

                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  <span
                    className="text-sm sm:text-base font-bold tracking-wide"
                    style={{
                      background: 'linear-gradient(90deg, #22d3ee, #3b82f6)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      fontFamily: NUM_FONT,
                    }}
                  >
                    维修队简介
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-zinc-300 mb-1 leading-relaxed">
                  广东工贸职业技术学院计算机与信息工程学院
                  <span className="text-white font-medium">
                    {' '}
                    · 学生党支部义务电脑维修队
                  </span>
                </p>
                <p className="text-xs sm:text-sm text-cyan-400 font-semibold mb-2 sm:mb-3">
                  23年老牌队伍
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-1 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-zinc-200">
                    宗旨：
                    <span className="text-cyan-400 font-semibold">
                      提高自身技术，服务广大师生
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-200">
                    理念：
                    <span className="text-white font-semibold">认真做事，大度做人</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {TAGS.map((tag: string) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 sm:px-3 py-1 rounded-full border border-cyan-500/40 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/15 hover:border-cyan-400/70 hover:shadow-[0_0_8px_rgba(6_182_212_0.3)] transition-all duration-200 cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 bg-white rounded-xl p-3 sm:p-4 shadow-2xl md:flex-shrink-0 relative mx-auto md:mx-0">
            <div
              className="absolute -inset-0.5 rounded-xl -z-10"
              style={{
                background:
                  'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6, #06b6d4)',
                backgroundSize: '300% 300%',
                animation: 'gradient-shift 4s ease infinite',
                filter: 'blur(6px)',
                opacity: 0.7,
              }}
            />
            <span
              className="relative text-base sm:text-lg font-bold tracking-wide"
              style={{
                background: 'linear-gradient(90deg, #0891b2, #2563eb)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              扫码签到
            </span>
            <div className="relative">
              <QRCodeSVG
                value={signInUrl}
                size={qrSize}
                level="H"
                includeMargin={false}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 40%, rgba(6,182,212,0.15) 50%, transparent 60%)',
                  animation: 'scan-line 2.5s ease-in-out infinite',
                }}
              />
            </div>
            <span className="relative text-xs text-zinc-500">
              微信扫码 · 信息登记
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes dataflow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes card-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.15); }
        }
        @keyframes num-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes scan-line {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default DisplayPage;
