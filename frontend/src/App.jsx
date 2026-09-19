import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ToastContainer from './components/Toast';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreatePoll from './pages/CreatePoll';
import VotePoll from './pages/VotePoll';
import ProjectorView from './pages/ProjectorView';
import { auth } from './api/client';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');
  const [user, setUser] = useState(auth.getUser());
  const [toasts, setToasts] = useState([]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    if (path === currentPath) return;
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = () => {
    auth.logout();
    setUser(null);
    addToast('Signed out successfully', 'info');
    navigate('/');
  };

  // Route Parser
  const renderRoute = () => {
    // 1. Projector View: /poll/:id/results
    const projectorMatch = currentPath.match(/^\/poll\/([a-zA-Z0-9_-]+)\/results\/?$/);
    if (projectorMatch) {
      return <ProjectorView pollId={projectorMatch[1]} navigate={navigate} />;
    }

    // 2. Audience Vote View: /poll/:id
    const pollMatch = currentPath.match(/^\/poll\/([a-zA-Z0-9_-]+)\/?$/);
    if (pollMatch) {
      return <VotePoll pollId={pollMatch[1]} navigate={navigate} addToast={addToast} />;
    }

    // 3. Static Pages
    switch (currentPath) {
      case '/login':
        return <Login navigate={navigate} onLoginSuccess={setUser} addToast={addToast} />;
      case '/register':
        return <Register navigate={navigate} onLoginSuccess={setUser} addToast={addToast} />;
      case '/dashboard':
        if (!user) {
          return <Login navigate={navigate} onLoginSuccess={setUser} addToast={addToast} />;
        }
        return <Dashboard navigate={navigate} user={user} addToast={addToast} />;
      case '/create':
        if (!user) {
          return <Login navigate={navigate} onLoginSuccess={setUser} addToast={addToast} />;
        }
        return <CreatePoll navigate={navigate} addToast={addToast} />;
      case '/':
      default:
        return <Home navigate={navigate} user={user} />;
    }
  };

  const isProjector = currentPath.includes('/results');

  return (
    <div className="app-layout">
      {!isProjector && (
        <Navbar
          currentPath={currentPath}
          navigate={navigate}
          user={user}
          onLogout={handleLogout}
        />
      )}

      <main className={isProjector ? '' : 'main-content'}>
        {renderRoute()}
      </main>

      {!isProjector && <Footer />}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
