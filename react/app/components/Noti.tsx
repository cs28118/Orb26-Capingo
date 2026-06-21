import { useState, useEffect } from 'react';
import './Noti.css';

export type ToastMessage = {
  id: number;
  type: 'quest' | 'levelup';
  title: string;
  message: string;
};

export const triggerToast = (type: 'quest' | 'levelup', title: string, message: string) => {
  const event = new CustomEvent('capingo-toast', { detail: { type, title, message } });
  window.dispatchEvent(event);
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newToast = { id: Date.now(), ...customEvent.detail };
      setToasts((prev) => [...prev, newToast]);
    };

    window.addEventListener('capingo-toast', handleToast);
    return () => window.removeEventListener('capingo-toast', handleToast);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast-box ${toast.type}`}>
      <div className="toast-header">
        <strong>{toast.title}</strong>
        <button className="toast-close" onClick={onClose}>X</button>
      </div>
      <div className="toast-content">
        <p>{toast.message}</p>
      </div>
      <div className="toast-progress-bar"></div>
    </div>
  );
}