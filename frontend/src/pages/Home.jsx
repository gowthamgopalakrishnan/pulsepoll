import React, { useState } from 'react';
import { Radio, ArrowRight, Zap, Shield, Sparkles, CheckCircle2, QrCode, BarChart3, Users } from 'lucide-react';
import LiveResultsChart from '../components/LiveResultsChart';

export default function Home({ navigate, user }) {
  const [pollCode, setPollCode] = useState('');

  // Interactive local demo for the landing hero
  const [demoVotes, setDemoVotes] = useState({ opt1: 142, opt2: 98, opt3: 45 });
  const [selectedDemo, setSelectedDemo] = useState(null);

  const demoTotal = demoVotes.opt1 + demoVotes.opt2 + demoVotes.opt3;

  const handleDemoVote = (optKey) => {
    if (selectedDemo) return;
    setSelectedDemo(optKey);
    setDemoVotes(prev => ({
      ...prev,
      [optKey]: prev[optKey] + 1
    }));
  };

  const handleJoinPoll = (e) => {
    e.preventDefault();
    if (!pollCode.trim()) return;
    let code = pollCode.trim();
    if (code.includes('/poll/')) {
      code = code.split('/poll/')[1].split('/')[0];
    }
    navigate(`/poll/${code}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '3.5rem 0 2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid var(--border-accent)', color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          <Sparkles size={16} />
          <span>Real-time polling powered by Go & Redis</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', maxWidth: '850px', margin: '0 auto 1.5rem' }}>
          Engage Your Audience with <span className="brand-gradient">Instant Live Polls</span>
        </h1>

        <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto 2.5rem' }}>
          Create interactive polls in seconds. Share the link or QR code. Watch live results update across all screens instantly as votes come in.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', marginBottom: '3rem' }}>
          {user ? (
            <button className="btn btn-gradient btn-lg" onClick={() => navigate('/create')}>
              Create a Live Poll
              <ArrowRight size={18} />
            </button>
          ) : (
            <button className="btn btn-gradient btn-lg" onClick={() => navigate('/register')}>
              Get Started for Free
              <ArrowRight size={18} />
            </button>
          )}

          {/* Join Poll Input */}
          <form onSubmit={handleJoinPoll} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Paste Poll ID or Link..."
              value={pollCode}
              onChange={(e) => setPollCode(e.target.value)}
              className="form-input"
              style={{ width: '220px', borderRadius: 'var(--radius-md)' }}
            />
            <button type="submit" className="btn btn-secondary btn-lg" style={{ padding: '0.85rem 1.25rem' }}>
              Join
            </button>
          </form>
        </div>
      </section>

      {/* Interactive Live Demo Preview */}
      <section style={{ maxWidth: '780px', margin: '0 auto 4.5rem' }}>
        <div className="card card-glow" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div className="badge-live">
              <span className="pulse-dot" />
              Live Interactive Preview
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {demoTotal} total responses
            </div>
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            What is your favorite stack for real-time applications?
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {selectedDemo ? "Vote recorded! Watch the bar adjust dynamically below:" : "Click any option below to cast an interactive test vote:"}
          </p>

          {/* Clickable options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => handleDemoVote('opt1')}
              disabled={!!selectedDemo}
              className={`btn ${selectedDemo === 'opt1' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', padding: '0.85rem 1rem' }}
            >
              Go (Gin) + Redis + React
            </button>
            <button
              onClick={() => handleDemoVote('opt2')}
              disabled={!!selectedDemo}
              className={`btn ${selectedDemo === 'opt2' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', padding: '0.85rem 1rem' }}
            >
              Node.js + WebSockets
            </button>
            <button
              onClick={() => handleDemoVote('opt3')}
              disabled={!!selectedDemo}
              className={`btn ${selectedDemo === 'opt3' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', padding: '0.85rem 1rem' }}
            >
              Python FastApi + Celery
            </button>
          </div>

          {/* Results Bar */}
          <LiveResultsChart
            totalVotes={demoTotal}
            options={[
              { id: 'opt1', text: 'Go (Gin) + Redis + React', vote_count: demoVotes.opt1 },
              { id: 'opt2', text: 'Node.js + WebSockets', vote_count: demoVotes.opt2 },
              { id: 'opt3', text: 'Python FastApi + Celery', vote_count: demoVotes.opt3 },
            ]}
          />
        </div>
      </section>

      {/* Feature Pillars */}
      <section style={{ marginBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Engineered for Real-Time Performance
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Every layer is purpose-built to deliver sub-second latency and rock-solid reliability.
          </p>
        </div>

        <div className="grid-3">
          <div className="card">
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Zap size={22} />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Sub-Millisecond Redis
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Votes are counted atomically using Redis <code>HINCRBY</code> and duplicate voters are blocked in O(1) time with Redis Sets.
            </p>
          </div>

          <div className="card">
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Radio size={22} />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Zero-Refresh Streaming
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              WebSockets coupled with Redis Pub/Sub channels broadcast updates immediately to every audience screen without page reloads.
            </p>
          </div>

          <div className="card">
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <QrCode size={22} />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Mobile QR & Projector Mode
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Instant QR code generation makes mobile voting effortless, while full-screen Projector View is ready for big stages.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
