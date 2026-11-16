import { ArrowDown, ArrowUp, ChevronLeft, Download, Eraser, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { JOHOR_DISTRICTS, findDistrict } from '../data/lifeOsData';
import { MUSCLE_GROUPS } from '../lib/calc';
import { dayKey, formatDMY } from '../lib/dates';
import { useStore } from '../store/context';
import { hasSampleData, uid } from '../store/state';
import { backupFileName, parseBackup, serializeBackup } from '../store/storage';
import { sound } from '../utils/sound';
import { BottomSheet, ConfirmModal } from './overlays';
import { Toggle } from './ui';

const APP_VERSION = '1.0.0';

function Section({ title, children, note }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[12px] font-semibold uppercase tracking-wider text-mute">{title}</h3>
      <div className="divide-y divide-white/8 overflow-hidden rounded-2xl bg-elevated/70">{children}</div>
      {note && <p className="px-1 text-[12px] leading-snug text-mute">{note}</p>}
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[15px] text-white">{label}</p>
        {hint && <p className="text-[12px] leading-snug text-mute">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Number setting that only commits a sane value when you leave the field. */
function NumberSetting({ label, hint, settingKey, min, max, step = 1, unit }) {
  const { state, dispatch } = useStore();
  const current = state.settings[settingKey];
  const [draft, setDraft] = useState(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number.parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(n)) {
      const clamped = Math.max(min, Math.min(max, n));
      dispatch({ type: 'SET_SETTING', key: settingKey, value: Math.round(clamped / step) * step });
    }
    setDraft(null);
  };

  return (
    <Row label={label} hint={hint}>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft ?? String(Number(current.toFixed(2)))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onFocus={(e) => e.target.select()}
          aria-label={label}
          data-testid={`setting-${settingKey}`}
          className="tabular h-9 w-[72px] rounded-lg bg-black/40 px-2 text-right font-semibold text-white focus:outline-none focus:ring-2 focus:ring-sysblue"
        />
        <span className="w-7 text-[13px] text-mute">{unit}</span>
      </span>
    </Row>
  );
}

function ActionRow({ icon: Icon, label, hint, onClick, tone = 'text-sysblue', testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="flex min-h-[48px] w-full items-center gap-3 px-3 py-2 text-left active:bg-white/5">
      <Icon className={`h-[18px] w-[18px] shrink-0 ${tone}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] ${tone}`}>{label}</span>
        {hint && <span className="block text-[12px] leading-snug text-mute">{hint}</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Routine editor
// ---------------------------------------------------------------------------

const blankExercise = () => ({
  id: uid(),
  name: '',
  muscle: '',
  group: 'Shoulders',
  sets: 3,
  targetReps: '8-12',
  restSec: 90,
});

function ExerciseForm({ dayId, initial, isNew, onDone }) {
  const { dispatch } = useStore();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () => {
    const name = form.name.trim();
    const sets = Math.round(Number(form.sets));
    const restSec = Math.round(Number(form.restSec));
    if (!name) return setError('Give the exercise a name.');
    if (!(sets >= 1 && sets <= 10)) return setError('Sets should be between 1 and 10.');
    if (!/\d/.test(form.targetReps)) return setError('Target reps needs a number, e.g. 8-12.');
    if (!(restSec >= 10 && restSec <= 600)) return setError('Rest should be between 10 and 600 seconds.');
    sound.playTap();
    dispatch({
      type: 'UPSERT_EXERCISE',
      dayId,
      exercise: {
        id: form.id,
        name: name.slice(0, 60),
        muscle: (form.muscle.trim() || form.group).slice(0, 40),
        group: form.group,
        sets,
        targetReps: form.targetReps.trim().slice(0, 12),
        restSec,
      },
    });
    return onDone();
  };

  const field = 'h-11 w-full rounded-xl bg-black/40 px-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sysblue';

  return (
    <div className="space-y-3" data-testid="exercise-form">
      <button type="button" onClick={onDone} className="ios-press -ml-1 flex h-9 items-center gap-0.5 text-[15px] text-sysblue">
        <ChevronLeft className="h-5 w-5" /> Routine
      </button>
      <h3 className="text-[17px] font-bold text-white">{isNew ? 'Add exercise' : 'Edit exercise'}</h3>

      <label className="block space-y-1">
        <span className="text-[12px] text-mute">Exercise name</span>
        <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Face Pull" maxLength={60} className={field} data-testid="ex-name" />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block space-y-1">
          <span className="text-[12px] text-mute">Muscle group (charts)</span>
          <select value={form.group} onChange={set('group')} className={field} data-testid="ex-group">
            {MUSCLE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] text-mute">Target muscle (label)</span>
          <input type="text" value={form.muscle} onChange={set('muscle')} placeholder="e.g. Rear Delts" maxLength={40} className={field} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <label className="block space-y-1">
          <span className="text-[12px] text-mute">Sets</span>
          <input type="number" inputMode="numeric" min={1} max={10} value={form.sets} onChange={set('sets')} className={`${field} tabular text-center`} data-testid="ex-sets" />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] text-mute">Target reps</span>
          <input type="text" inputMode="text" value={form.targetReps} onChange={set('targetReps')} placeholder="8-12" maxLength={12} className={`${field} tabular text-center`} />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] text-mute">Rest (s)</span>
          <input type="number" inputMode="numeric" min={10} max={600} value={form.restSec} onChange={set('restSec')} className={`${field} tabular text-center`} />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <button type="button" onClick={save} className="ios-press h-12 w-full rounded-2xl bg-accent text-[15px] font-bold text-black" data-testid="ex-save">
        {isNew ? 'Add to routine' : 'Save changes'}
      </button>
      {!isNew && (
        <button type="button" onClick={() => setConfirmDelete(true)} className="flex h-11 w-full items-center justify-center gap-2 text-[15px] text-danger" data-testid="ex-delete">
          <Trash2 className="h-4 w-4" /> Remove from routine
        </button>
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Remove this exercise?"
        message={`“${initial.name}” leaves your routine. Sets you already logged stay in your history.`}
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          dispatch({ type: 'DELETE_EXERCISE', dayId, exId: initial.id });
          setConfirmDelete(false);
          onDone();
        }}
      />
    </div>
  );
}

function RoutineEditor({ onEdit }) {
  const { state, dispatch } = useStore();
  const [openDay, setOpenDay] = useState(state.routine[0]?.id ?? null);

  return (
    <section className="space-y-2" data-testid="routine-editor">
      <h3 className="px-1 text-[12px] font-semibold uppercase tracking-wider text-mute">Routine · 4-day upper/lower</h3>
      <div className="grid grid-cols-4 gap-1.5">
        {state.routine.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={openDay === d.id}
            onClick={() => setOpenDay(d.id)}
            className={`ios-press h-10 truncate rounded-xl px-1 text-[13px] font-semibold ${openDay === d.id ? 'bg-accent text-black' : 'bg-elevated/70 text-mute'}`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {state.routine
        .filter((d) => d.id === openDay)
        .map((day) => (
          <div key={day.id} className="overflow-hidden rounded-2xl bg-elevated/70">
            <p className="border-b border-white/8 px-3 py-2 text-[12px] text-mute">{day.focus}</p>
            <ul className="divide-y divide-white/8">
              {day.exercises.map((ex, i) => (
                <li key={ex.id} className="flex items-center gap-1 py-1.5 pl-3 pr-1" data-testid="routine-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-white">{ex.name}</p>
                    <p className="tabular truncate text-[12px] text-mute">
                      {ex.group} · {ex.sets} × {ex.targetReps} · {ex.restSec}s
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => dispatch({ type: 'MOVE_EXERCISE', dayId: day.id, exId: ex.id, dir: -1 })}
                    aria-label={`Move ${ex.name} up`}
                    className="ios-press flex h-9 w-8 items-center justify-center text-mute disabled:opacity-25"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === day.exercises.length - 1}
                    onClick={() => dispatch({ type: 'MOVE_EXERCISE', dayId: day.id, exId: ex.id, dir: 1 })}
                    aria-label={`Move ${ex.name} down`}
                    className="ios-press flex h-9 w-8 items-center justify-center text-mute disabled:opacity-25"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit({ dayId: day.id, exercise: ex, isNew: false })}
                    aria-label={`Edit ${ex.name}`}
                    className="ios-press flex h-9 w-9 items-center justify-center text-sysblue"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onEdit({ dayId: day.id, exercise: blankExercise(), isNew: true })}
              className="flex h-11 w-full items-center justify-center gap-1.5 border-t border-white/8 text-[14px] font-semibold text-accent active:bg-white/5"
              data-testid="add-exercise"
            >
              <Plus className="h-4 w-4" /> Add exercise
            </button>
          </div>
        ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

async function deliverBackup(text, fileName) {
  const file = new File([text], fileName, { type: 'application/json' });
  // On a phone, the share sheet is the reliable way to save into Files / iCloud.
  if (navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Life OS backup' });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false; // user closed the share sheet
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export function SettingsSheet({ open, onClose, onReplayTour }) {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'reset' | 'clear' | { import: state, summary }
  const [message, setMessage] = useState(null); // { tone, text }
  const fileRef = useRef(null);

  const close = () => {
    setEditing(null);
    setMessage(null);
    onClose();
  };

  const exportBackup = async () => {
    sound.playTap();
    const now = Date.now();
    const saved = await deliverBackup(serializeBackup(state, now), backupFileName(dayKey(new Date(now))));
    if (saved) {
      dispatch({ type: 'SET_SETTING', key: 'lastBackupAt', value: now });
      setMessage({ tone: 'ok', text: 'Backup exported. Keep the file somewhere safe, like iCloud Drive.' });
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    try {
      const imported = parseBackup(await file.text());
      setConfirm({
        import: imported,
        summary: `${imported.sessions.length} sessions and ${imported.measurements.length} measurement entries`,
      });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'That file could not be read.' });
    }
  };

  return (
    <BottomSheet open={open} onClose={close} title="Routine & Data" subtitle="Settings are saved on this phone only." testId="settings-sheet">
      {editing ? (
        <ExerciseForm key={editing.exercise.id} dayId={editing.dayId} initial={editing.exercise} isNew={editing.isNew} onDone={() => setEditing(null)} />
      ) : (
        <div className="space-y-5">
          <Section title="General">
            <Row label="Sound effects" hint="Taps, rest chime and PR fanfare">
              <Toggle
                checked={!settings.muted}
                label="Sound effects"
                onChange={(on) => {
                  dispatch({ type: 'SET_SETTING', key: 'muted', value: !on });
                  if (on) {
                    sound.setMuted(false);
                    sound.playTap();
                  }
                }}
              />
            </Row>
            <Row label="District" hint={`Solat zone ${findDistrict(settings.district).zone} · also sets Qibla and weather`}>
              <select
                value={settings.district}
                onChange={(e) => dispatch({ type: 'SET_SETTING', key: 'district', value: e.target.value })}
                aria-label="District"
                data-testid="setting-district"
                className="h-9 max-w-[160px] rounded-lg bg-black/40 px-2 text-white"
              >
                {JOHOR_DISTRICTS.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Row>
          </Section>

          <Section title="Targets">
            <NumberSetting label="Daily protein" settingKey="proteinTarget" min={40} max={400} step={5} unit="g" />
            <NumberSetting label="Sessions per week" settingKey="weeklyTarget" min={1} max={7} unit="" />
            <NumberSetting label="Goal weight" settingKey="weightGoal" min={35} max={200} step={0.5} unit="kg" />
            <NumberSetting label="Goal body fat" settingKey="bodyFatGoal" min={5} max={40} step={0.5} unit="%" />
            <NumberSetting label="Goal V-taper" hint="Shoulders ÷ waist" settingKey="vTaperGoal" min={1} max={2} step={0.05} unit="" />
          </Section>

          <RoutineEditor onEdit={setEditing} />

          <Section
            title="Data"
            note={
              settings.lastBackupAt
                ? `Last backup: ${formatDMY(dayKey(new Date(settings.lastBackupAt)))}. Everything lives only on this phone, so export regularly.`
                : 'No backup yet. Everything lives only on this phone — export a backup now and then so a lost or reset phone doesn’t take your history with it.'
            }
          >
            <ActionRow icon={Download} label="Export backup (JSON)" onClick={exportBackup} testId="export-backup" />
            <ActionRow icon={Upload} label="Import backup" hint="Replaces everything currently in the app" onClick={() => fileRef.current?.click()} testId="import-backup" />
            {hasSampleData(state) && (
              <ActionRow icon={Eraser} label="Clear sample data" hint="Removes the demo history, keeps what you logged" onClick={() => setConfirm('clear')} tone="text-gold" testId="clear-sample" />
            )}
            <ActionRow icon={RotateCcw} label="Reset to default" hint="Erases everything and restores the sample routine" onClick={() => setConfirm('reset')} tone="text-danger" testId="reset-default" />
          </Section>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" data-testid="import-file" />

          {message && (
            <p role="status" className={`rounded-xl px-3 py-2 text-[13px] ${message.tone === 'error' ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'}`} data-testid="settings-message">
              {message.text}
            </p>
          )}

          <Section title="About">
            <ActionRow
              icon={RotateCcw}
              label="Replay quick tour"
              onClick={() => {
                onReplayTour();
                close();
              }}
            />
            <Row label="Version">
              <span className="tabular text-[15px] text-mute">{APP_VERSION}</span>
            </Row>
          </Section>
          <p className="px-1 text-[12px] leading-snug text-mute">
            On iPhone: open in Safari → Share → Add to Home Screen. The installed app works fully offline; prayer times
            and weather refresh whenever you are online.
          </p>
        </div>
      )}

      <ConfirmModal
        open={confirm === 'reset'}
        title="Reset to default?"
        message="This erases all sessions, measurements, prayer and protein logs and your custom routine. It can’t be undone."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          dispatch({ type: 'RESET', now: Date.now() });
          setConfirm(null);
          setMessage({ tone: 'ok', text: 'Everything is back to the defaults.' });
        }}
      />
      <ConfirmModal
        open={confirm === 'clear'}
        title="Clear sample data?"
        message="The sample sessions, measurements and protein entries will be removed. Anything you logged yourself stays."
        confirmLabel="Clear"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          dispatch({ type: 'CLEAR_SAMPLE' });
          setConfirm(null);
          setMessage({ tone: 'ok', text: 'Sample data cleared. The app now shows only your own numbers.' });
        }}
      />
      <ConfirmModal
        open={Boolean(confirm?.import)}
        title="Replace all data?"
        message={confirm?.import ? `This backup holds ${confirm.summary}. It will replace everything currently in the app.` : ''}
        confirmLabel="Replace"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          dispatch({ type: 'IMPORT', state: confirm.import });
          setConfirm(null);
          setMessage({ tone: 'ok', text: 'Backup restored.' });
        }}
      />
    </BottomSheet>
  );
}
