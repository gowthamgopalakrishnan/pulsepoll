import React, { useEffect, useState } from 'react';
import { PlusCircle, Radio, Users, BarChart3, Tv, QrCode, Copy, Trash2, Power, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import QRCodeModal from '../components/QRCodeModal';

export default function Dashboard({ navigate, user, addToast }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrModalUrl, setQrModalUrl] = useState(null);

  const fetchPolls = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUserPolls();
      setPolls(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load polls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const handleToggleStatus = async (pollId, currentStatus) => {
    try {
      await api.updatePollStatus(pollId, !currentStatus);
      setPolls(polls.map(p => p.id === pollId ? { ...p, is_active: !currentStatus } : p));
      addToast(`Poll ${!currentStatus ? 'activated' : 'closed'} successfully`, 'info');
    } catch (err) {
      addToast(err.message || 'Failed to update poll status', 'error');
    }
  };

  const handleDelete = async (pollId) => {
    if (!window.confirm('Are you sure you want to permanently delete this poll?')) return;
    try {
      await api.deletePoll(pollId);
      setPolls(polls.filter(p => p.id !== pollId));
      addToast('Poll deleted successfully', 'info');
    } catch (err) {
      addToast(err.message || 'Failed to delete poll', 'error');
    }
  };

  const handleCopyLink = (pollId) => {
    const url = `${window.location.origin}/poll/${pollId}`;
    navigator.clipboard.writeText(url);
    addToast('Audience voting link copied to clipboard!', 'success');
  };

  const totalVotesAcrossAll = polls.reduce((acc, p) => acc + (p.total_votes || 0), 0);
  const activeCount = polls.filter(p => p.is_active).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Poll Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage your active polls, monitor live responses, and present results.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={fetchPolls} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="btn btn-gradient" onClick={() => navigate('/create')}>
            <PlusCircle size={18} />
            Create New Poll
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Polls</span>
            <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
              <Radio size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{polls.length}</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Active Polls</span>
            <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <Radio size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{activeCount}</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Votes Cast</span>
            <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{totalVotesAcrossAll}</div>
        </div>
      </div>

      {/* Polls List */}
      {error && (
        <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(244,63,94,0.1)', color: 'var(--accent-rose)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          Loading your polls...
        </div>
      ) : polls.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <Radio size={32} />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Polls Yet</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            Create your first live poll and invite your audience to vote in real-time.
          </p>
          <button className="btn btn-gradient" onClick={() => navigate('/create')}>
            <PlusCircle size={18} />
            Create Your First Poll
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {polls.map((poll) => {
            const audienceUrl = `${window.location.origin}/poll/${poll.id}`;
            return (
              <div key={poll.id} className="card card-glow" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      {poll.is_active ? (
                        <div className="badge-live">
                          <span className="pulse-dot" />
                          Live & Accepting Votes
                        </div>
                      ) : (
                        <div className="badge-status-closed">
                          Closed
                        </div>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(poll.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <h3
                      onClick={() => navigate(`/poll/${poll.id}`)}
                      style={{ fontSize: '1.3rem', fontWeight: 700, cursor: 'pointer', marginBottom: '0.35rem' }}
                    >
                      {poll.title}
                    </h3>
                    {poll.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {poll.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      <span>{poll.options?.length || 0} Options</span>
                      <span>•</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{poll.total_votes || 0} Votes</span>
                      <span>•</span>
                      <span>{poll.allow_multiple ? 'Multiple Choice' : 'Single Choice'}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/poll/${poll.id}`)}
                      title="Audience Voting View"
                    >
                      <BarChart3 size={15} />
                      Vote View
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/poll/${poll.id}/results`)}
                      title="Projector / Presentation View"
                    >
                      <Tv size={15} color="var(--accent-cyan)" />
                      Projector
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setQrModalUrl(audienceUrl)}
                      title="Display QR Code"
                    >
                      <QrCode size={15} />
                      QR Code
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyLink(poll.id)}
                      title="Copy Link"
                    >
                      <Copy size={15} />
                    </button>

                    <button
                      className={`btn btn-sm ${poll.is_active ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleToggleStatus(poll.id, poll.is_active)}
                      title={poll.is_active ? 'Close Poll' : 'Re-open Poll'}
                    >
                      <Power size={14} />
                      {poll.is_active ? 'Close' : 'Activate'}
                    </button>

                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDelete(poll.id)}
                      title="Delete Poll"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalUrl && (
        <QRCodeModal
          url={qrModalUrl}
          onClose={() => setQrModalUrl(null)}
        />
      )}
    </div>
  );
}
