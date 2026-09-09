import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import Sidebar from '../components/Sidebar';

const Periods = () => {
  const { user } = useUser();
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

  const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };

  const handleStartDateChange = (selectedDateStr) => {
    setStartDate(selectedDateStr);
    setFormError('');
    if (!selectedDateStr) {
      setEndDate('');
      setTitle('');
      return;
    }

    const [yearStr, monthStr, dayStr] = selectedDateStr.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    let calculatedEndDateStr = '';
    let endDay = 15;

    if (day <= 15) {
      endDay = 15;
      const formattedEndMonth = String(monthIndex + 1).padStart(2, '0');
      calculatedEndDateStr = `${year}-${formattedEndMonth}-15`;
    } else {
      const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
      endDay = lastDayOfMonth;
      const formattedEndMonth = String(monthIndex + 1).padStart(2, '0');
      const formattedEndDay = String(lastDayOfMonth).padStart(2, '0');
      calculatedEndDateStr = `${year}-${formattedEndMonth}-${formattedEndDay}`;
    }

    setEndDate(calculatedEndDateStr);

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = monthNames[monthIndex];
    const group = user?.group_name || 'Group';

    const startOrd = `${day}${getOrdinalSuffix(day)}`;
    const endOrd = `${endDay}${getOrdinalSuffix(endDay)}`;

    const autoTitle = `${group} event details from ${monthName} ${startOrd} to ${monthName} ${endOrd} ${year}`;
    setTitle(autoTitle);
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
      const detail = err.response?.data?.detail;
      setFormError(
        typeof detail === 'string'
          ? detail
          : 'Failed to create period. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePeriod = async (e, periodId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this period and all its entries?')) {
      return;
    }
    try {
      await api.delete(`/periods/${periodId}`);
      fetchPeriods();
    } catch (err) {
      console.error('Failed to delete period:', err);
      alert('Failed to delete period.');
    }
  };

  if (!user) return null;

  return (
    <div className="dashboard-container">
      <Sidebar activePage="periods" />

      <main className="dashboard-main">
        <header className="header-bar" style={{ marginBottom: '24px' }}>
          <div>
            <h2>Newsletter Periods</h2>
            <span className="user-badge">
              {user.name} ({user.role?.toUpperCase()}) | Group: <strong>{user.group_name}</strong>
            </span>
          </div>
        </header>

        {/* Create Period Form */}
        <section className="card-section">
          <h3>Create New Period</h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1rem', marginTop: '-0.5rem' }}>
            Please <strong>select the Start Date first</strong>. The End Date and Title will be automatically generated.
          </p>
          {formError && <div className="error-message">{formError}</div>}
          <form onSubmit={handleCreatePeriod} className="horizontal-form">
            <div className="form-field" style={{ minWidth: '190px' }}>
              <label style={{ color: '#1e40af', fontWeight: '700' }}>1. Select Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />
            </div>
            <div className="form-field" style={{ minWidth: '190px' }}>
              <label>2. End Date (Auto-calculated)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div className="form-field" style={{ flex: '2', minWidth: '320px' }}>
              <label>3. Period Title (Auto-filled)</label>
              <input
                type="text"
                placeholder="Select Start Date first to auto-fill title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-field form-field-btn">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Period'}
              </button>
            </div>
          </form>
        </section>

        {/* Existing Periods List */}
        <section className="card-section" style={{ marginTop: '2rem' }}>
          <h3>Existing Periods</h3>
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
                  <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0 }}>{period.title}</h4>
                    <button
                      className="btn-action delete-btn"
                      onClick={(e) => handleDeletePeriod(e, period.id)}
                      title="Delete period"
                      style={{ marginLeft: '10px' }}
                    >
                      Delete
                    </button>
                  </div>
                  <p className="date-range" style={{ marginTop: '8px' }}>
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
