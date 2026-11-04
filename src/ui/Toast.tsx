import { createContext, useCallback, useContext, useEffect, useState } from "react";
import styles from "./Toast.module.css";

/**
 * Message temporaire en bas de l'écran, avec une action facultative
 * (par exemple « Annuler » après une suppression).
 */

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const DISPLAY_DURATION_MS = 5000;

const ToastContext = createContext<(toast: ToastOptions) => void>(() => {});

/** Renvoie la fonction qui affiche un toast. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // L'identifiant change à chaque toast : il relance le minuteur et l'animation.
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const runAction = () => {
    toast?.onAction?.();
    setToast(null);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div key={toast.id} className={styles.toast} role="status">
          <span className={styles.message}>{toast.message}</span>
          {toast.actionLabel && (
            <button type="button" className={styles.action} onClick={runAction}>
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
