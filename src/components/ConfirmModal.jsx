import Modal from './Modal.jsx'

// The site's own "Are you sure?" box, instead of the browser's confirm() pop-up.
// `onConfirm` may be async; the buttons stay disabled while `busy`.
export default function ConfirmModal({
  open, title, children, confirmLabel = 'Confirm', busyLabel, danger = false, busy = false, onConfirm, onClose,
}) {
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title}>
      <div className="text-[14px] text-ink-soft">{children}</div>
      <div className="mt-5 flex gap-2.5">
        <button className="btn-ghost flex-1" onClick={onClose} disabled={busy} autoFocus>Cancel</button>
        <button className={`${danger ? 'btn-danger' : 'btn-accent'} flex-1`} onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel || `${confirmLabel}…` : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
