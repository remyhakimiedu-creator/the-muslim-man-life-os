import { ChevronLeft, ChevronRight, Clock, Flag, Play, Trash2, Trophy } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { parseRepRange } from '../../data/defaultRoutine';
import { useNow } from '../../hooks/useNow';
import { bestsFor, epley1RM, isPR, lastSessionOfDay, nextDayIndex, round1, totalVolume } from '../../lib/calc';
import { daysBetween, formatClock, formatDM, formatDuration } from '../../lib/dates';
import { useStore } from '../../store/context';
import { uid } from '../../store/state';
import { sound } from '../../utils/sound';
import { BottomSheet, ConfirmModal } from '../overlays';
import { Card, Stat, Stepper } from '../ui';

const REST_PRESETS = [60, 90, 120];
const kgText = (n) => Math.round(n).toLocaleString('en-MY');
const estimateMinutes = (day) =>
  Math.round(day.exercises.reduce((acc, e) => acc + e.sets * (45 + e.restSec), 0) / 300) * 5;

// ---------------------------------------------------------------------------
// Before a session: pick a day, preview it, start.
// ---------------------------------------------------------------------------

function WorkoutIdle({ today }) {
  const { state, dispatch } = useStore();
  const { routine, sessions } = state;
  const suggested = nextDayIndex(routine, sessions);
  const [picked, setPicked] = useState(null);
  const dayIdx = Math.min(picked ?? suggested, routine.length - 1);
  const day = routine[dayIdx];

  if (!day) {
    return (
      <Card>
        <p className="text-[14px] text-mute">Your routine is empty. Open the gear icon to add a training day.</p>
      </Card>
    );
  }

  const last = lastSessionOfDay(sessions, day.id);
  const ago = last ? daysBetween(last.date, today) : null;

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Training day">
        {routine.map((d, i) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={i === dayIdx}
            onClick={() => {
              sound.playTap();
              setPicked(i);
            }}
            className={`ios-press relative h-11 rounded-2xl px-1 text-[13px] font-semibold ${
              i === dayIdx ? 'bg-accent text-black' : 'bg-card text-mute'
            }`}
          >
            <span className="block truncate">{d.name}</span>
            {i === suggested && (
              <span className={`absolute -top-1 right-1.5 rounded-full px-1.5 text-[10px] font-bold ${i === dayIdx ? 'bg-black text-accent' : 'bg-gold text-black'}`}>
                Next
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="space-y-3" data-testid="workout-preview">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Day {dayIdx + 1}</p>
          <h2 className="text-[21px] font-bold tracking-tight text-white">{day.name}</h2>
          <p className="text-[13px] text-mute">{day.focus}</p>
          <p className="tabular mt-1 text-[12px] text-mute">
            {day.exercises.length} exercises · about {estimateMinutes(day)} min
            {ago != null && ` · last done ${ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}`}
          </p>
        </div>

        {day.exercises.length === 0 ? (
          <p className="text-[14px] text-mute">No exercises yet. Add some from the gear icon.</p>
        ) : (
          <ol className="space-y-1.5">
            {day.exercises.map((ex, i) => {
              const best = bestsFor(sessions, ex.id);
              return (
                <li key={ex.id} className="flex items-center gap-3 rounded-xl bg-elevated/60 px-3 py-2.5">
                  <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/40 text-[12px] font-bold text-mute">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-white">{ex.name}</p>
                    <p className="tabular truncate text-[12px] text-mute">
                      {ex.muscle} · {ex.sets} × {ex.targetReps} · rest {ex.restSec}s
                    </p>
                  </div>
                  {best.kg > 0 && <span className="tabular shrink-0 text-[12px] font-semibold text-sysblue">{best.kg} kg</span>}
                </li>
              );
            })}
          </ol>
        )}

        <button
          type="button"
          disabled={day.exercises.length === 0}
          onClick={() => {
            sound.playTap();
            dispatch({ type: 'START_SESSION', dayId: day.id, id: uid(), now: Date.now() });
          }}
          className="ios-press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-bold text-black disabled:opacity-40"
          data-testid="start-session"
        >
          <Play className="h-4 w-4 fill-current" /> Start {day.name}
        </button>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// During a session: one exercise per card.
// ---------------------------------------------------------------------------

function SessionBar({ active, plannedSets, onFinish }) {
  const now = useNow(1000);
  return (
    <Card className="!p-3">
      <div className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
          <Stat label="Time" value={<span data-testid="stopwatch">{formatDuration((now - active.startedAt) / 1000)}</span>} valueClass="text-white" />
          <Stat label="Volume" value={<span data-testid="session-volume">{kgText(totalVolume(active.sets))}</span>} sub="kg" valueClass="text-sysblue" />
          <Stat label="Sets" value={`${active.sets.length}/${plannedSets}`} valueClass="text-accent" />
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="ios-press flex h-[62px] w-[62px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-accent/15 text-[12px] font-bold text-accent"
          data-testid="finish-button"
        >
          <Flag className="h-4 w-4" /> Finish
        </button>
      </div>
    </Card>
  );
}

function ExerciseCard({ exercise, index, count, direction, onPrev, onNext, onFinish }) {
  const { state, dispatch } = useStore();
  const { sessions, active } = state;

  const bests = useMemo(() => bestsFor(sessions, exercise.id), [sessions, exercise.id]);
  const mySets = active.sets.filter((s) => s.exId === exercise.id);
  const [lo] = parseRepRange(exercise.targetReps);

  // Start from the last set logged for this lift, otherwise from last session's top set.
  const seed = mySets.at(-1) ?? bests.last;
  const [kg, setKg] = useState(String(seed?.kg ?? ''));
  const [reps, setReps] = useState(String(seed?.reps ?? lo));
  const [rpe, setRpe] = useState(String(mySets.at(-1)?.rpe ?? 8));
  const [rest, setRest] = useState(exercise.restSec);
  const [customOpen, setCustomOpen] = useState(!REST_PRESETS.includes(exercise.restSec));
  const [error, setError] = useState('');
  const touch = useRef(null);

  const kgNum = Number.parseFloat(kg) || 0;
  const repsNum = Number.parseInt(reps, 10) || 0;
  const rpeNum = Number.parseFloat(rpe);
  const e1rm = epley1RM(kgNum, repsNum);
  const isLast = index === count - 1;
  const targetHit = mySets.length >= exercise.sets;

  const handleCompleteSet = () => {
    // Linter false positive: this only ever runs from the button's onClick, never during render.
    // oxlint-disable-next-line react/purity
    const loggedAt = Date.now();
    if (repsNum < 1) {
      setError('Enter the reps you completed.');
      return;
    }
    if (kgNum < 0 || kgNum > 600 || repsNum > 200) {
      setError('That number looks off — check the load and reps.');
      return;
    }
    setError('');
    const pr = isPR({ kg: kgNum, reps: repsNum }, bests, mySets);
    dispatch({
      type: 'LOG_SET',
      set: {
        id: uid(),
        exId: exercise.id,
        name: exercise.name,
        group: exercise.group,
        kg: kgNum,
        reps: repsNum,
        rpe: Number.isFinite(rpeNum) ? Math.max(1, Math.min(10, rpeNum)) : null,
        at: loggedAt,
        ...(pr ? { pr: true } : null),
      },
    });
    dispatch({ type: 'START_TIMER', seconds: Math.max(5, Math.min(900, Number(rest) || exercise.restSec)), now: loggedAt });
    if (pr) sound.playPRCelebration();
    else sound.playTap();
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && !isLast) onNext();
    if (dx > 0 && index > 0) onPrev();
  };

  return (
    <section
      className={`ios-card space-y-3.5 p-4 ${direction === 'prev' ? 'slide-prev' : 'slide-next'}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-testid="exercise-card"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate rounded-full bg-sysblue/20 px-2.5 py-1 text-[12px] font-semibold text-sysblue">
            Target: {exercise.muscle}
          </span>
          <span className="tabular shrink-0 text-[12px] font-medium text-mute">
            {index + 1} / {count}
          </span>
        </div>
        <h2 className="mt-2 text-[21px] font-bold leading-tight tracking-tight text-white" data-testid="exercise-name">
          {exercise.name}
        </h2>
        <p className="tabular mt-1 text-[13px] text-mute">
          {exercise.sets} sets × {exercise.targetReps} reps
          {bests.kg > 0 && (
            <>
              {' · '}Best <strong className="font-semibold text-white">{bests.kg} kg</strong>
            </>
          )}
          {bests.last && (
            <>
              {' · '}Last {bests.last.kg > 0 ? `${bests.last.kg} × ` : ''}
              {bests.last.reps} ({formatDM(bests.last.date)})
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2" aria-label={`${mySets.length} of ${exercise.sets} sets done`}>
        <div className="flex gap-1.5">
          {Array.from({ length: Math.max(exercise.sets, mySets.length) }, (_, i) => (
            <span key={i} className={`h-2 w-7 rounded-full ${i < mySets.length ? 'bg-accent' : 'bg-white/15'}`} />
          ))}
        </div>
        <span className="tabular text-[12px] font-medium text-mute">
          {targetHit ? 'Target sets done' : `Set ${mySets.length + 1} of ${exercise.sets}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stepper label="Load" unit="kg" value={kg} onChange={setKg} step={2.5} max={600} />
        <Stepper label="Reps" value={reps} onChange={setReps} step={1} max={200} inputMode="numeric" />
        <Stepper label="RPE" value={rpe} onChange={setRpe} step={0.5} min={1} max={10} />
      </div>

      <div className="tabular flex items-center justify-between rounded-xl bg-black/40 px-3 py-2 text-[12px] text-mute">
        <span>
          Est. 1RM (Epley) <strong className="font-semibold text-white" data-testid="e1rm">{e1rm > 0 ? `${round1(e1rm)} kg` : '—'}</strong>
        </span>
        <span>
          Set volume <strong className="font-semibold text-white">{kgText(kgNum * repsNum)} kg</strong>
        </span>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-mute">Rest after this set</p>
        <div className="grid grid-cols-4 gap-1.5">
          {REST_PRESETS.map((sec) => (
            <button
              key={sec}
              type="button"
              aria-pressed={!customOpen && rest === sec}
              onClick={() => {
                sound.playTap();
                setRest(sec);
                setCustomOpen(false);
              }}
              className={`ios-press tabular h-10 rounded-xl text-[14px] font-semibold ${
                !customOpen && rest === sec ? 'bg-rest text-black' : 'bg-elevated text-ivory'
              }`}
            >
              {sec}s
            </button>
          ))}
          <button
            type="button"
            aria-pressed={customOpen}
            onClick={() => {
              sound.playTap();
              setCustomOpen(true);
            }}
            className={`ios-press tabular h-10 rounded-xl text-[14px] font-semibold ${customOpen ? 'bg-rest text-black' : 'bg-elevated text-ivory'}`}
          >
            {customOpen ? `${rest}s` : 'Custom'}
          </button>
        </div>
        {customOpen && (
          <label className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-1.5 text-[13px] text-mute">
            Custom rest (seconds)
            <input
              type="number"
              inputMode="numeric"
              min={5}
              max={900}
              value={rest}
              onChange={(e) => setRest(e.target.value === '' ? '' : Math.max(0, Math.min(900, Number(e.target.value) || 0)))}
              onFocus={(e) => e.target.select()}
              aria-label="Custom rest in seconds"
              className="tabular w-20 bg-transparent text-right font-bold text-white focus:outline-none"
            />
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCompleteSet}
        className="ios-press h-[52px] w-full rounded-2xl bg-accent text-[15px] font-bold text-black"
        data-testid="complete-set"
      >
        Complete set · rest {Number(rest) || exercise.restSec}s
      </button>

      {mySets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-mute">Logged this session</p>
          <ul className="space-y-1.5">
            {mySets.map((s, i) => (
              <li key={s.id} className="fade-up flex items-center gap-2 rounded-xl bg-elevated/70 py-1 pl-3 pr-1" data-testid="logged-set">
                <span className="tabular w-10 shrink-0 text-[12px] text-mute">Set {i + 1}</span>
                <span className="tabular min-w-0 flex-1 truncate text-[14px] font-bold text-accent">
                  {s.kg > 0 ? `${s.kg} kg × ${s.reps}` : `${s.reps} reps`}
                  {s.rpe != null && <span className="font-medium text-mute"> · RPE {s.rpe}</span>}
                </span>
                {s.pr && (
                  <span className="pr-pop flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-gold" data-testid="pr-badge">
                    <Trophy className="h-3 w-3" /> PR
                  </span>
                )}
                <span className="tabular shrink-0 text-[11px] text-mute">{formatClock(s.at)}</span>
                <button
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    dispatch({ type: 'DELETE_SET', id: s.id });
                  }}
                  aria-label={`Delete set ${i + 1}`}
                  className="ios-press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mute"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={onPrev}
          className="ios-press flex h-11 items-center gap-1 rounded-xl bg-elevated px-3 text-[13px] font-semibold text-white disabled:opacity-30"
          data-testid="prev-exercise"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onFinish}
            className="ios-press flex h-11 items-center gap-1.5 rounded-xl bg-accent/20 px-4 text-[13px] font-bold text-accent"
          >
            <Flag className="h-4 w-4" /> Finish workout
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className={`ios-press flex h-11 items-center gap-1 rounded-xl px-3 text-[13px] font-semibold ${
              targetHit ? 'bg-accent text-black' : 'bg-elevated text-white'
            }`}
            data-testid="next-exercise"
          >
            Next exercise <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}

function summarise(active, endedAt) {
  const byExercise = new Map();
  for (const s of active.sets) {
    const row = byExercise.get(s.exId) || { name: s.name, sets: 0, top: s, pr: false };
    row.sets += 1;
    if (epley1RM(s.kg, s.reps) > epley1RM(row.top.kg, row.top.reps) || (s.kg === 0 && s.reps > row.top.reps)) row.top = s;
    if (s.pr) row.pr = true;
    byExercise.set(s.exId, row);
  }
  return {
    dayName: active.dayName,
    durationSec: (endedAt - active.startedAt) / 1000,
    volume: totalVolume(active.sets),
    sets: active.sets.length,
    prs: active.sets.filter((s) => s.pr).length,
    lifts: [...byExercise.values()],
  };
}

function WorkoutActive({ onSummary }) {
  const { state, dispatch } = useStore();
  const { active, routine } = state;
  const [direction, setDirection] = useState('next');
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const day = routine.find((d) => d.id === active.dayId);
  const exercises = day?.exercises ?? [];

  if (!exercises.length) {
    return (
      <Card className="space-y-3">
        <p className="text-[14px] text-mute">This session’s routine day no longer has any exercises.</p>
        <button
          type="button"
          onClick={() => dispatch({ type: active.sets.length ? 'FINISH_SESSION' : 'DISCARD_SESSION', now: Date.now() })}
          className="ios-press h-11 w-full rounded-2xl bg-elevated text-[14px] font-semibold text-white"
        >
          End session
        </button>
      </Card>
    );
  }

  const index = Math.min(active.exIdx, exercises.length - 1);
  const exercise = exercises[index];
  const plannedSets = exercises.reduce((acc, e) => acc + e.sets, 0);
  const setsFor = (id) => active.sets.filter((s) => s.exId === id).length;

  const go = (to) => {
    if (to < 0 || to >= exercises.length || to === index) return;
    sound.playTap();
    setDirection(to > index ? 'next' : 'prev');
    dispatch({ type: 'SET_EX_IDX', idx: to });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = () => {
    const endedAt = Date.now();
    const summary = summarise(active, endedAt);
    dispatch({ type: 'FINISH_SESSION', now: endedAt });
    setFinishOpen(false);
    sound.playWorkoutComplete();
    onSummary(summary);
  };

  return (
    <>
      <SessionBar active={active} plannedSets={plannedSets} onFinish={() => setFinishOpen(true)} />

      <div className="flex items-center gap-1.5 px-1" role="tablist" aria-label="Exercises in this session">
        {exercises.map((ex, i) => {
          const done = setsFor(ex.id) >= ex.sets;
          return (
            <button
              key={ex.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${ex.name}${done ? ', done' : ''}`}
              onClick={() => go(i)}
              className="flex h-6 flex-1 items-center"
            >
              <span
                className={`h-1.5 w-full rounded-full transition-colors duration-300 ${
                  i === index ? 'bg-white' : done ? 'bg-accent' : setsFor(ex.id) > 0 ? 'bg-accent/45' : 'bg-white/15'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* The wrapper clips the card while it slides in, so the page never scrolls sideways. */}
      <div className="overflow-hidden rounded-[20px]">
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          index={index}
          count={exercises.length}
          direction={direction}
          onPrev={() => go(index - 1)}
          onNext={() => go(index + 1)}
          onFinish={() => setFinishOpen(true)}
        />
      </div>

      <BottomSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish workout?"
        subtitle={active.dayName}
        testId="finish-sheet"
        footer={
          <div className="space-y-2">
            <button
              type="button"
              disabled={active.sets.length === 0}
              onClick={save}
              className="ios-press h-12 w-full rounded-2xl bg-accent text-[15px] font-bold text-black disabled:opacity-40"
              data-testid="save-session"
            >
              Finish &amp; save
            </button>
            <button type="button" onClick={() => setFinishOpen(false)} className="ios-press h-11 w-full rounded-2xl bg-elevated text-[14px] font-semibold text-white">
              Keep training
            </button>
            <button type="button" onClick={() => setDiscardOpen(true)} className="h-10 w-full text-[14px] font-medium text-danger" data-testid="discard-session">
              Discard session
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Sets" value={`${active.sets.length}/${plannedSets}`} valueClass="text-accent" />
          <Stat label="Volume" value={kgText(totalVolume(active.sets))} sub="kg" valueClass="text-sysblue" />
          <Stat label="PRs" value={active.sets.filter((s) => s.pr).length} valueClass="text-gold" />
        </div>
        {active.sets.length === 0 && <p className="mt-3 text-[13px] text-mute">No sets logged yet, so there is nothing to save.</p>}
        {active.sets.length > 0 && active.sets.length < plannedSets && (
          <p className="mt-3 text-[13px] text-mute">
            {plannedSets - active.sets.length} planned sets are still open. Finishing early is fine — it still counts.
          </p>
        )}
      </BottomSheet>

      <ConfirmModal
        open={discardOpen}
        title="Discard this session?"
        message={`${active.sets.length} logged ${active.sets.length === 1 ? 'set' : 'sets'} will be deleted. This can’t be undone.`}
        confirmLabel="Discard"
        destructive
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          setFinishOpen(false);
          dispatch({ type: 'DISCARD_SESSION' });
        }}
      />
    </>
  );
}

function SummarySheet({ summary, onClose }) {
  return (
    <BottomSheet
      open={Boolean(summary)}
      onClose={onClose}
      title="Workout complete"
      subtitle={summary?.dayName}
      testId="summary-sheet"
      footer={
        <button type="button" onClick={onClose} className="ios-press h-12 w-full rounded-2xl bg-accent text-[15px] font-bold text-black">
          Done
        </button>
      }
    >
      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            <Stat label="Time" value={formatDuration(summary.durationSec)} />
            <Stat label="Volume" value={kgText(summary.volume)} sub="kg" valueClass="text-sysblue" />
            <Stat label="Sets" value={summary.sets} valueClass="text-accent" />
            <Stat label="PRs" value={summary.prs} valueClass="text-gold" />
          </div>
          <ul className="space-y-1.5">
            {summary.lifts.map((lift) => (
              <li key={lift.name} className="flex items-center justify-between gap-2 rounded-xl bg-elevated/70 px-3 py-2.5">
                <span className="min-w-0 truncate text-[14px] font-medium text-white">{lift.name}</span>
                <span className="tabular flex shrink-0 items-center gap-2 text-[13px] text-mute">
                  {lift.pr && <Trophy className="h-3.5 w-3.5 text-gold" aria-label="Personal record" />}
                  {lift.sets} {lift.sets === 1 ? 'set' : 'sets'} · top {lift.top.kg > 0 ? `${lift.top.kg} kg × ${lift.top.reps}` : `${lift.top.reps} reps`}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1.5 text-[12px] text-mute">
            <Clock className="h-3.5 w-3.5" /> Saved to your history. Log today’s protein on the Today tab.
          </p>
        </div>
      )}
    </BottomSheet>
  );
}

export function WorkoutTab({ today }) {
  const { state } = useStore();
  const [summary, setSummary] = useState(null);
  return (
    <>
      {state.active ? <WorkoutActive onSummary={setSummary} /> : <WorkoutIdle today={today} />}
      <SummarySheet summary={summary} onClose={() => setSummary(null)} />
    </>
  );
}
