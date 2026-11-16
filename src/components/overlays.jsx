import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Stop the page behind a sheet or alert from scrolling while it is open. */
function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [active]);
}

function useEscape(active, onClose) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}

/** iOS bottom sheet: slides up over a blurred backdrop, scrolls inside itself. */
export function BottomSheet({ open, onClose, title, subtitle, children, footer, testId }) {
  useScrollLock(open);
  useEscape(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid={testId}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="backdrop-in absolute inset-0 cursor-default bg-black/75 backdrop-blur-xl"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-up relative flex max-h-[92dvh] w-full max-w-[430px] flex-col rounded-t-[28px] border border-b-0 border-white/10 bg-card shadow-2xl"
      >
        <div className="shrink-0 px-4 pt-2">
          <div className="mx-auto h-[5px] w-9 rounded-full bg-white/25" aria-hidden="true" />
          <div className="mt-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[19px] font-bold tracking-tight text-white">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ios-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-mute"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">{children}</div>
        {footer && <div className="pb-safe shrink-0 border-t border-white/10 px-4 pt-3">{footer}</div>}
        {!footer && <div className="pb-safe shrink-0" />}
      </div>
    </div>,
    document.body,
  );
}

/** iOS alert: centred, two buttons, the destructive one in red. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  useScrollLock(open);
  useEscape(open, onCancel);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-8">
      <div className="backdrop-in absolute inset-0 bg-black/75 backdrop-blur-xl" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="alert-pop relative w-full max-w-[290px] overflow-hidden rounded-[18px] border border-white/10 bg-[#252527]/95 text-center shadow-2xl"
      >
        <div className="px-5 pb-4 pt-5">
          <h2 id="confirm-title" className="text-[17px] font-semibold leading-snug text-white">
            {title}
          </h2>
          <p id="confirm-message" className="mt-1.5 text-[13px] leading-snug text-ivory/80">
            {message}
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-white/15">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 border-r border-white/15 text-[17px] text-sysblue active:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-11 text-[17px] font-semibold active:bg-white/10 ${destructive ? 'text-danger' : 'text-sysblue'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
