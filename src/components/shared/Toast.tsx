import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle, Printer, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'print' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
let globalSetToasts: ((fn: (prev: ToastItem[]) => ToastItem[]) => void) | null = null;

export function showToast(message: string, type: ToastType = 'info') {
  if (globalSetToasts) {
    const id = ++toastId;
    globalSetToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      if (globalSetToasts) {
        globalSetToasts(prev => prev.filter(t => t.id !== id));
      }
    }, 2500);
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    globalSetToasts = setToasts;
    return () => { globalSetToasts = null; };
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-slide-in
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'print' ? 'bg-gray-800 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
          `}
        >
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.type === 'print' && <Printer size={16} />}
          <span>{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="ml-1 opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
