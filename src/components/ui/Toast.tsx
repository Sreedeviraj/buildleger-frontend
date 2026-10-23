import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleCheck, CircleAlert } from 'lucide-react';

type Tone = 'success' | 'error';
type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: Tone }[]>([]);

  const show = useCallback<ShowToast>((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl px-5 py-4 text-base font-semibold text-white shadow-lg ${
              toast.tone === 'success' ? 'bg-blue-700' : 'bg-red-700'
            }`}
          >
            {toast.tone === 'success' ? (
              <CircleCheck className="size-5 shrink-0" aria-hidden />
            ) : (
              <CircleAlert className="size-5 shrink-0" aria-hidden />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
