import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Alias for confirmText (backward compatibility) */
  confirmLabel?: string;
  /** Alias for cancelText (backward compatibility) */
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  isLoading = false,
}: ConfirmDialogProps) {
  const resolvedConfirmText = confirmText ?? confirmLabel ?? 'Confirm';
  const resolvedCancelText = cancelText ?? cancelLabel ?? 'Cancel';
  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      : 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
        {variant === 'danger' && (
          <div className="mb-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mb-0 sm:mr-4">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {resolvedCancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${confirmButtonClass}`}
        >
          {isLoading && (
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {resolvedConfirmText}
        </button>
      </div>
    </Modal>
  );
}
