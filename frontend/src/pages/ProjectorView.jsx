import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Radio, Users, Maximize2, Minimize2, ArrowLeft, RefreshCw, QrCode } from 'lucide-react';
import { api } from '../api/client';
import { PollWebSocket } from '../api/websocket';
import LiveResultsChart from '../components/LiveResultsChart';

export default function ProjectorView({ pollId, navigate }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting');

  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  const audienceUrl = `${window.location.origin}/poll/${pollId}`;

  // Generate QR code
  useEffect(() => {
    if (canvasRef.current && audienceUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        audienceUrl,
        {
          width: 170,
          margin: 1,
          color: {
            dark: '#0a0d14',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error("QR Code rendering error:", err);
        }
      );
    }
  }, [audienceUrl, poll]);

  // Load Poll & establish WebSocket stream
  useEffect(() => {
    let isMounted = true;

    async function loadPoll() {
      try {
        const data = await api.getPoll(pollId);
        if (isMounted) setPoll(data);
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load poll');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPoll();

    wsRef.current = new PollWebSocket(
      pollId,
      (updatedPayload) => {
        if (isMounted) {
          setPoll((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              total_votes: updatedPayload.total_votes,
              options: updatedPayload.options,
              is_active: updatedPayload.is_active,
            };
          });
        }
      },
      (status) => {
        if (isMounted) setWsStatus(status);
      }
    );

    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, [pollId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#06080e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading projector view...
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div style={{ minHeight: '100vh', background: '#06080e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', flexDirection: 'column', gap: '1rem' }}>
        <h2>{error || 'Poll not found'}</h2>
        <button className="btn btn-secondary" onClick={() => navigate(`/poll/${pollId}`)}>
          Go to Poll
        </button>
      </div>
    );
  }

  return (
    <div className="projector-container">
      {/* Top Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/poll/${pollId}`)}
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <ArrowLeft size={16} /> Exit Projector
            </button>

            {poll.is_active ? (
              <div className="badge-live">
                <span className="pulse-dot" />
                Live Poll
              </div>
            ) : (
              <div className="badge-status-closed">Poll Closed</div>
            )}

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: wsStatus === 'connected' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                }}
              />
              {wsStatus === 'connected' ? 'Live Stream Active' : 'Connecting stream...'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              borderRadius: '999px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '1.1rem'
            }}>
              <Users size={18} color="var(--accent-primary)" />
              <span>{poll.total_votes || 0}</span>
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>votes</span>
            </div>

            <button
              className="btn btn-secondary"
              onClick={toggleFullscreen}
              style={{ background: 'rgba(255,255,255,0.06)' }}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        <div className="projector-header">
          <div style={{ flex: 1 }}>
            <h1 className="projector-title">{poll.title}</h1>
            {poll.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', marginTop: '0.75rem', maxWidth: '800px' }}>
                {poll.description}
              </p>
            )}
          </div>

          {/* Embedded QR Code for mobile voters */}
          <div className="projector-qr-card">
            <canvas ref={canvasRef} style={{ borderRadius: '6px' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.4rem' }}>
              Scan to Vote
            </span>
          </div>
        </div>
      </div>

      {/* Main Results Display */}
      <div style={{ margin: '1rem 0 3rem' }}>
        <LiveResultsChart
          options={poll.options}
          totalVotes={poll.total_votes}
          isLarge={true}
        />
      </div>

      {/* Bottom status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: '1.5rem',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        <span>Join at: <strong style={{ color: 'var(--text-primary)' }}>{audienceUrl}</strong></span>
        <span>PulsePoll Real-time Engine</span>
      </div>
    </div>
  );
}
