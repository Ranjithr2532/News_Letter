import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import {
  IconPlus,
  IconChevronRight,
  IconTrash,
  IconDownload,
  IconCalendarEvent,
  IconArrowRight,
} from '@tabler/icons-react';

const Periods = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const currentYearStr = String(new Date().getFullYear());

  const [periods, setPeriods] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Selected filter mode: defaults to 'recent' (last 2 months) on mount
  const [filterMode, setFilterMode] = useState('recent');
  const [showMoreYearsDropdown, setShowMoreYearsDropdown] = useState(false);

  // Top Specific Filter (Year & Month)
  const [selectedFilterYear, setSelectedFilterYear] = useState('');
  const [selectedFilterMonth, setSelectedFilterMonth] = useState('');

  // Form toggle & states
  const [showCreateForm, setShowCreateForm] = useState(false);
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
    fetchAvailableYears();
    // Default initial load: last 2 months
    fetchPeriods('recent');
  }, [user, navigate]);

  const fetchAvailableYears = async () => {
    try {
      const res = await api.get(`/periods/years/?group_name=${encodeURIComponent(user.group_name)}`);
      setAvailableYears(res.data);
    } catch (err) {
      console.error('Failed to fetch period years:', err);
    }
  };

  const fetchPeriods = async (
    mode = 'recent',
    filterYear = selectedFilterYear,
    filterMonth = selectedFilterMonth
  ) => {
    setLoading(true);
    setError('');
    setFilterMode(mode);
    try {
      let url = `/periods/?group_name=${encodeURIComponent(user.group_name)}`;
      if (filterYear || filterMonth) {
        if (filterYear) url += `&year=${filterYear}`;
        if (filterMonth) url += `&month=${filterMonth}`;
      } else if (mode === 'recent') {
        url += '&months=2';
      } else if (mode !== 'all' && mode) {
        url += `&year=${mode}`;
      }
      const res = await api.get(url);
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
      setFormError('Please select a Start Date.');
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
      setShowCreateForm(false);
      fetchAvailableYears();
      fetchPeriods(filterMode);
    } catch (err) {
      console.error('Failed to create period:', err);
      const detail = err.response?.data?.detail;
      setFormError(
        typeof detail === 'string'
          ? detail
          : 'Failed to create newsletter period. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePeriod = async (e, periodId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this newsletter period and all its entries?')) {
      return;
    }
    try {
      await api.delete(`/periods/${periodId}`);
      fetchAvailableYears();
      fetchPeriods(filterMode);
    } catch (err) {
      console.error('Failed to delete period:', err);
      alert('Failed to delete newsletter period.');
    }
  };

  const handleDownloadDocx = async (e, period) => {
    e.stopPropagation();
    setDownloadingId(period.id);
    try {
      const response = await api.get(`/periods/${period.id}/generate-docx`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${period.title.replace(/\s+/g, '_')}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download docx:', err);
      alert('Failed to download newsletter.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Derive Kanban Year Cards: Current Year + 2 Past Years
  const currentYrNum = parseInt(currentYearStr, 10);
  const pastYear1Str = String(currentYrNum - 1);
  const pastYear2Str = String(currentYrNum - 2);

  const standardYearCards = [
    { id: currentYearStr, yearLabel: currentYearStr },
    { id: pastYear1Str, yearLabel: pastYear1Str },
    { id: pastYear2Str, yearLabel: pastYear2Str },
  ];

  // Older years strictly before pastYear2
  const olderYears = availableYears
    .map(String)
    .filter((yr) => ![currentYearStr, pastYear1Str, pastYear2Str].includes(yr))
    .sort((a, b) => b - a);

  const formatDuration = (start, end) => {
    if (!start || !end) return '';
    const [sY, sM, sD] = start.split('-');
    const [eY, eM, eD] = end.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sMName = monthNames[parseInt(sM, 10) - 1] || sM;
    const eMName = monthNames[parseInt(eM, 10) - 1] || eM;
    const sDayNum = parseInt(sD, 10);
    const eDayNum = parseInt(eD, 10);

    if (sY === eY && sM === eM) {
      return `${sDayNum} — ${eDayNum} ${sMName} ${sY}`;
    } else if (sY === eY) {
      return `${sDayNum} ${sMName} — ${eDayNum} ${eMName} ${sY}`;
    }
    return `${sDayNum} ${sMName} ${sY} — ${eDayNum} ${eMName} ${eY}`;
  };

  if (!user) return null;

  return (
    <div className="periods-page">
      {/* Header bar with Create Newsletter Trigger Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-heading)', margin: 0 }}>Newsletter Overview</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Group: <strong>{user.group_name}</strong> | Select or create a newsletter period
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary"
        >
          <IconPlus size={18} />
          <span>{showCreateForm ? 'Close Form' : 'Create newsletter'}</span>
        </button>
      </div>

      {/* Collapsible Create Newsletter Form Card */}
      {showCreateForm && (
        <section className="card-section">
          <h3>Create New Newsletter</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', marginTop: '-0.5rem' }}>
            Select the <strong>Start Date</strong>. The title and end date are automatically calculated.
          </p>
          {formError && <div className="error-message">{formError}</div>}
          <form onSubmit={handleCreatePeriod} className="horizontal-form">
            <div className="form-field" style={{ minWidth: '220px' }}>
              <label style={{ color: 'var(--primary-btn)', fontWeight: '700' }}>1. Select Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />
            </div>
            <div className="form-field" style={{ flex: '2', minWidth: '320px' }}>
              <label>2. Period Title (Auto-generated)</label>
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
                {submitting ? 'Creating...' : 'Create Newsletter'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Existing Newsletters Section */}
      <section className="card-section">
        <div
          style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconCalendarEvent size={20} style={{ color: 'var(--primary-btn)' }} />
            <h3 style={{ margin: 0, border: 'none', padding: 0 }}>
              {selectedFilterYear || selectedFilterMonth
                ? `Filtered Newsletters`
                : filterMode === 'all'
                ? 'All Years'
                : filterMode === 'recent'
                ? 'Recent'
                : `Year ${filterMode}`}
            </h3>
            <span className="kanban-count-badge" style={{ marginLeft: '4px' }}>
              {periods.length}
            </span>
          </div>

          {/* Top Specific Filter Bar (Year & Month) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '700' }}>
              Filter:
            </span>

            <select
              value={selectedFilterYear}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFilterYear(val);
                fetchPeriods('custom', val, selectedFilterMonth);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: 'var(--text-heading)',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="">Select Year</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <select
              value={selectedFilterMonth}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFilterMonth(val);
                fetchPeriods('custom', selectedFilterYear, val);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: 'var(--text-heading)',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="">Select Month</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>

            {(selectedFilterYear || selectedFilterMonth) && (
              <button
                type="button"
                className="btn-ghost-danger"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => {
                  setSelectedFilterYear('');
                  setSelectedFilterMonth('');
                  fetchPeriods('recent', '', '');
                }}
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="loading-text">Loading newsletters...</p>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            {/* 5-Card Grid — 5 equal columns spanning full width */}
            {periods.length === 0 ? (
              <p className="empty-state">
                No newsletters found for {filterMode === 'recent' ? 'the default period' : filterMode === 'all' ? 'all years' : `year ${filterMode}`}. Select a year below to load newsletters.
              </p>
            ) : filterMode === 'all' ? (
              <div>
                {(() => {
                  const periodsByYear = periods.reduce((acc, period) => {
                    const yr = period.start_date ? period.start_date.split('-')[0] : 'Other';
                    if (!acc[yr]) acc[yr] = [];
                    acc[yr].push(period);
                    return acc;
                  }, {});
                  const sortedYearsList = Object.keys(periodsByYear).sort((a, b) => b - a);

                  return sortedYearsList.map((yr, idx) => (
                    <div key={yr} style={{ marginBottom: '24px' }}>
                      {/* Year Divider Line */}
                      <div style={{ display: 'flex', alignItems: 'center', margin: idx === 0 ? '0 0 14px 0' : '24px 0 14px 0' }}>
                        <span
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: '700',
                            color: 'var(--primary-btn)',
                            marginRight: '12px',
                            backgroundColor: '#eff6ff',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          Year {yr}
                        </span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, 1fr)',
                          gap: '14px',
                        }}
                      >
                        {periodsByYear[yr].map((period) => (
                          <div
                            key={period.id}
                            className="clickable-card"
                            onClick={() =>
                              navigate(`/categories/${period.id}`, {
                                state: { periodTitle: period.title },
                              })
                            }
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '14px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              minHeight: '120px',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease-in-out',
                            }}
                          >
                            <div>
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: '0.92rem',
                                  color: 'var(--primary-btn)',
                                  fontWeight: '700',
                                  lineHeight: '1.3',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <IconCalendarEvent size={15} style={{ color: 'var(--primary-btn)', flexShrink: 0 }} />
                                <span>{formatDuration(period.start_date, period.end_date)}</span>
                              </h4>

                              <p
                                style={{
                                  margin: '5px 0 0 0',
                                  fontSize: '0.72rem',
                                  color: '#94a3b8',
                                  fontWeight: '400',
                                  lineHeight: '1.35',
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                {period.title}
                              </p>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: '10px',
                                paddingTop: '8px',
                                borderTop: '1px dashed #e2e8f0',
                              }}
                            >
                              <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '400' }}>
                                {period.start_date} → {period.end_date}
                              </span>

                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 5px', fontSize: '0.7rem' }}
                                  onClick={(e) => handleDownloadDocx(e, period)}
                                  title="Download newsletter docx"
                                  disabled={downloadingId === period.id}
                                >
                                  <IconDownload size={12} />
                                </button>

                                <button
                                  type="button"
                                  className="btn-ghost-danger"
                                  style={{ padding: '3px 5px', border: 'none' }}
                                  onClick={(e) => handleDeletePeriod(e, period.id)}
                                  title="Delete newsletter"
                                >
                                  <IconTrash size={12} />
                                </button>

                                <IconChevronRight size={14} style={{ color: '#94a3b8' }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}

                {/* Show Less anchor link after all years */}
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-start' }}>
                  <a
                    href="#show-less"
                    onClick={(e) => {
                      e.preventDefault();
                      fetchPeriods('recent');
                    }}
                    style={{
                      color: 'var(--primary-btn)',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Show Less ↑
                  </a>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '14px',
                }}
              >
                {(filterMode === 'recent' ? periods.slice(0, 4) : periods).map((period) => (
                  <div
                    key={period.id}
                    className="clickable-card"
                    onClick={() =>
                      navigate(`/categories/${period.id}`, {
                        state: { periodTitle: period.title },
                      })
                    }
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '120px',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease-in-out',
                    }}
                  >
                    <div>
                      {/* Primary Duration — easy identification */}
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '0.92rem',
                          color: 'var(--primary-btn)',
                          fontWeight: '700',
                          lineHeight: '1.3',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <IconCalendarEvent size={15} style={{ color: 'var(--primary-btn)', flexShrink: 0 }} />
                        <span>{formatDuration(period.start_date, period.end_date)}</span>
                      </h4>

                      {/* Secondary muted title */}
                      <p
                        style={{
                          margin: '5px 0 0 0',
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                          fontWeight: '400',
                          lineHeight: '1.35',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {period.title}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px dashed #e2e8f0',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '400' }}>
                        {period.start_date} → {period.end_date}
                      </span>

                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 5px', fontSize: '0.7rem' }}
                          onClick={(e) => handleDownloadDocx(e, period)}
                          title="Download newsletter docx"
                          disabled={downloadingId === period.id}
                        >
                          <IconDownload size={12} />
                        </button>

                        <button
                          type="button"
                          className="btn-ghost-danger"
                          style={{ padding: '3px 5px', border: 'none' }}
                          onClick={(e) => handleDeletePeriod(e, period.id)}
                          title="Delete newsletter"
                        >
                          <IconTrash size={12} />
                        </button>

                        <IconChevronRight size={14} style={{ color: '#94a3b8' }} />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Clean Arrow button to load full current year — right next to 4th card, no box outline */}
                {filterMode === 'recent' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      paddingLeft: '6px',
                      minHeight: '120px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => fetchPeriods(currentYearStr)}
                      title={`Load all ${currentYearStr} newsletters`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--primary-btn)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary-btn)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(30, 64, 175, 0.25)',
                          transition: 'transform 0.18s ease-in-out',
                        }}
                      >
                        <IconArrowRight size={20} />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>
                        {currentYearStr}
                      </span>
                    </button>
                  </div>
                )}

                {/* Clean Show Less anchor link after last card — no box outline */}
                {filterMode !== 'recent' && filterMode !== 'all' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      paddingLeft: '6px',
                      minHeight: '120px',
                    }}
                  >
                    <a
                      href="#show-less"
                      onClick={(e) => {
                        e.preventDefault();
                        fetchPeriods('recent');
                      }}
                      style={{
                        color: 'var(--primary-btn)',
                        fontWeight: '700',
                        fontSize: '0.88rem',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Show Less ↑
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Tight Side-by-Side Flex Row for Year Action Buttons */}
            <div
              style={{
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px dashed #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  fontWeight: '700',
                  marginRight: '4px',
                }}
              >
                Load Year:
              </span>

              {standardYearCards.map((yrObj) => {
                const isSelected = filterMode === yrObj.id;
                const isCurrentYear = yrObj.id === currentYearStr;
                return (
                  <button
                    key={yrObj.id}
                    type="button"
                    onClick={() => fetchPeriods(yrObj.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: isSelected
                        ? 'var(--primary-btn)'
                        : '#ffffff',
                      color: isSelected ? '#ffffff' : 'var(--text-heading)',
                      border: isSelected ? '2px solid var(--primary-btn)' : '1px solid #cbd5e1',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      boxShadow: isSelected
                        ? '0 4px 10px rgba(30, 64, 175, 0.25)'
                        : '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.18s ease-in-out',
                    }}
                  >
                    <span>{yrObj.yearLabel}</span>
                  </button>
                );
              })}

              {/* All Years Button */}
              <button
                type="button"
                onClick={() => fetchPeriods('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: filterMode === 'all' ? 'var(--primary-btn)' : '#ffffff',
                  color: filterMode === 'all' ? '#ffffff' : 'var(--text-heading)',
                  border: filterMode === 'all' ? '2px solid var(--primary-btn)' : '1px solid #cbd5e1',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  boxShadow: filterMode === 'all'
                    ? '0 4px 10px rgba(30, 64, 175, 0.25)'
                    : '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.18s ease-in-out',
                }}
              >
                <span>All Years</span>
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Periods;

