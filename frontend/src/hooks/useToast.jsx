import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CircleCheck, X } from "lucide-react";

const ToastContext = createContext(null);
const TOAST_DURATION_MS = 3500;

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm justify-end"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-border bg-popover py-3 pr-3 pl-4 text-sm font-medium text-popover-foreground shadow-lg shadow-black/10 animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none dark:shadow-black/40"
          >
            <CircleCheck className="size-4 shrink-0 text-green" />
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss notification"
              className="ml-1 flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
