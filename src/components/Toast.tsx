import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";

type ToastType = "info" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastCtx = createContext<ToastContextType>({ toast: () => {} });

let nextId = 0;

export function ToastProvider({ children, position = "bottom-left" }: { children: ReactNode; position?: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const posStyle: React.CSSProperties = {
    bottom: position.includes("bottom") ? 16 : "auto",
    top: position.includes("top") ? 16 : "auto",
    left: position.includes("left") ? 16 : position.includes("center") ? "50%" : "auto",
    right: position.includes("right") ? 16 : "auto",
    transform: position.includes("center") ? "translateX(-50%)" : undefined,
    flexDirection: position.includes("top") ? "column" : "column-reverse",
  };

  return (
    <ToastCtx.Provider value={{ toast: addToast }}>
      {children}
      <div className="toast-container" style={posStyle}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
            <span className="toast-icon">
              {t.type === "success" ? <CheckCircle size={16} /> : t.type === "error" ? <AlertTriangle size={16} /> : <Info size={16} />}
            </span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); removeToast(t.id); }}><X size={13} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
