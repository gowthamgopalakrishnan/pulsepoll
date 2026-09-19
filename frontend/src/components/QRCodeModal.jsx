import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode } from 'lucide-react';

export default function QRCodeModal({ url, title, onClose }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }, (error) => {
        if (error) console.error("QR Code generation error:", error);
      });
    }
  }, [url]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1rem'
    }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2rem', textAlign: 'center', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{
          display: 'inline-flex',
          padding: '0.65rem',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.15)',
          color: 'var(--accent-primary)',
          marginBottom: '1rem'
        }}>
          <QrCode size={28} />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.4rem' }}>
          Scan to Vote
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Audience members can point their phone camera at the QR code to vote instantly.
        </p>

        {/* QR Code Container */}
        <div style={{
          background: 'white',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          display: 'inline-block',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          marginBottom: '1.5rem'
        }}>
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>

        {/* Link Copy Field */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            readOnly
            value={url}
            className="form-input"
            style={{ fontSize: '0.85rem' }}
          />
          <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
          </button>
        </div>

        {copied && (
          <div style={{ color: 'var(--accent-emerald)', fontSize: '0.825rem', fontWeight: 600 }}>
            Link copied to clipboard!
          </div>
        )}
      </div>
    </div>
  );
}
