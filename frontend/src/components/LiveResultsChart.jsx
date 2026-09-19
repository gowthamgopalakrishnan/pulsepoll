import React from 'react';
import { Trophy, CheckCircle2 } from 'lucide-react';

export default function LiveResultsChart({ options = [], totalVotes = 0, isLarge = false, userVotedOptionIds = [] }) {
  // Find highest vote count to highlight current winner/leader
  const maxVotes = Math.max(0, ...options.map((o) => o.vote_count || 0));

  return (
    <div className="chart-container" style={{ gap: isLarge ? '1.25rem' : '0.85rem' }}>
      {options.map((option, index) => {
        const count = option.vote_count || 0;
        const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
        const isLeader = maxVotes > 0 && count === maxVotes;
        const userVotedForThis = userVotedOptionIds.includes(option.id);

        return (
          <div
            key={option.id || index}
            className={`chart-item ${isLeader ? 'is-winner' : ''}`}
            style={{
              padding: isLarge ? '1.5rem 1.8rem' : '1.1rem 1.25rem',
              borderRadius: isLarge ? 'var(--radius-lg)' : 'var(--radius-md)',
            }}
          >
            {/* Animated Background Progress Fill */}
            <div
              className="chart-bar-fill"
              style={{
                width: `${percentage}%`,
                transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />

            {/* Content Foreground */}
            <div className="chart-content">
              <div
                className="chart-option-title"
                style={{ fontSize: isLarge ? '1.45rem' : '1.05rem', fontWeight: 600 }}
              >
                <span>{option.text}</span>
                {userVotedForThis && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: 'var(--accent-emerald)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={12} /> Your Vote
                  </span>
                )}
                {isLeader && totalVotes > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: 'var(--accent-amber)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    <Trophy size={12} /> Leading
                  </span>
                )}
              </div>

              <div className="chart-metrics">
                <span
                  className="chart-percentage"
                  style={{
                    fontSize: isLarge ? '1.9rem' : '1.35rem',
                    color: isLeader && totalVotes > 0 ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  }}
                >
                  {percentage}%
                </span>
                <span
                  className="chart-count"
                  style={{ fontSize: isLarge ? '1.1rem' : '0.85rem' }}
                >
                  {count} {count === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
