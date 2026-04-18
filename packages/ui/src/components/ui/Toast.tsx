import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../cn';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  const contextValue: ToastContextType = {
    toast: addToast,
    success: (message, duration) => addToast('success', message, duration),
    error: (message, duration) => addToast('error', message, duration),
    warning: (message, duration) => addToast('warning', message, duration),
    info: (message, duration) => addToast('info', message, duration),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} className="text-[var(--accent-green)]" />,
    error: <XCircle size={16} className="text-[var(--accent-red)]" />,
    warning: <AlertCircle size={16} className="text-[var(--accent-amber)]" />,
    info: <Info size={16} className="text-[var(--accent-blue)]" />,
  };

  const borderColors: Record<ToastType, string> = {
    success: 'border-l-[var(--accent-green)]',
    error: 'border-l-[var(--accent-red)]',
    warning: 'border-l-[var(--accent-amber)]',
    info: 'border-l-[var(--accent-blue)]',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-auto flex items-center gap-3 px-4 py-3 min-w-[300px] max-w-[400px]',
        'bg-[var(--surface-overlay)] border border-[var(--border-default)]',
        'border-l-2 rounded-[var(--radius-lg)] shadow-lg',
        borderColors[toast.type]
      )}
    >
      {icons[toast.type]}
      <p className="flex-1 text-[13px] text-[var(--text-primary)]">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-[var(--surface-raised)] rounded-[var(--radius-sm)] transition-colors"
      >
        <X size={14} className="text-[var(--text-tertiary)]" />
      </button>
    </motion.div>
  );
}
