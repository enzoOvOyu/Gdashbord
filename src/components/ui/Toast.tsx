// Toast（操作反馈：删除/启停/创建的成功与失败提示）
import { create } from 'zustand';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, CircleAlert } from 'lucide-react';
import clsx from 'clsx';
import s from './ui.module.css';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (tone, message) => {
    seq += 1;
    const id = seq;
    set((st) => ({ items: [...st.items, { id, tone, message }] }));
    setTimeout(() => {
      set((st) => ({ items: st.items.filter((i) => i.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((st) => ({ items: st.items.filter((i) => i.id !== id) })),
}));

export const toast = {
  success: (m: string): void => useToastStore.getState().push('success', m),
  error: (m: string): void => useToastStore.getState().push('error', m),
  info: (m: string): void => useToastStore.getState().push('info', m),
};

export function ToastHost() {
  const items = useToastStore((st) => st.items);
  const dismiss = useToastStore((st) => st.dismiss);
  useEffect(() => {
    if (items.length === 0) return;
  }, [items.length]);
  if (items.length === 0) return null;
  return createPortal(
    <div className={s.toastWrap}>
      {items.map((t) => (
        <div
          key={t.id}
          className={clsx(
            s.toast,
            t.tone === 'error' && s.toastError,
            t.tone === 'success' && s.toastSuccess,
          )}
          onClick={() => dismiss(t.id)}
          role="status"
        >
          {t.tone === 'error'
            ? <CircleAlert size={16} color="var(--rs-danger)" />
            : <CircleCheck size={16} color="var(--rs-success)" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
