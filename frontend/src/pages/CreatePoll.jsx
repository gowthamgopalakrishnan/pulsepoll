import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, Check, AlertCircle, Sparkles, Clock, CheckSquare } from 'lucide-react';
import { api } from '../api/client';

export default function CreatePoll({ navigate, addToast }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleAddOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (title.trim().length < 3) {
      setError('Poll question must be at least 3 characters long');
      return;
    }

    const filteredOptions = options.map(o => o.trim()).filter(o => o.length > 0);
    if (filteredOptions.length < 2) {
      setError('Please provide at least 2 non-empty poll options');
      return;
    }

    // Check duplicates
    const set = new Set(filteredOptions.map(o => o.toLowerCase()));
    if (set.size !== filteredOptions.length) {
      setError('All poll options must be unique');
      return;
    }

    setLoading(true);
    try {
      const poll = await api.createPoll({
        title: title.trim(),
        description: description.trim(),
        options: filteredOptions,
        allow_multiple: allowMultiple,
        duration_minutes: Number(durationMinutes),
      });

      addToast('Poll created successfully!', 'success');
      navigate(`/poll/${poll.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create poll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-narrow" style={{ paddingBottom: '3rem' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate('/dashboard')}
        style={{ marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div className="card">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
            Create a Live Poll
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Define your question, configure options, and start receiving live audience votes.
          </p>
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

        <form onSubmit={handleSubmit}>
          {/* Question Title */}
          <div className="form-group">
            <label className="form-label">Poll Question *</label>
            <input
              type="text"
              required
              placeholder="e.g. Which cloud architecture pattern does your team use?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Provide additional context or instructions for your voters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Options */}
          <div className="form-group">
            <label className="form-label">
              Answer Options * ({options.length}/10)
            </label>

            {options.map((option, index) => (
              <div key={index} className="option-row">
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', width: '20px' }}>
                  {index + 1}.
                </span>
                <input
                  type="text"
                  required
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="form-input"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.75rem', borderColor: 'transparent' }}
                    title="Remove Option"
                  >
                    <Trash2 size={16} color="var(--accent-rose)" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 10 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddOption}
                style={{ marginTop: '0.5rem' }}
              >
                <Plus size={16} />
                Add Option
              </button>
            )}
          </div>

          <hr style={{ borderColor: 'var(--border-subtle)', margin: '2rem 0' }} />

          {/* Settings Grid */}
          <div className="grid-2" style={{ marginBottom: '2rem' }}>
            {/* Multiple choice toggle */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckSquare size={16} color="var(--accent-primary)" />
                Voting Mode
              </label>
              <select
                className="form-input"
                value={allowMultiple ? 'multiple' : 'single'}
                onChange={(e) => setAllowMultiple(e.target.value === 'multiple')}
              >
                <option value="single">Single Choice (1 vote per user)</option>
                <option value="multiple">Multiple Choice (select multiple)</option>
              </select>
              <div className="form-hint">Controls how many options each audience member can select.</div>
            </div>

            {/* Expiration Duration */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} color="var(--accent-cyan)" />
                Poll Duration
              </label>
              <select
                className="form-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              >
                <option value={0}>No time limit (Manual close)</option>
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={1440}>24 Hours</option>
              </select>
              <div className="form-hint">Automatically closes the poll after the selected duration.</div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-gradient btn-lg"
            style={{ width: '100%' }}
          >
            {loading ? 'Creating Poll...' : 'Launch Live Poll'}
            <Sparkles size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
