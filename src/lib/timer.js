// The rest timer stores the moment it should END, never a countdown that ticks.
// Whatever happens to the page in between (screen lock, app switch, reload),
// the time left is always just `endsAt - now`.

export function remainingSeconds(endsAt, now = Date.now()) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function startTimer(durationSec, now = Date.now()) {
  const durationMs = Math.max(1, Math.round(durationSec)) * 1000;
  return { endsAt: now + durationMs, durationMs };
}

/** Add or remove seconds. Never drops below one second left. */
export function adjustTimer(timer, deltaSec, now = Date.now()) {
  const endsAt = Math.max(now + 1000, timer.endsAt + deltaSec * 1000);
  const applied = endsAt - timer.endsAt;
  return { endsAt, durationMs: Math.max(1000, timer.durationMs + applied) };
}

/** 1 = full ring, 0 = finished */
export function fractionLeft(timer, now = Date.now()) {
  return Math.max(0, Math.min(1, (timer.endsAt - now) / timer.durationMs));
}
