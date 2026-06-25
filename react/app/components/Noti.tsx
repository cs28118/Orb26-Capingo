import { useState, useEffect } from 'react';
import type { ToastMessage } from './NotiHelper';
import './Noti.css';

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
    <>
      {/* standard box (bottom right) */}
      <div className="toast-container">
        {toasts
              .filter((toast) => toast.type !== 'achievement')
              .map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* achievement box (top center) */}
      <div className="toast-container-achievement">
        {toasts
              .filter((toast) => toast.type === 'achievement')
              .map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </>
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

    {toast.icon && (
        <div className="toast-icon-container">
          <img src={toast.icon} alt="Achievement Badge" className="toast-badge-img" />
        </div>
    )}
    <div className="toast-text-container">
        <div className="toast-header">
          <strong>{toast.title}</strong>
          <button className="toast-close" onClick={onClose}>X</button>
        </div>
        <div className="toast-content">
          <p>{toast.message}</p>
        </div>
        <div className="toast-progress-bar"></div>
      </div>
    </div>
  );
}