import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type === 'error' ? 'toast-error' : toast.type === 'success' ? 'toast-success' : ''}`}
        >
          {toast.type === 'success' && <CheckCircle2 size={18} color="var(--accent-emerald)" />}
          {toast.type === 'error' && <AlertCircle size={18} color="var(--accent-rose)" />}
          {toast.type === 'info' && <Info size={18} color="var(--accent-primary)" />}

          <span style={{ flex: 1 }}>{toast.message}</span>

          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
