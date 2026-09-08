import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';

const Periods = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchPeriods();
  }, [user, navigate]);

  const fetchPeriods = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/periods/?group_name=${encodeURIComponent(user.group_name)}`);
      setPeriods(res.data);
    } catch (err) {
      console.error('Failed to fetch periods:', err);
      setError('Failed to load newsletter periods.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!title || !startDate || !endDate) {
      setFormError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/periods/', {
        title,
        start_date: startDate,
        end_date: endDate,
        created_by: user.id,
        group_name: user.group_name,
      });
      setTitle('');
      setStartDate('');
      setEndDate('');
      fetchPeriods();
    } catch (err) {
      console.error('Failed to create period:', err);
      setFormError('Failed to create period. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="page-container">
      <header className="header-bar">
        <div>
          <h2>Newsletter Periods</h2>
          <span className="user-badge">
            {user.name} ({user.role}) | Group: <strong>{user.group_name}</strong>
          </span>
        </div>
        <button onClick={handleLogout} className="btn-secondary">
          Logout
        </button>
      </header>

      <main className="content">
        {/* Create Period Form */}
        <section className="card-section">
          <h3>Create New Period</h3>
          {formError && <div className="error-message">{formError}</div>}
          <form onSubmit={handleCreatePeriod} className="horizontal-form">
            <div className="form-field">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. SMC Aug 1-15"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div className="form-field form-field-btn">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </section>

        {/* Existing Periods List */}
        <section className="card-section">
          <h3>Select a Period</h3>
          {loading ? (
            <p className="loading-text">Loading periods...</p>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : periods.length === 0 ? (
            <p className="empty-state">No periods yet — create one above</p>
          ) : (
            <div className="grid-list">
              {periods.map((period) => (
                <div
                  key={period.id}
                  className="clickable-card"
                  onClick={() =>
                    navigate(`/categories/${period.id}`, {
                      state: { periodTitle: period.title },
                    })
                  }
                >
                  <h4>{period.title}</h4>
                  <p className="date-range">
                    {period.start_date} &rarr; {period.end_date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Periods;
