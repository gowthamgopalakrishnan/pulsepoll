import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Radio, Check, CheckSquare, QrCode, Copy, Tv, AlertCircle, Sparkles, CheckCircle2, Clock, Users } from 'lucide-react';
import { api } from '../api/client';
import { PollWebSocket } from '../api/websocket';
import { getVoterFingerprint } from '../utils/fingerprint';
import LiveResultsChart from '../components/LiveResultsChart';
import QRCodeModal from '../components/QRCodeModal';

export default function VotePoll({ pollId, navigate, addToast }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVotedIds, setUserVotedIds] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [showQrModal, setShowQrModal] = useState(false);

  const wsRef = useRef(null);
  const fingerprint = getVoterFingerprint();

  // Load initial poll data & check previous vote status
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const pollData = await api.getPoll(pollId);
        if (isMounted) setPoll(pollData);

        // Check if this fingerprint has already voted
        const statusData = await api.checkVoteStatus(pollId, fingerprint);
        if (isMounted && statusData.has_voted) {
          setHasVoted(true);
          // Check local storage for cached voted options
          const storedVoted = localStorage.getItem(`pulse_voted_${pollId}`);
          if (storedVoted) {
            try {
              setUserVotedIds(JSON.parse(storedVoted));
            } catch (e) {}
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Poll not found');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    // Setup Real-time WebSocket Stream
    wsRef.current = new PollWebSocket(
      pollId,
      (updatedPayload) => {
        // Callback invoked on incoming Redis Pub/Sub message
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
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pollId]);

  const handleOptionSelect = (optionId) => {
    if (hasVoted || !poll?.is_active) return;

    if (poll.allow_multiple) {
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter((id) => id !== optionId));
      } else {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleVoteSubmit = async () => {
    if (selectedOptions.length === 0) {
      setError('Please select an option to vote');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const resp = await api.castVote(pollId, selectedOptions, fingerprint);

      // Trigger celebratory confetti effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
        });
      } catch (e) {}

      setHasVoted(true);
      setUserVotedIds(selectedOptions);
      localStorage.setItem(`pulse_voted_${pollId}`, JSON.stringify(selectedOptions));

      if (resp.options) {
        setPoll((prev) => ({
          ...prev,
          total_votes: resp.total_votes,
          options: resp.options,
        }));
      }

      addToast('Your vote has been counted!', 'success');
    } catch (err) {
      if (err.status === 409) {
        setHasVoted(true);
        setError('You have already voted on this poll from this device.');
      } else {
        setError(err.message || 'Failed to submit vote. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    addToast('Poll link copied to clipboard!', 'success');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
        Connecting to live poll...
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="container-narrow" style={{ paddingTop: '3rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={40} color="var(--accent-rose)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Poll Unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const audienceUrl = window.location.href;

  return (
    <div className="container-narrow" style={{ paddingBottom: '4rem' }}>
      {/* Top Bar: Realtime Connection Status & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {poll.is_active ? (
            <div className="badge-live">
              <span className="pulse-dot" />
              Live Poll
            </div>
          ) : (
            <div className="badge-status-closed">Poll Ended</div>
          )}

          {/* WebSocket indicator */}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: wsStatus === 'connected' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              }}
            />
            {wsStatus === 'connected' ? 'Realtime Connected' : 'Connecting stream...'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowQrModal(true)} title="Show QR Code">
            <QrCode size={15} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleCopyLink} title="Copy Link">
            <Copy size={15} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/poll/${pollId}/results`)} title="Projector Screen">
            <Tv size={15} color="var(--accent-cyan)" />
          </button>
        </div>
      </div>

      {/* Main Poll Card */}
      <div className="card card-glow" style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: '0.5rem' }}>
            {poll.title}
          </h1>
          {poll.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {poll.description}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Users size={14} />
              <strong style={{ color: 'var(--text-primary)' }}>{poll.total_votes || 0}</strong> votes recorded
            </span>
            <span>•</span>
            <span>{poll.allow_multiple ? 'Multiple choices allowed' : 'Single choice'}</span>
          </div>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: 'var(--accent-rose)',
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Voting Options (Before Vote Cast) */}
        {!hasVoted && poll.is_active ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.75rem' }}>
              {poll.options.map((option) => {
                const isSelected = selectedOptions.includes(option.id);
                return (
                  <div
                    key={option.id}
                    onClick={() => handleOptionSelect(option.id)}
                    className={`vote-option-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className={`selection-indicator ${poll.allow_multiple ? 'checkbox' : ''}`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{option.text}</span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleVoteSubmit}
              disabled={submitting || selectedOptions.length === 0}
              className="btn btn-gradient btn-lg"
              style={{ width: '100%' }}
            >
              {submitting ? 'Recording Vote...' : 'Submit Your Vote'}
              <Sparkles size={18} />
            </button>
          </div>
        ) : (
          /* Live Results View (After Vote Cast or When Closed) */
          <div>
            {hasVoted && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--accent-emerald)',
                fontSize: '0.875rem',
                fontWeight: 600,
                marginBottom: '1.5rem'
              }}>
                <CheckCircle2 size={18} />
                <span>Thank you! Your vote has been recorded. Watch the live results below in real time:</span>
              </div>
            )}

            {!poll.is_active && !hasVoted && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(148, 163, 184, 0.1)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                marginBottom: '1.5rem'
              }}>
                <Clock size={18} />
                <span>Voting has closed for this poll. Final results are shown below:</span>
              </div>
            )}

            <LiveResultsChart
              options={poll.options}
              totalVotes={poll.total_votes}
              userVotedOptionIds={userVotedIds}
            />
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <QRCodeModal
          url={audienceUrl}
          title={poll.title}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
}
