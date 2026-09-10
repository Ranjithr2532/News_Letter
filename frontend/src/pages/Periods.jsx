import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import {
  IconChevronRight,
  IconDownload,
  IconCalendarEvent,
  IconCalendar,
  IconCheck,
  IconLock,
  IconAlertTriangle,
  IconX,
  IconFilter,
  IconRotateClockwise,
  IconFileText,
  IconClock,
  IconSparkles,
  IconLoader2,
  IconUsersGroup,
  IconCircleCheck,
} from '@tabler/icons-react';

const Periods = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const isGhUser = user?.role?.toLowerCase() === 'gh';
  const currentYearStr = String(new Date().getFullYear());

  const [periods, setPeriods] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Finalize popup state (for GH role)
  const [finalizeModalPeriod, setFinalizeModalPeriod] = useState(null);
  const [submittingFinalize, setSubmittingFinalize] = useState(false);

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

  const handleConfirmFinalize = async () => {
    if (!finalizeModalPeriod) return;
    setSubmittingFinalize(true);
    try {
      await api.post(`/periods/${finalizeModalPeriod.id}/finalize`);
      setPeriods((prev) =>
        prev.map((p) =>
          p.id === finalizeModalPeriod.id ? { ...p, edit: false } : p
        )
      );
      setFinalizeModalPeriod(null);
    } catch (err) {
      console.error('Failed to finalize period:', err);
      alert(err.response?.data?.detail || 'Failed to finalize newsletter.');
    } finally {
      setSubmittingFinalize(false);
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

  // Compute live statistics
  const stats = useMemo(() => {
    const total = periods.length;
    const finalized = periods.filter((p) => p.edit === false).length;
    const open = total - finalized;
    return { total, finalized, open };
  }, [periods]);

  // Render function for a single Half Row inside a Month Card
  const renderHalfRow = (monthData, halfNum) => {
    const period = halfNum === 1 ? monthData.half1 : monthData.half2;
    const isExisting = !!period;

    const startDay = halfNum === 1 ? 1 : 16;
    const endDay = halfNum === 1 ? 15 : monthData.lastDayOfMonth;
    const rangeLabel = `${monthData.monthAbbrev} ${startDay} – ${monthData.monthAbbrev} ${endDay}`;
    const subLabel = halfNum === 1 ? '1st Half Period' : '2nd Half Period';

    if (isExisting) {
      const isFinalized = period.edit === false;
      const isDownloading = downloadingId === period.id;

      return (
        <div
          className="half-row clickable"
          onClick={() =>
            navigate(`/categories/${period.id}`, {
              state: { periodTitle: period.title },
            })
          }
          title={`Click to view entries for ${period.title}`}
        >
          {/* Left side: Badge + Date Range */}
          <div className="half-left-meta">
            <div className="half-pill-badge">
              {halfNum === 1 ? 'H1' : 'H2'}
            </div>

            <div className="half-details">
              <span className="half-date-label">{rangeLabel}</span>
              <span className="half-sub-label">{subLabel}</span>
            </div>
          </div>

          {/* Right side: Action Buttons */}
          <div
            className="half-actions-group"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Status Badge */}
            {isFinalized ? (
              <span className="status-badge-finalized" title="Finalized (View-only for all users)">
                <IconLock size={12} />
                <span>Finalized</span>
              </span>
            ) : (
              <span className="status-badge-open" title="Open for editing & submissions">
                <IconCircleCheck size={12} />
                <span>Open</span>
              </span>
            )}

            {/* GH Finalize Action Button */}
            {isGhUser && !isFinalized && (
              <button
                type="button"
                className="action-icon-btn finalize"
                onClick={(e) => {
                  e.stopPropagation();
                  setFinalizeModalPeriod(period);
                }}
                title="Finalize newsletter (Group Head only)"
                aria-label="Finalize newsletter"
              >
                <IconCheck size={16} strokeWidth={2.5} />
              </button>
            )}

            {/* Download DOCX Button */}
            <button
              type="button"
              className="action-icon-btn download"
              onClick={(e) => handleDownloadDocx(e, period)}
              title="Download newsletter (.docx)"
              disabled={isDownloading}
              aria-label="Download newsletter docx"
            >
              {isDownloading ? (
                <IconLoader2 size={15} className="animate-spin text-blue-600" />
              ) : (
                <IconDownload size={15} />
              )}
            </button>

            {/* View Chevron Link */}
            <div
              className="chevron-arrow"
              onClick={() =>
                navigate(`/categories/${period.id}`, {
                  state: { periodTitle: period.title },
                })
              }
              title="View Categories"
              role="button"
              tabIndex={0}
            >
              <IconChevronRight size={18} />
            </div>
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
        <div className="half-row disabled">
          <div className="half-left-meta">
            <div className="half-pill-badge inactive">
              {halfNum === 1 ? 'H1' : 'H2'}
            </div>

            <div className="half-details">
              <span className="half-date-label" style={{ color: '#94a3b8' }}>
                {rangeLabel}
              </span>
              <span className="half-sub-label">
                {isFuture ? 'Upcoming schedule' : 'Unscheduled'}
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.74rem',
              color: '#94a3b8',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <IconClock size={13} />
            {isFuture ? 'Upcoming' : 'Pending'}
          </span>
        </div>
      );
    }
  };

  if (!user) return null;

  const monthCardsList = groupPeriodsIntoMonthCards(periods);

  return (
    <div className="periods-page">
      {/* 1. Hero Overview Header */}
      <div className="periods-hero">
        <div className="periods-hero-title-group">
          <h2>
            <IconCalendarEvent size={26} style={{ color: '#2563eb' }} />
            <span>Newsletter Overview</span>
          </h2>
          <p>
            <span>Department:</span>
            <span className="group-badge-hero">
              <IconUsersGroup size={13} />
              {user.group || user.group_name || 'General'}
            </span>
            <span>• News-letter  publication schedules and archival records</span>
          </p>
        </div>

        {/* Live Overview Stats */}
        <div className="periods-stats-strip">
          <div className="stat-pill">
            <div className="stat-pill-icon blue">
              <IconFileText size={18} />
            </div>
            <div className="stat-pill-info">
              <span className="stat-pill-count">{stats.total}</span>
              <span className="stat-pill-label">Total Periods</span>
            </div>
          </div>

          <div className="stat-pill">
            <div className="stat-pill-icon emerald">
              <IconCheck size={18} strokeWidth={2.5} />
            </div>
            <div className="stat-pill-info">
              <span className="stat-pill-count">{stats.finalized}</span>
              <span className="stat-pill-label">Finalized</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Control & Filter Panel */}
      <div className="periods-control-panel">
        {/* Quick Year Pill Selectors */}
        <div className="periods-quick-years">
          <span className="quick-year-label">Select Year:</span>

          {availableYears.map((yr) => {
            const isSelected =
              filterMode === String(yr) &&
              !selectedFilterYear &&
              !selectedFilterMonth;
            return (
              <button
                key={yr}
                type="button"
                className={`year-tab-btn ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedFilterYear('');
                  setSelectedFilterMonth('');
                  fetchPeriods(String(yr), '', '');
                }}
              >
                <span>{yr}</span>
              </button>
            );
          })}

          <button
            type="button"
            className={`year-tab-btn ${filterMode === 'all' && !selectedFilterYear && !selectedFilterMonth
                ? 'active'
                : ''
              }`}
            onClick={() => {
              setSelectedFilterYear('');
              setSelectedFilterMonth('');
              fetchPeriods('all', '', '');
            }}
          >
            <span>All Years</span>
          </button>
        </div>

        {/* Specific Month/Year Filter Dropdowns */}
        <div className="periods-custom-filters">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconFilter size={15} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>
              Filter:
            </span>
          </div>

          <select
            className="custom-select-input"
            value={selectedFilterYear}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedFilterYear(val);
              fetchPeriods('custom', val, selectedFilterMonth);
            }}
          >
            <option value="">All Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <select
            className="custom-select-input"
            value={selectedFilterMonth}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedFilterMonth(val);
              fetchPeriods('custom', selectedFilterYear, val);
            }}
          >
            <option value="">All Months</option>
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
              className="filter-reset-btn"
              onClick={() => {
                setSelectedFilterYear('');
                setSelectedFilterMonth('');
                fetchPeriods(currentYearStr, '', '');
              }}
              title="Reset Filters"
            >
              <IconRotateClockwise size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Content: Month Cards Grid */}
      {loading ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <IconLoader2 size={32} className="animate-spin text-blue-600" />
          <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>
            Loading newsletter periods...
          </p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : monthCardsList.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconCalendar size={36} style={{ color: '#94a3b8' }} />
          <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>
            No newsletter periods found
          </h4>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
            There are no records matching your current filter selection.
          </p>
        </div>
      ) : filterMode === 'all' && !selectedFilterYear && !selectedFilterMonth ? (
        /* All Years Grouped View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {(() => {
            const monthsByYear = monthCardsList.reduce((acc, monthCard) => {
              const yr = String(monthCard.year);
              if (!acc[yr]) acc[yr] = [];
              acc[yr].push(monthCard);
              return acc;
            }, {});
            const sortedYearsList = Object.keys(monthsByYear).sort((a, b) => b - a);

            return sortedYearsList.map((yr) => (
              <div key={yr}>
                {/* Year Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: '800',
                      color: '#1d4ed8',
                      backgroundColor: '#eff6ff',
                      padding: '4px 14px',
                      borderRadius: '8px',
                      border: '1px solid #bfdbfe',
                      boxShadow: '0 1px 3px rgba(37, 99, 235, 0.1)',
                    }}
                  >
                    Year {yr}
                  </span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                </div>

                {/* Grid for Year */}
                <div className="month-cards-grid">
                  {monthsByYear[yr].map((monthData) => (
                    <div key={monthData.yearMonthStr} className="month-card">
                      <div className="month-card-header">
                        <h4 className="month-card-title">
                          <IconCalendarEvent size={18} className="month-card-icon" />
                          <span>{monthData.monthName}</span>
                        </h4>
                      </div>

                      <div className="month-card-body">
                        {renderHalfRow(monthData, 1)}
                        <div className="row-separator" />
                        {renderHalfRow(monthData, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      ) : (
        /* Standard Month Cards Grid (Current Year / Filtered View) */
        <div className="month-cards-grid">
          {monthCardsList.map((monthData) => (
            <div key={monthData.yearMonthStr} className="month-card">
              <div className="month-card-header">
                <h4 className="month-card-title">
                  <IconCalendarEvent size={18} className="month-card-icon" />
                  <span>{monthData.monthName}</span>
                </h4>
              </div>

              <div className="month-card-body">
                {renderHalfRow(monthData, 1)}
                <div className="row-separator" />
                {renderHalfRow(monthData, 2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Finalize Confirmation Modal (Group Head Role) */}
      {finalizeModalPeriod && (
        <div
          className="modal-backdrop"
          onClick={() => !submittingFinalize && setFinalizeModalPeriod(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              boxShadow:
                '0 24px 38px -6px rgba(0, 0, 0, 0.18), 0 10px 14px -6px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              animation: 'profilePopIn 0.18s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconCheck size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      color: '#0f172a',
                      fontWeight: '700',
                    }}
                  >
                    Finalize Newsletter
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Group Head Approval
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !submittingFinalize && setFinalizeModalPeriod(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                }}
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px' }}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  Period Target
                </span>
                <h4 style={{ margin: '4px 0 0 0', color: '#0f172a', fontSize: '0.94rem' }}>
                  {finalizeModalPeriod.title}
                </h4>
              </div>

              <p
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '0.88rem',
                  color: '#334155',
                  lineHeight: '1.45',
                }}
              >
                Are you sure you want to finalize this newsletter edition?
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  lineHeight: '1.4',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  color: '#92400e',
                }}
              >
                ⚠️ Once finalized, entries will be permanently locked in <strong>View-Only</strong> mode for all users.
              </p>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setFinalizeModalPeriod(null)}
                disabled={submittingFinalize}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmFinalize}
                disabled={submittingFinalize}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  border: 'none',
                  color: '#ffffff',
                  cursor: submittingFinalize ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                  opacity: submittingFinalize ? 0.75 : 1,
                }}
              >
                {submittingFinalize ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Finalizing...</span>
                  </>
                ) : (
                  <>
                    <IconCheck size={16} strokeWidth={2.5} />
                    <span>Confirm Finalize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Periods;
