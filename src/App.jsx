import { BookOpen, Compass, Dumbbell, Settings, TrendingUp } from 'lucide-react';
import { useCallback, useState } from 'react';
import { QuickTour } from './components/QuickTour';
import { RestTimerPill } from './components/RestTimerPill';
import { SettingsSheet } from './components/SettingsSheet';
import { DeenTab } from './components/tabs/DeenTab';
import { ProgressTab } from './components/tabs/ProgressTab';
import { TodayTab } from './components/tabs/TodayTab';
import { WorkoutTab } from './components/tabs/WorkoutTab';
import { findDistrict } from './data/lifeOsData';
import { useToday } from './hooks/useNow';
import { useStore } from './store/context';
import { StoreProvider } from './store/StoreProvider';
import { sound } from './utils/sound';

// Four tabs keep everything inside thumb reach; settings live behind the gear.
const TABS = [
  { id: 'today', label: 'Today', icon: Compass },
  { id: 'workout', label: 'Workout', icon: Dumbbell },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'deen', label: "Al-Muru'ah", icon: BookOpen },
];

function Shell() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const today = useToday();
  const district = findDistrict(state.settings.district);

  const openTab = useCallback((id) => {
    setTab(id);
    window.scrollTo({ top: 0 });
  }, []);

  const subtitle = {
    today: `${district.name}, Johor · ${district.zone}`,
    workout: state.active ? `${state.active.dayName} in progress` : 'V-taper upper/lower split',
    progress: 'Recomp, overload and balance',
    deen: 'Character, daily',
  }[tab];

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip bg-black text-ivory">
      <header className="pt-safe sticky top-0 z-30 border-b border-white/10 bg-black/85 px-4 pb-2.5 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">The Muslim Man — Life OS</p>
            <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-white">
              {TABS.find((t) => t.id === tab).label}
            </h1>
            <p className="truncate text-[12px] text-mute" data-testid="header-subtitle">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setSettingsOpen(true);
            }}
            aria-label="Routine and data settings"
            data-testid="open-settings"
            className="ios-press mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-card text-ivory"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <main
        className="flex-1 space-y-3 px-4 pt-3"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${state.timer ? 150 : 92}px)` }}
      >
        {!state.settings.tourDone && <QuickTour onDone={() => dispatch({ type: 'SET_SETTING', key: 'tourDone', value: true })} />}
        {tab === 'today' && <TodayTab today={today} district={district} onOpenWorkout={() => openTab('workout')} onOpenDeen={() => openTab('deen')} />}
        {tab === 'workout' && <WorkoutTab today={today} />}
        {tab === 'progress' && <ProgressTab today={today} />}
        {tab === 'deen' && <DeenTab today={today} />}
      </main>

      <RestTimerPill />

      <nav
        className="pb-safe fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-white/10 bg-black/80 px-2 pt-1.5 backdrop-blur-lg"
        aria-label="Main"
      >
        <div className="grid grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  sound.playTap();
                  openTab(id);
                }}
                data-testid={`tab-${id}`}
                className={`ios-press relative flex h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl ${active ? 'text-accent' : 'text-mute'}`}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                <span className="text-[11px] font-semibold">{label}</span>
                {id === 'workout' && state.active && <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-accent" aria-label="Session in progress" />}
              </button>
            );
          })}
        </div>
      </nav>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReplayTour={() => {
          dispatch({ type: 'SET_SETTING', key: 'tourDone', value: false });
          openTab('today');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
