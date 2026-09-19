import React from 'react';
import { BarChart3, PlusCircle, LayoutDashboard, LogOut, User, Radio } from 'lucide-react';
import { auth } from '../api/client';

export default function Navbar({ currentPath, navigate, user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand-logo" onClick={() => navigate('/')}>
          <div className="logo-icon">
            <Radio size={20} />
          </div>
          <div>
            <span>Pulse</span>
            <span className="brand-gradient">Poll</span>
          </div>
        </div>

        {/* Links */}
        <div className="nav-links">
          <button
            className={`btn ${currentPath === '/' ? 'btn-secondary' : 'btn-secondary'}`}
            style={{ border: 'none', background: currentPath === '/' ? 'rgba(255,255,255,0.08)' : 'transparent' }}
            onClick={() => navigate('/')}
          >
            Home
          </button>

          {user ? (
            <>
              <button
                className={`btn btn-secondary ${currentPath === '/dashboard' ? 'active' : ''}`}
                onClick={() => navigate('/dashboard')}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/create')}
              >
                <PlusCircle size={16} />
                Create Poll
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <User size={14} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</span>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  title="Sign Out"
                  onClick={onLogout}
                >
                  <LogOut size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
              <button
                className="btn btn-gradient btn-sm"
                onClick={() => navigate('/register')}
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
