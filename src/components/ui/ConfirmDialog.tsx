// 确认对话框（DESIGN-SYSTEM §5.21：危险操作二次确认，支持键入名称确认）
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import s from './ui.module.css';
import { Button } from './Button';
import { Input } from './Input';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** 破坏性说明（必须说清后果，PRD §5.4.1） */
  description: ReactNode;
  /** 需要键入的名称（启用键入确认） */
  confirmText?: string;
  confirmLabel?: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  confirmLabel = '确认删除',
  pending,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const needType = Boolean(confirmText);
  const matched = !needType || typed.trim() === (confirmText ?? '').trim();

  return createPortal(
    <div className={s.modalOverlay} onClick={onCancel} role="presentation">
      <div
        className={s.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={s.modalHeader}>
          <span style={{ color: 'var(--rs-danger)', display: 'flex' }}>
            <AlertTriangle size={18} />
          </span>
          {title}
        </div>
        <div className={s.modalBody}>
          {description}
          {needType && (
            <div className={s.field} style={{ marginTop: 12 }}>
              <label className={s.fieldLabel}>
                请输入 <b>{confirmText}</b> 以确认
              </label>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmText}
                autoFocus
              />
            </div>
          )}
          {error && <div className={s.fieldError}>{error}</div>}
        </div>
        <div className={s.modalFooter}>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!matched || pending}
          >
            {pending ? '处理中…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
