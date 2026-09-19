import React from 'react';
import { Cpu, Database, Zap, Layers } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-subtle)',
      background: 'rgba(10, 13, 20, 0.9)',
      padding: '2.5rem 1.5rem',
      marginTop: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
            PulsePoll <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>| Live Polling System</span>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Full-stack real-time voting tool built for GUVI / HCL Developer Task.
          </p>
        </div>

        {/* Tech Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            fontSize: '0.8rem',
            color: '#a5b4fc'
          }}>
            <Layers size={14} />
            <span>React Frontend</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            fontSize: '0.8rem',
            color: '#67e8f9'
          }}>
            <Cpu size={14} />
            <span>Go (Gin) Engine</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            fontSize: '0.8rem',
            color: '#fca5a5'
          }}>
            <Zap size={14} />
            <span>Redis Realtime & Counters</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: '0.8rem',
            color: '#6ee7b7'
          }}>
            <Database size={14} />
            <span>MongoDB Database</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
