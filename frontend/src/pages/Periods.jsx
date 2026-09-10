import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import {
  IconChevronRight,
  IconDownload,
  IconCalendarEvent,
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

  // Defaults to current year (e.g. '2026') on mount
  const [filterMode, setFilterMode] = useState(currentYearStr);

  // Top Specific Filter (Year & Month)
  const [selectedFilterYear, setSelectedFilterYear] = useState('');
  const [selectedFilterMonth, setSelectedFilterMonth] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const userGroup = user.group || user.group_name || '';

    const initPeriods = async () => {
      // 1. Silently auto-ensure today's real half-month period exists
      if (userGroup) {
        try {
          await api.post(
            `/periods/ensure-current?group_name=${encodeURIComponent(
              userGroup
            )}&created_by=${user.id}`
          );
        } catch (err) {
          console.error('Failed to ensure current period:', err);
        }
      }

      // 2. Fetch available years and load current year's periods by default
      fetchAvailableYears();
      fetchPeriods(currentYearStr);
    };

    initPeriods();
  }, [user, navigate]);

  const fetchAvailableYears = async () => {
    const userGroup = user?.group || user?.group_name || '';
    if (!userGroup) return;
    try {
      const res = await api.get(
        `/periods/years/?group_name=${encodeURIComponent(userGroup)}`
      );
      setAvailableYears(res.data);
    } catch (err) {
      console.error('Failed to fetch period years:', err);
    }
  };

  const fetchPeriods = async (
    mode = currentYearStr,
    filterYear = selectedFilterYear,
    filterMonth = selectedFilterMonth
  ) => {
    setLoading(true);
    setError('');
    setFilterMode(mode);
    const userGroup = user?.group || user?.group_name || '';
    if (!userGroup) {
      setLoading(false);
      return;
    }
    try {
      let url = `/periods/?group_name=${encodeURIComponent(userGroup)}`;
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

  // Helper: Group periods array into Month Cards (each card represents one month with Half 1 & Half 2)
  const groupPeriodsIntoMonthCards = (periodsList) => {
    const monthMap = {};
    const monthNamesFull = [
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
    const monthNamesAbbrev = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    periodsList.forEach((period) => {
      if (!period.start_date) return;
      const [yStr, mStr, dStr] = period.start_date.split('-');
      const year = parseInt(yStr, 10);
      const monthIndex = parseInt(mStr, 10) - 1;
      const day = parseInt(dStr, 10);

      const monthKey = `${yStr}-${mStr}`;
      if (!monthMap[monthKey]) {
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        monthMap[monthKey] = {
          yearMonthStr: monthKey,
          year,
          monthIndex,
          monthName: `${monthNamesFull[monthIndex]} ${year}`,
          monthAbbrev: monthNamesAbbrev[monthIndex],
          lastDayOfMonth: lastDay,
          half1: null,
          half2: null,
        };
      }

      if (day <= 15) {
        monthMap[monthKey].half1 = period;
      } else {
        monthMap[monthKey].half2 = period;
      }
    });

    const sortedKeys = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));
    return sortedKeys.map((key) => monthMap[key]);
  };

  // Render function for a single Half Row inside a Month Card
  const renderHalfRow = (monthData, halfNum) => {
    const period = halfNum === 1 ? monthData.half1 : monthData.half2;
    const isExisting = !!period;

    const startDay = halfNum === 1 ? 1 : 16;
    const endDay = halfNum === 1 ? 15 : monthData.lastDayOfMonth;
    const rangeLabel = `${monthData.monthAbbrev} ${startDay} – ${monthData.monthAbbrev} ${endDay}`;

    if (isExisting) {
      return (
        <div
          onClick={() =>
            navigate(`/categories/${period.id}`, {
              state: { periodTitle: period.title },
            })
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            padding: '10px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease-in-out',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {/* Left side: Badge + Date Range */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: 0,
            }}
          >
            {/* Circular Pill Badge "1" or "2" */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {halfNum}
            </div>

            {/* Date Range Text */}
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#0f172a',
                lineHeight: '1.2',
                whiteSpace: 'nowrap',
              }}
            >
              {rangeLabel}
            </div>
          </div>

          {/* Right side: Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '8px',
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn-secondary"
              style={{
                padding: '4px 7px',
                fontSize: '0.75rem',
                backgroundColor: '#f1f5f9',
              }}
              onClick={(e) => handleDownloadDocx(e, period)}
              title="Download newsletter docx"
              disabled={downloadingId === period.id}
            >
              <IconDownload size={14} style={{ color: '#059669' }} />
            </button>

            <IconChevronRight
              size={18}
              style={{ color: '#94a3b8', cursor: 'pointer' }}
              onClick={() =>
                navigate(`/categories/${period.id}`, {
                  state: { periodTitle: period.title },
                })
              }
            />
          </div>
        </div>
      );
    } else {
      // Non-existing half: check if start date is in the future vs today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const halfStartDay = halfNum === 1 ? 1 : 16;
      const halfStartDate = new Date(
        monthData.year,
        monthData.monthIndex,
        halfStartDay
      );
      halfStartDate.setHours(0, 0, 0, 0);

      const isFuture = halfStartDate > today;

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            padding: '10px 12px',
            borderRadius: '8px',
            opacity: isFuture ? 0.6 : 0.8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {halfNum}
            </div>

            <div style={{ fontSize: '0.88rem', fontWeight: '500', color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {isFuture ? 'Not yet available' : rangeLabel}
            </div>
          </div>
        </div>
      );
    }
  };

  if (!user) return null;

  const monthCardsList = groupPeriodsIntoMonthCards(periods);

  return (
    <div className="periods-page">
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-heading)', margin: 0 }}>
            Newsletter Overview
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Group: <strong>{user.group || user.group_name}</strong> | View your group's newsletter periods
          </p>
        </div>
      </div>

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
                : `Year ${filterMode}`}
            </h3>
            <span className="kanban-count-badge" style={{ marginLeft: '4px' }}>
              {monthCardsList.length}
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
                  fetchPeriods(currentYearStr, '', '');
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
            {monthCardsList.length === 0 ? (
              <p className="empty-state">
                No newsletters found for{' '}
                {filterMode === 'all'
                  ? 'all years'
                  : `year ${filterMode}`}
                .
              </p>
            ) : filterMode === 'all' ? (
              /* All Years Grouped View */
              <div>
                {(() => {
                  const monthsByYear = monthCardsList.reduce((acc, monthCard) => {
                    const yr = String(monthCard.year);
                    if (!acc[yr]) acc[yr] = [];
                    acc[yr].push(monthCard);
                    return acc;
                  }, {});
                  const sortedYearsList = Object.keys(monthsByYear).sort((a, b) => b - a);

                  return sortedYearsList.map((yr, idx) => (
                    <div key={yr} style={{ marginBottom: '28px' }}>
                      {/* Year Divider Line */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          margin: idx === 0 ? '0 0 16px 0' : '24px 0 16px 0',
                        }}
                      >
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

                      {/* Month Cards Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '16px',
                        }}
                      >
                        {monthsByYear[yr].map((monthData) => (
                          <div
                            key={monthData.yearMonthStr}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              padding: '16px 18px',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Card Header with Website Primary Tint Background */}
                            <div
                              style={{
                                backgroundColor: '#eff6ff',
                                borderBottom: '1px solid #dbeafe',
                                margin: '-16px -18px 12px -18px',
                                padding: '9px 16px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <h4
                                style={{
                                  fontSize: '0.92rem',
                                  fontWeight: '700',
                                  color: '#1e40af',
                                  margin: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <IconCalendarEvent size={16} style={{ color: '#1e40af' }} />
                                <span>{monthData.monthName}</span>
                              </h4>
                            </div>

                            {renderHalfRow(monthData, 1)}
                            <div style={{ borderTop: '1px solid #f1f5f9', margin: '6px 0' }} />
                            {renderHalfRow(monthData, 2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              /* Month Cards Grid (Current Year / Filtered View) */
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {monthCardsList.map((monthData) => (
                    <div
                      key={monthData.yearMonthStr}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Card Header with Website Primary Tint Background */}
                      <div
                        style={{
                          backgroundColor: '#eff6ff',
                          borderBottom: '1px solid #dbeafe',
                          margin: '-16px -18px 12px -18px',
                          padding: '9px 16px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <h4
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: '700',
                            color: '#1e40af',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <IconCalendarEvent size={16} style={{ color: '#1e40af' }} />
                          <span>{monthData.monthName}</span>
                        </h4>
                      </div>

                      {renderHalfRow(monthData, 1)}
                      <div style={{ borderTop: '1px solid #f1f5f9', margin: '6px 0' }} />
                      {renderHalfRow(monthData, 2)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Year Action Buttons */}
            {availableYears.length > 0 && (
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

                {availableYears.map((yr) => {
                  const isSelected = filterMode === String(yr);
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => fetchPeriods(String(yr))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        backgroundColor: isSelected
                          ? 'var(--primary-btn)'
                          : '#ffffff',
                        color: isSelected ? '#ffffff' : 'var(--text-heading)',
                        border: isSelected
                          ? '2px solid var(--primary-btn)'
                          : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        boxShadow: isSelected
                          ? '0 4px 10px rgba(30, 64, 175, 0.25)'
                          : '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.18s ease-in-out',
                      }}
                    >
                      <span>{yr}</span>
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
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor:
                      filterMode === 'all' ? 'var(--primary-btn)' : '#ffffff',
                    color: filterMode === 'all' ? '#ffffff' : 'var(--text-heading)',
                    border:
                      filterMode === 'all'
                        ? '2px solid var(--primary-btn)'
                        : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    boxShadow:
                      filterMode === 'all'
                        ? '0 4px 10px rgba(30, 64, 175, 0.25)'
                        : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.18s ease-in-out',
                  }}
                >
                  <span>All Years</span>
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default Periods;
