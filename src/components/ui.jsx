import { Minus, Plus } from 'lucide-react';
import { clampPct } from '../lib/calc';
import { sound } from '../utils/sound';

export function Card({ className = '', children, ...rest }) {
  return (
    <section className={`ios-card p-4 ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ icon: Icon, iconClass = 'text-gold', title, right }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden="true" />}
        <h2 className="truncate text-[15px] font-bold tracking-tight text-white">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/** Single circular progress ring with content in the middle. */
export function ProgressRing({ size = 96, stroke = 9, pct, color, children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = clampPct(pct);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${label}: ${Math.round(value)}%` : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth={stroke} />
        <circle
          className="ring-stroke"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Three concentric rings, Apple Watch style. `rings` runs outside → inside. */
export function ActivityRings({ rings, size = 128, stroke = 13, gap = 3 }) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={rings.map((r) => `${r.label} ${Math.round(clampPct(r.pct))}%`).join(', ')}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {rings.map((ring, i) => {
          const r = (size - stroke) / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const value = clampPct(ring.pct);
          return (
            <g key={ring.label}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.color} strokeOpacity="0.2" strokeWidth={stroke} />
              <circle
                className="ring-stroke"
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                // keep a visible dot at 0% like the Watch does
                strokeDashoffset={c * (1 - Math.max(value, 0.6) / 100)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Number field with − / + buttons sized for thumbs. */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 999, inputMode = 'decimal', unit }) {
  const bump = (dir) => {
    sound.playTap();
    const current = Number.parseFloat(value);
    const base = Number.isFinite(current) ? current : 0;
    const next = Math.max(min, Math.min(max, Math.round((base + dir * step) * 100) / 100));
    onChange(String(next));
  };
  const id = `stepper-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="rounded-2xl bg-elevated p-2.5">
      <label htmlFor={id} className="block text-center text-[11px] font-medium text-mute">
        {label}
        {unit ? ` (${unit})` : ''}
      </label>
      <input
        id={id}
        type="number"
        inputMode={inputMode}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="tabular w-full bg-transparent py-0.5 text-center text-[22px] font-bold text-white focus:outline-none"
      />
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`Decrease ${label}`}
          className="ios-press flex h-10 items-center justify-center rounded-xl bg-black/40 text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`Increase ${label}`}
          className="ios-press flex h-10 items-center justify-center rounded-xl bg-black/40 text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** iOS-style on/off switch. */
export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-[#39393D]'
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform duration-200 ease-ios ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

export function Stat({ label, value, sub, valueClass = 'text-white' }) {
  return (
    <div className="min-w-0 rounded-2xl bg-elevated/80 px-2 py-2.5 text-center">
      <p className="truncate text-[11px] text-mute">{label}</p>
      <p className={`tabular mt-0.5 truncate text-[17px] font-bold leading-tight ${valueClass}`}>{value}</p>
      {sub && <p className="truncate text-[11px] text-mute">{sub}</p>}
    </div>
  );
}
