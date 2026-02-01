"use client";

type SellTicketDisclaimerModalProps = {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
};

export default function SellTicketDisclaimerModal({
  open,
  onClose,
  onAccept,
}: SellTicketDisclaimerModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4 opacity-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-disclaimer-title"
      onClick={onClose}
    >
      <div
        className="modal-panel w-full max-w-md max-h-[90vh] overflow-y-auto cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sell-disclaimer-title" className="font-display text-xl font-bold text-army-purple">
          Sell ticket – disclaimer
        </h2>
        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Made by Army, for Army.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Only <strong>face value</strong> is accepted. By listing a ticket, you agree to sell at face value only. If you list above face value, ARMY will report you and you will be <strong>banned from the platform</strong>.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-army-outline">
            Cancel
          </button>
          <button type="button" onClick={onAccept} className="btn-army">
            I understand, continue
          </button>
        </div>
      </div>
    </div>
  );
}
