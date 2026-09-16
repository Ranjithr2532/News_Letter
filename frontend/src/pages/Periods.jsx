import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import DeadlineModal from '../components/DeadlineModal';
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
  IconBuilding,
  IconShield,
  IconPlus,
  IconFolder,
} from '@tabler/icons-react';

const Periods = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isChUser = user?.role?.toLowerCase() === 'ch';
  const isGhUser = user?.role?.toLowerCase() === 'gh';
  const canCreatePeriod = !isAdmin && !isChUser;
  const currentYearStr = String(new Date().getFullYear());

  const [periods, setPeriods] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Admin & CH Role: Centers and Centre Heads data
  const [allCenters, setAllCenters] = useState([]);
  const [allChs, setAllChs] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState('all');
  const [centerGroups, setCenterGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');

  // Combined Download Modal state
  const defaultCombinedHalf = new Date().getDate() <= 15 ? 'h1' : 'h2';
  const [showCombinedModal, setShowCombinedModal] = useState(false);
  const [combinedScope, setCombinedScope] = useState(defaultCombinedHalf); // 'h1' | 'h2' | 'month' | 'year'
  const [selectedCombinedCenter, setSelectedCombinedCenter] = useState('all');
  const [selectedCombinedGroup, setSelectedCombinedGroup] = useState('all');
  const [selectedCombinedYear, setSelectedCombinedYear] = useState(currentYearStr);
  const [selectedCombinedMonth, setSelectedCombinedMonth] = useState(String(new Date().getMonth() + 1));
  const [downloadingCombined, setDownloadingCombined] = useState(false);

  // Finalize popup state (for GH role)
  const [finalizeModalPeriod, setFinalizeModalPeriod] = useState(null);
  const [submittingFinalize, setSubmittingFinalize] = useState(false);

  // Download options popup state
  const [downloadModalPeriod, setDownloadModalPeriod] = useState(null);
  const [periodContributors, setPeriodContributors] = useState([]);
  const [selectedContributorId, setSelectedContributorId] = useState('');
  const [loadingContributors, setLoadingContributors] = useState(false);

  // Manual Period Creation Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createYear, setCreateYear] = useState(currentYearStr);
  const [createMonth, setCreateMonth] = useState(String(new Date().getMonth() + 1));
  const [createHalf, setCreateHalf] = useState(1);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

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
      // 1. Silently auto-ensure today's real half-month period exists (for GH/Users with a group)
      if (userGroup && !isChUser && !isAdmin) {
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

      // 2. If Admin, fetch all centers and all Centre Heads
      if (isAdmin) {
        try {
          const [cRes, chRes] = await Promise.all([
            api.get('/users/centers/list'),
            api.get('/users/chs/list'),
          ]);
          setAllCenters(cRes.data || []);
          setAllChs(chRes.data || []);
        } catch (adminErr) {
          console.error('Failed to fetch centers/chs for admin:', adminErr);
        }
      }

      // 3. If CH, fetch all active groups under this center
      if (isChUser && user?.center) {
        try {
          const gRes = await api.get(
            `/users/groups/list?center=${encodeURIComponent(user.center)}`
          );
          setCenterGroups(gRes.data || []);
        } catch (gErr) {
          console.error('Failed to fetch center groups:', gErr);
        }
      }

      // 4. Fetch available years and load current year's periods
      const initialCenter = isAdmin ? 'all' : isChUser ? user?.center : undefined;
      fetchAvailableYears('all', initialCenter);
      fetchPeriods(currentYearStr, '', '', 'all', initialCenter);
    };

    initPeriods();
  }, [user, navigate]);

  const chMapByCenter = useMemo(() => {
    const map = {};
    allChs.forEach((ch) => {
      if (ch.center) map[ch.center] = ch;
    });
    return map;
  }, [allChs]);

  const fetchAvailableYears = async (
    grp = selectedGroup,
    targetCenter = (isAdmin ? selectedCenter : isChUser ? user?.center : undefined)
  ) => {
    try {
      let url = '/periods/years/?';
      const params = [];
      if (targetCenter && targetCenter !== 'all') {
        params.push(`center=${encodeURIComponent(targetCenter)}`);
      }
      if (grp && grp !== 'all') {
        params.push(`group_name=${encodeURIComponent(grp)}`);
      } else if (!isAdmin && !isChUser) {
        const userGroup = user?.group || user?.group_name || '';
        if (userGroup) params.push(`group_name=${encodeURIComponent(userGroup)}`);
      }
      url += params.join('&');
      const res = await api.get(url);
      setAvailableYears(res.data || []);
    } catch (err) {
      console.error('Failed to fetch period years:', err);
    }
  };

  const fetchPeriods = async (
    mode = currentYearStr,
    filterYear = selectedFilterYear,
    filterMonth = selectedFilterMonth,
    grp = selectedGroup,
    targetCenter = (isAdmin ? selectedCenter : isChUser ? user?.center : undefined)
  ) => {
    setLoading(true);
    setError('');
    setFilterMode(mode);
    try {
      let url = '/periods/?';
      const params = [];
      if (targetCenter && targetCenter !== 'all') {
        params.push(`center=${encodeURIComponent(targetCenter)}`);
      }
      if (grp && grp !== 'all') {
        params.push(`group_name=${encodeURIComponent(grp)}`);
      } else if (!isAdmin && !isChUser) {
        const userGroup = user?.group || user?.group_name || '';
        if (userGroup) params.push(`group_name=${encodeURIComponent(userGroup)}`);
      }

      if (filterYear || filterMonth) {
        if (filterYear) params.push(`year=${filterYear}`);
        if (filterMonth) params.push(`month=${filterMonth}`);
      } else if (mode === 'recent') {
        params.push('months=2');
      } else if (mode !== 'all' && mode) {
        params.push(`year=${mode}`);
      }
      url += params.join('&');
      const res = await api.get(url);
      setPeriods(res.data || []);
    } catch (err) {
      console.error('Failed to fetch periods:', err);
      setError('Failed to load newsletter periods.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCenter = async (centerName) => {
    setSelectedCenter(centerName);
    setSelectedGroup('all');
    setSelectedCombinedCenter(centerName);
    if (centerName === 'all') {
      setCenterGroups([]);
      fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, 'all', 'all');
      fetchAvailableYears('all', 'all');
    } else {
      try {
        const gRes = await api.get(`/users/groups/list?center=${encodeURIComponent(centerName)}`);
        setCenterGroups(gRes.data || []);
      } catch (e) {
        console.error('Failed to fetch center groups:', e);
      }
      fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, 'all', centerName);
      fetchAvailableYears('all', centerName);
    }
  };

  const handleOpenDownloadModal = async (e, period) => {
    if (e) e.stopPropagation();
    setDownloadModalPeriod(period);
    setSelectedContributorId('');
    setLoadingContributors(true);
    try {
      const res = await api.get(`/periods/${period.id}/contributors`);
      setPeriodContributors(res.data || []);
    } catch (err) {
      console.error('Failed to fetch period contributors:', err);
      setPeriodContributors([]);
    } finally {
      setLoadingContributors(false);
    }
  };

  const executeDownloadDocx = async () => {
    if (!downloadModalPeriod) return;
    const period = downloadModalPeriod;
    setDownloadingId(period.id);
    try {
      let url = `/periods/${period.id}/generate-docx`;
      if (selectedContributorId) {
        url += `?created_by=${selectedContributorId}`;
      }
      const response = await api.get(url, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      let userSuffix = '';
      if (selectedContributorId) {
        const found = periodContributors.find(
          (c) => String(c.id) === String(selectedContributorId)
        );
        if (found) {
          const cName = (found.name || found.email).replace(/\s+/g, '_');
          userSuffix = `_${cName}`;
        }
      }

      const filename = `${period.title.replace(/\s+/g, '_')}${userSuffix}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setDownloadModalPeriod(null);
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

  const allMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper to compute start_date, end_date, and title based on Year, Month, and Half
  const getPeriodComputedDetails = (yearVal, monthVal, halfVal) => {
    const y = parseInt(yearVal, 10) || new Date().getFullYear();
    const m = parseInt(monthVal, 10) || (new Date().getMonth() + 1);
    const h = parseInt(halfVal, 10) || 1;
    const mName = allMonthNames[m - 1] || 'January';
    const mStr = String(m).padStart(2, '0');

    const lastDay = new Date(y, m, 0).getDate();
    const sDay = h === 1 ? '01' : '16';
    const eDay = h === 1 ? '15' : String(lastDay).padStart(2, '0');

    const startDate = `${y}-${mStr}-${sDay}`;
    const endDate = `${y}-${mStr}-${eDay}`;
    const title = `${mName} ${y} - ${h === 1 ? '1st Half' : '2nd Half'}`;
    const dateRangeLabel = `${mName.slice(0, 3)} ${parseInt(sDay, 10)} – ${mName.slice(0, 3)} ${parseInt(eDay, 10)}, ${y}`;

    return { y, m, h, mName, startDate, endDate, title, dateRangeLabel, lastDay };
  };

  // Open Create Period Modal (with optional preset dates from unscheduled half row)
  const handleOpenCreateModal = (presetMonthData, halfNum) => {
    setCreateError('');
    setCreateSuccess('');

    if (presetMonthData && halfNum) {
      setCreateYear(String(presetMonthData.year));
      setCreateMonth(String(presetMonthData.monthIndex + 1));
      setCreateHalf(halfNum);
    } else {
      const today = new Date();
      setCreateYear(String(today.getFullYear()));
      setCreateMonth(String(today.getMonth() + 1));
      setCreateHalf(today.getDate() <= 15 ? 1 : 2);
    }

    setShowCreateModal(true);
  };

  // Submit Manual Period Creation to Backend API
  const handleCreatePeriodSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    const computed = getPeriodComputedDetails(createYear, createMonth, createHalf);
    const groupToUse = user?.group || user?.group_name || 'General';

    setSubmittingCreate(true);
    try {
      const payload = {
        title: computed.title,
        start_date: computed.startDate,
        end_date: computed.endDate,
        group_name: groupToUse,
        created_by: user?.id || 1,
        edit: true,
      };

      await api.post('/periods/', payload);
      setCreateSuccess(`Newsletter period "${computed.title}" created successfully!`);
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateSuccess('');
      }, 1000);

      // Re-fetch periods list
      fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, selectedGroup, selectedCenter);
      fetchAvailableYears(selectedGroup, selectedCenter);
    } catch (err) {
      console.error('Failed to create period:', err);
      const detail = err.response?.data?.detail || 'Failed to create period. Please check details.';
      setCreateError(detail);
    } finally {
      setSubmittingCreate(false);
    }
  };


  const executeDownloadCombinedDocx = async (overrideParams = null) => {
    const targetCenter =
      overrideParams?.center ||
      (isAdmin ? selectedCombinedCenter || selectedCenter : user?.center);
    const targetGroup =
      overrideParams?.group_name ||
      selectedCombinedGroup;

    setDownloadingCombined(true);
    try {
      let url = '/periods/center/generate-combined-docx?';
      if (targetCenter && targetCenter !== 'all') {
        url += `center=${encodeURIComponent(targetCenter)}`;
      } else {
        url += 'center=all';
      }
      if (targetGroup && targetGroup !== 'all') {
        url += `&group_name=${encodeURIComponent(targetGroup)}`;
      }
      let filenameLabel = '';

      if (overrideParams?.start_date && overrideParams?.end_date) {
        url += `&start_date=${overrideParams.start_date}&end_date=${overrideParams.end_date}`;
        filenameLabel = `_${overrideParams.start_date}_to_${overrideParams.end_date}`;
      } else {
        const yr = parseInt(selectedCombinedYear || currentYearStr, 10);
        const mo = parseInt(selectedCombinedMonth || String(new Date().getMonth() + 1), 10);
        const padMo = String(mo).padStart(2, '0');
        const lastDay = new Date(yr, mo, 0).getDate();

        if (combinedScope === 'h1') {
          const sDate = `${yr}-${padMo}-01`;
          const eDate = `${yr}-${padMo}-15`;
          url += `&start_date=${sDate}&end_date=${eDate}`;
          filenameLabel = `_${sDate}_to_${eDate}`;
        } else if (combinedScope === 'h2') {
          const sDate = `${yr}-${padMo}-16`;
          const eDate = `${yr}-${padMo}-${String(lastDay).padStart(2, '0')}`;
          url += `&start_date=${sDate}&end_date=${eDate}`;
          filenameLabel = `_${sDate}_to_${eDate}`;
        } else if (combinedScope === 'month') {
          url += `&year=${yr}&month=${mo}`;
          filenameLabel = `_${yr}_Month_${padMo}`;
        } else if (combinedScope === 'year') {
          url += `&year=${yr}`;
          filenameLabel = `_Year_${yr}`;
        }
      }

      const response = await api.get(url, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const centerClean = (targetCenter && targetCenter !== 'all') ? targetCenter.replace(/\s+/g, '_') : 'CMTI_All_Centers';
      const groupClean = (targetGroup && targetGroup !== 'all') ? `_${targetGroup.replace(/\s+/g, '_')}` : '';
      const filename = `${centerClean}${groupClean}_Newsletter${filenameLabel}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setShowCombinedModal(false);
      setDownloadModalPeriod(null);
    } catch (err) {
      console.error('Failed to download combined docx:', err);
      alert(err.response?.data?.detail || 'Failed to download newsletter document. No entries found for this selection.');
    } finally {
      setDownloadingCombined(false);
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
          className={`half-row ${isAdmin ? '' : 'clickable'}`}
          onClick={() => {
            if (!isAdmin) {
              navigate(`/categories/${period.id}`, {
                state: { periodTitle: period.title },
              });
            }
          }}
          title={isAdmin ? `Period: ${period.title} (Use Download to export combined newsletter)` : `Click to view entries for ${period.title}`}
          style={isAdmin ? { cursor: 'default' } : {}}
        >
          {/* Left side: Badge + Date Range */}
          <div className="half-left-meta">
            <div className="half-pill-badge">
              {halfNum === 1 ? 'H1' : 'H2'}
            </div>

            <div className="half-details">
              <span className="half-date-label">{rangeLabel}</span>
              <span className="half-sub-label">
                {subLabel}
                {period.creator_name ? ` • GH: ${period.creator_name}` : ''}
              </span>
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
              onClick={(e) => handleOpenDownloadModal(e, period)}
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

            {/* View Chevron Link - Only for non-admin users */}
            {!isAdmin && (
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
            )}
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

          {canCreatePeriod ? (
            <button
              type="button"
              onClick={() => handleOpenCreateModal(monthData, halfNum)}
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: '700',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
              title={`Create newsletter period for ${rangeLabel}`}
            >
              <IconPlus size={14} strokeWidth={2.4} />
              <span>Create Period</span>
            </button>
          ) : (
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
          )}
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
            <span>Newsletter</span>
          </h2>
          <p>
            {isAdmin ? (
              <>
                <span className="role-badge role-admin" style={{ padding: '3px 10px', fontSize: '0.78rem' }}>
                  <IconShield size={14} />
                  System Administrator
                </span>
                <span style={{ color: '#2563eb', fontWeight: '700' }}>• Institutional Oversight</span>
                <span>• Viewing all {allCenters.length} centers & all {allChs.length} Centre Heads</span>
              </>
            ) : isChUser ? (
              <>
                <span>Center:</span>
                <span className="group-badge-hero" style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                  <IconBuilding size={14} />
                  {user.center || 'All Centers'}
                </span>
                <span style={{ color: '#d97706', fontWeight: '700' }}>• Centre Head (CH) Access</span>
                <span>• Viewing newsletter periods across all groups</span>
              </>
            ) : (
              <>
                <span>Department:</span>
                <span className="group-badge-hero">
                  <IconUsersGroup size={13} />
                  {user.group || user.group_name || 'General'}
                </span>
                <span>• News-letter publication schedules and archival records</span>
              </>
            )}
          </p>
        </div>

        {/* Live Overview Stats & Combined Download Button */}
        <div className="periods-stats-strip">
          {(isAdmin || isChUser) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCombinedCenter(isAdmin ? selectedCenter : user?.center || 'all');
                setSelectedCombinedGroup(selectedGroup || 'all');
                setShowCombinedModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.86rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
                transition: 'all 0.18s ease',
                height: 'fit-content',
                alignSelf: 'center',
              }}
              title={isAdmin ? "Download Combined Institutional DOCX" : "Download DOCX"}
            >
              <IconDownload size={18} strokeWidth={2.2} />
              <span>{isAdmin ? 'Download Institutional Combined (.docx)' : 'Download'}</span>
            </button>
          )}

          {isAdmin && (
            <div className="stat-pill">
              <div className="stat-pill-icon blue" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <IconBuilding size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{allCenters.length}</span>
                <span className="stat-pill-label">Centers</span>
              </div>
            </div>
          )}

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

      {/* 1.4 Admin Center Selector Toolbar */}
      {isAdmin && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconBuilding size={20} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>
                Select Center (Institutional Filter):
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {allChs.length} Centre Heads active
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleSelectCenter('all')}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: '700',
                border: selectedCenter === 'all' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: selectedCenter === 'all' ? '#eff6ff' : '#ffffff',
                color: selectedCenter === 'all' ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                boxShadow: selectedCenter === 'all' ? '0 1px 4px rgba(37,99,235,0.2)' : 'none',
              }}
            >
              <IconBuilding size={15} style={{ color: selectedCenter === 'all' ? '#2563eb' : '#64748b' }} />
              <span>All Centers ({allCenters.length})</span>
            </button>

            {allCenters.map((cName) => {
              const isSelected = selectedCenter === cName;
              const chUser = chMapByCenter[cName];
              return (
                <button
                  key={cName}
                  type="button"
                  onClick={() => handleSelectCenter(cName)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 4px rgba(37,99,235,0.2)' : 'none',
                  }}
                  title={chUser ? `Center: ${cName} • Centre Head: ${chUser.name}` : `Center: ${cName} (No CH assigned)`}
                >
                  <span>{cName}</span>
                  {chUser && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                        color: isSelected ? '#1e40af' : '#64748b',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: '600',
                      }}
                    >
                      CH: {chUser.name.split(' ')[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Center Info Bar */}
          {selectedCenter !== 'all' && (
            <div
              style={{
                marginTop: '4px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>Active Center:</span>
                <span style={{ color: '#2563eb', fontWeight: '800' }}>{selectedCenter}</span>
                {chMapByCenter[selectedCenter] ? (
                  <span style={{ color: '#475569' }}>
                    • Centre Head: <strong style={{ color: '#b45309' }}>{chMapByCenter[selectedCenter].name}</strong> ({chMapByCenter[selectedCenter].email})
                  </span>
                ) : (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>• No Centre Head assigned</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1.5 Department Filter Toolbar (For CH or when Admin has selected a specific center) */}
      {(isChUser || (isAdmin && selectedCenter !== 'all')) && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconBuilding size={18} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.86rem', fontWeight: '700', color: '#1e293b' }}>
                Department ({isAdmin ? selectedCenter : user?.center}):
              </span>
            </div>

            {/* Clean Department Dropdown */}
            <select
              value={selectedGroup}
              onChange={(e) => {
                const grp = e.target.value;
                setSelectedGroup(grp);
                fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, grp, isAdmin ? selectedCenter : undefined);
                fetchAvailableYears(grp, isAdmin ? selectedCenter : undefined);
              }}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: '600',
                color: '#1e293b',
                cursor: 'pointer',
                minWidth: '220px',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <option value="all">
                All Departments {centerGroups.length > 0 ? `(${centerGroups.length})` : ''}
              </option>
              {centerGroups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Action Row: Create Period Manually (Positioned in the middle between Overview and Filter panels, aligned right) */}
      {canCreatePeriod && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginTop: '-6px',
            marginBottom: '-6px',
          }}
        >
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.28)',
              transition: 'all 0.18s ease',
            }}
            title="Create a new newsletter period manually"
          >
            <IconPlus size={16} strokeWidth={2.5} />
            <span>Create</span>
          </button>
        </div>
      )}

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
                  fetchPeriods(String(yr), '', '', selectedGroup);
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
              fetchPeriods('all', '', '', selectedGroup);
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
              fetchPeriods('custom', val, selectedFilterMonth, selectedGroup);
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
              fetchPeriods('custom', selectedFilterYear, val, selectedGroup);
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
                fetchPeriods(currentYearStr, '', '', selectedGroup);
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
      ) : periods.length === 0 ? (
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
      ) : isAdmin && selectedCenter === 'all' && selectedGroup === 'all' ? (
        /* Admin All Centers Multi-Center & Multi-Department Grouped View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {(() => {
            const periodsByCenter = {};
            periods.forEach((p) => {
              const c = p.center || 'General';
              if (!periodsByCenter[c]) periodsByCenter[c] = [];
              periodsByCenter[c].push(p);
            });

            const centerKeys = Object.keys(periodsByCenter).sort();

            return centerKeys.map((cName) => {
              const centerPeriods = periodsByCenter[cName];
              const chUser = chMapByCenter[cName];

              // Group departments inside this center
              const deptsInCenter = {};
              centerPeriods.forEach((p) => {
                const g = p.group_name || 'General';
                if (!deptsInCenter[g]) deptsInCenter[g] = [];
                deptsInCenter[g].push(p);
              });
              const deptNames = Object.keys(deptsInCenter).sort();

              return (
                <div
                  key={cName}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  {/* Center Header Banner */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderLeft: '5px solid #2563eb',
                      borderRadius: '12px',
                      padding: '14px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconBuilding size={22} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Center
                          </span>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '1.15rem',
                              fontWeight: '800',
                              color: '#0f172a',
                            }}
                          >
                            {cName}
                          </h3>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {chUser ? (
                            <>
                              <span>Centre Head (CH):</span>
                              <strong style={{ color: '#b45309' }}>{chUser.name}</strong>
                              <span style={{ color: '#94a3b8' }}>({chUser.email})</span>
                            </>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No Centre Head Assigned</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          color: '#1d4ed8',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '4px 12px',
                          borderRadius: '16px',
                        }}
                      >
                        {deptNames.length} {deptNames.length === 1 ? 'Department' : 'Departments'} • {centerPeriods.length} {centerPeriods.length === 1 ? 'Period' : 'Periods'}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          executeDownloadCombinedDocx({ center: cName });
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                        title={`Download combined newsletter for ${cName} Center`}
                      >
                        <IconDownload size={14} />
                        <span>Center DOCX</span>
                      </button>
                    </div>
                  </div>

                  {/* Departments within this Center */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {deptNames.map((deptName, dIdx) => {
                      const deptPeriods = deptsInCenter[deptName];
                      const deptMonthCards = groupPeriodsIntoMonthCards(deptPeriods);
                      const ghPeriod = deptPeriods.find((p) => p.creator_name);
                      const ghName = ghPeriod?.creator_name;

                      return (
                        <div key={deptName} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {/* Department Section Header */}
                          <div
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderLeft: '4px solid #2563eb',
                              borderRadius: '10px',
                              padding: '10px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <IconUsersGroup size={16} />
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Department:</span>
                                  <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: '800', color: '#0f172a' }}>
                                    {deptName}
                                  </h4>
                                </div>
                                {ghName && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1px' }}>
                                    Group Head (GH): <strong style={{ color: '#334155' }}>{ghName}</strong>
                                  </div>
                                )}
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: '700',
                                color: '#1d4ed8',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                padding: '2px 8px',
                                borderRadius: '12px',
                              }}
                            >
                              {deptPeriods.length} {deptPeriods.length === 1 ? 'Period' : 'Periods'}
                            </span>
                          </div>

                          {/* Month Cards Grid for this Department */}
                          <div className="month-cards-grid">
                            {deptMonthCards.map((monthData) => (
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

                          {/* Department Horizontal Divider */}
                          {dIdx < deptNames.length - 1 && (
                            <div
                              style={{
                                height: '1px',
                                backgroundColor: '#e2e8f0',
                                margin: '8px 0 4px 0',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (isChUser || (isAdmin && selectedCenter !== 'all')) && selectedGroup === 'all' ? (
        /* Executive Center Hub View for CH / Admin: Clean Department Summary Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Department Summary Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '18px',
            }}
          >
            {centerGroups.map((deptName) => {
              const deptPeriods = periods.filter(
                (p) => (p.group_name || '').toLowerCase() === deptName.toLowerCase()
              );
              const ghPeriod = deptPeriods.find((p) => p.creator_name);
              const ghName = ghPeriod?.creator_name || 'Assigned GH';
              const finalizedCount = deptPeriods.filter((p) => p.edit === false).length;
              const openCount = deptPeriods.length - finalizedCount;

              return (
                <div
                  key={deptName}
                  onClick={() => {
                    setSelectedGroup(deptName);
                    fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, deptName, isAdmin ? selectedCenter : undefined);
                    fetchAvailableYears(deptName, isAdmin ? selectedCenter : undefined);
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderTop: '4px solid #2563eb',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.borderTopColor = '#1d4ed8';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(37,99,235,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.borderTopColor = '#2563eb';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                  }}
                  title={`Click to view ${deptName} department calendar`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconBuilding size={18} />
                      </div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>
                        {deptName}
                      </h4>
                    </div>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        color: '#1d4ed8',
                        backgroundColor: '#eff6ff',
                        padding: '3px 10px',
                        borderRadius: '14px',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {deptPeriods.length} {deptPeriods.length === 1 ? 'Period' : 'Periods'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Group Head: <strong style={{ color: '#334155' }}>{ghName}</strong>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#059669', fontWeight: '700' }}>
                        {finalizedCount} Finalized
                      </span>
                      <span style={{ color: '#64748b' }}>•</span>
                      <span style={{ color: '#2563eb', fontWeight: '700' }}>
                        {openCount} Open
                      </span>
                    </div>
                    <span style={{ color: '#2563eb', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      View <IconChevronRight size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filterMode === 'all' && !selectedFilterYear && !selectedFilterMonth ? (
        /* All Years Grouped View (Single Department) */
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
        /* Standard Month Cards Grid (Single Department / Specific Filtered View) */
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

      {/* Download Selection Modal */}
      {downloadModalPeriod && (
        <div
          className="modal-backdrop"
          onClick={() => !downloadingId && setDownloadModalPeriod(null)}
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
              maxWidth: '480px',
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
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  <IconDownload size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: '700' }}>
                    Download Word Document (.docx)
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                    Export newsletter entries to Word format
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !downloadingId && setDownloadModalPeriod(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  cursor: 'pointer',
                  color: '#cbd5e1',
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
                  marginBottom: '18px',
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
                  Target Period
                </span>
                <h4 style={{ margin: '4px 0 0 0', color: '#0f172a', fontSize: '0.94rem' }}>
                  {downloadModalPeriod.title}
                </h4>
              </div>

              {/* Selection Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <IconFilter size={15} style={{ color: '#2563eb' }} />
                  <span>Select Contributor Filter:</span>
                </label>

                {loadingContributors ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      color: '#64748b',
                      fontSize: '0.85rem',
                    }}
                  >
                    <IconLoader2 size={16} className="animate-spin text-blue-600" />
                    <span>Loading contributors...</span>
                  </div>
                ) : (
                  <select
                    value={selectedContributorId}
                    onChange={(e) => setSelectedContributorId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">🌐 All Members (Full Newsletter — {periodContributors.reduce((sum, c) => sum + (c.entry_count || 0), 0)} entries)</option>
                    {periodContributors.map((c) => (
                      <option key={c.id} value={c.id}>
                        👤 {c.name || c.email} ({c.entry_count} {c.entry_count === 1 ? 'entry' : 'entries'})
                      </option>
                    ))}
                  </select>
                )}

                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  {selectedContributorId === ''
                    ? "Exporting full combined document with all members' entries."
                    : 'Exporting document containing only entries created by the selected contributor.'}
                </span>

                {(isAdmin || isChUser) && (
                  <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                    <button
                      type="button"
                      onClick={() => {
                        executeDownloadCombinedDocx({
                          center: isAdmin ? (downloadModalPeriod.center || 'all') : user.center,
                          start_date: downloadModalPeriod.start_date,
                          end_date: downloadModalPeriod.end_date,
                        });
                      }}
                      disabled={downloadingCombined}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.84rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: downloadingCombined ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                      }}
                    >
                      {downloadingCombined ? (
                        <>
                          <IconLoader2 size={16} className="animate-spin" />
                          <span>Generating Combined Doc...</span>
                        </>
                      ) : (
                        <>
                          <IconDownload size={16} />
                          <span>
                            {isAdmin
                              ? `Download Combined for this Period (${downloadModalPeriod.center ? downloadModalPeriod.center + ' Center' : 'All Centers'})`
                              : `Download Combined for All Departments in this Period (${user.center || 'Center'})`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
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
                onClick={() => setDownloadModalPeriod(null)}
                disabled={!!downloadingId || downloadingCombined}
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
                onClick={executeDownloadDocx}
                disabled={!!downloadingId || loadingContributors || downloadingCombined}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.86rem',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: (downloadingId || downloadingCombined) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  opacity: (downloadingId || downloadingCombined) ? 0.75 : 1,
                }}
              >
                {downloadingId ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Generating Doc...</span>
                  </>
                ) : (
                  <>
                    <IconDownload size={16} />
                    <span>Download {downloadModalPeriod.group_name ? `${downloadModalPeriod.group_name} Dept` : 'Newsletter'} (.docx)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Combined Newsletter Modal (Admin & CH Role) */}
      {showCombinedModal && (
        <div
          className="modal-backdrop"
          onClick={() => !downloadingCombined && setShowCombinedModal(false)}
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
              maxWidth: '540px',
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
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  <IconDownload size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#f8fafc', fontWeight: '800' }}>
                    {isAdmin && selectedCombinedCenter === 'all'
                      ? 'Download Institutional Combined Document'
                      : selectedCombinedGroup !== 'all'
                        ? `Download ${selectedCombinedGroup} Department Document`
                        : `Download Combined ${isAdmin ? selectedCombinedCenter : user.center || ''} Document`}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {isAdmin && selectedCombinedCenter === 'all'
                      ? 'Consolidate all centers and all departments across CMTI'
                      : selectedCombinedGroup !== 'all'
                        ? `Generate newsletter document for ${selectedCombinedGroup} under ${isAdmin ? selectedCombinedCenter : user.center || 'Center'}`
                        : `Consolidate all departments under ${isAdmin ? selectedCombinedCenter : user.center || 'Center'}`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !downloadingCombined && setShowCombinedModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  color: '#e2e8f0',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                }}
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Admin Center Scope Selector */}
              {isAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconBuilding size={16} style={{ color: '#2563eb' }} />
                    <span>Select Export Center Scope:</span>
                  </label>
                  <select
                    value={selectedCombinedCenter}
                    onChange={async (e) => {
                      const newCenter = e.target.value;
                      setSelectedCombinedCenter(newCenter);
                      setSelectedCombinedGroup('all');
                      if (newCenter !== 'all') {
                        try {
                          const gRes = await api.get(`/users/groups/list?center=${encodeURIComponent(newCenter)}`);
                          setCenterGroups(gRes.data || []);
                        } catch (err) {
                          console.error('Failed to fetch groups for modal center:', err);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: '700',
                      color: '#0f172a',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="all">🌐 All Centers Combined (Institutional Full Overview)</option>
                    {allCenters.map((cName) => {
                      const chUser = chMapByCenter[cName];
                      return (
                        <option key={cName} value={cName}>
                          🏢 {cName} Center {chUser ? `— CH: ${chUser.name}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Target Overview Pill */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      color: '#64748b',
                      textTransform: 'uppercase',
                    }}
                  >
                    Export Target
                  </span>
                  <h4
                    style={{
                      margin: '2px 0 0 0',
                      color: '#0f172a',
                      fontSize: '0.98rem',
                      fontWeight: '800',
                    }}
                  >
                    {isAdmin && selectedCombinedCenter === 'all'
                      ? 'CMTI All Centers Combined'
                      : `${isAdmin ? selectedCombinedCenter : user.center || 'All Centers'} Center`}
                  </h4>
                </div>
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  {isAdmin && selectedCombinedCenter === 'all'
                    ? `${allCenters.length} Centers • ${allChs.length} CHs`
                    : selectedCombinedGroup !== 'all'
                      ? `${selectedCombinedGroup} Dept`
                      : `${centerGroups.length || 'All'} Departments`}
                </span>
              </div>

              {/* Department Scope Selector (if single center is selected) */}
              {(!isAdmin || selectedCombinedCenter !== 'all') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconFolder size={16} style={{ color: '#2563eb' }} />
                    <span>Department Selection:</span>
                  </label>
                  <select
                    value={selectedCombinedGroup}
                    onChange={(e) => setSelectedCombinedGroup(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: '700',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="all">🌟 All Departments (Combined Full Edition)</option>
                    {centerGroups.map((grp) => (
                      <option key={grp} value={grp}>
                        📁 {grp} Department
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step 1: Select Year & Month */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                    Year:
                  </label>
                  <select
                    value={selectedCombinedYear}
                    onChange={(e) => setSelectedCombinedYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                    }}
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                    Month:
                  </label>
                  <select
                    value={selectedCombinedMonth}
                    onChange={(e) => setSelectedCombinedMonth(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                    }}
                  >
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
                </div>
              </div>

              {/* Step 2: 1-Click Edition / Period Scope Selector */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '8px', display: 'block' }}>
                  Select Newsletter Edition:
                </label>
                {(() => {
                  const yrNum = parseInt(selectedCombinedYear || currentYearStr, 10);
                  const moNum = parseInt(selectedCombinedMonth || String(new Date().getMonth() + 1), 10);
                  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const shortMo = shortMonthNames[moNum - 1] || 'Sep';
                  const lastDay = new Date(yrNum, moNum, 0).getDate();

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setCombinedScope('h1')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                          fontWeight: '700',
                          border: combinedScope === 'h1' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'h1' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'h1' ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          transition: 'all 0.15s ease',
                          boxShadow: combinedScope === 'h1' ? '0 2px 6px rgba(37,99,235,0.15)' : 'none',
                        }}
                      >
                        <span>1st Half (Day 1 – 15)</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: '500', color: combinedScope === 'h1' ? '#2563eb' : '#64748b' }}>
                          {shortMo} 1 – 15, {yrNum}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCombinedScope('h2')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                          fontWeight: '700',
                          border: combinedScope === 'h2' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'h2' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'h2' ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          transition: 'all 0.15s ease',
                          boxShadow: combinedScope === 'h2' ? '0 2px 6px rgba(37,99,235,0.15)' : 'none',
                        }}
                      >
                        <span>2nd Half (Day 16 – {lastDay})</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: '500', color: combinedScope === 'h2' ? '#2563eb' : '#64748b' }}>
                          {shortMo} 16 – {lastDay}, {yrNum}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCombinedScope('month')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          border: combinedScope === 'month' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'month' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'month' ? '#1d4ed8' : '#64748b',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Full Month ({shortMo} 1–{lastDay})
                      </button>

                      <button
                        type="button"
                        onClick={() => setCombinedScope('year')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          border: combinedScope === 'year' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'year' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'year' ? '#1d4ed8' : '#64748b',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Full Year (All {yrNum} Months)
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Real-time Summary Box */}
              {(() => {
                const yrNum = parseInt(selectedCombinedYear || currentYearStr, 10);
                const moNum = parseInt(selectedCombinedMonth || String(new Date().getMonth() + 1), 10);
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const moName = monthNames[moNum - 1] || 'September';
                const lastDay = new Date(yrNum, moNum, 0).getDate();

                let scopeLabel = '';
                if (combinedScope === 'h1') scopeLabel = `1st Half (${moName} 1 – 15, ${yrNum})`;
                else if (combinedScope === 'h2') scopeLabel = `2nd Half (${moName} 16 – ${lastDay}, ${yrNum})`;
                else if (combinedScope === 'month') scopeLabel = `Full Month (${moName} ${yrNum})`;
                else if (combinedScope === 'year') scopeLabel = `Full Year (${yrNum})`;

                return (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#1e293b',
                      lineHeight: '1.45',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <IconFileText size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
                    <div>
                      <span>Exporting: </span>
                      <strong style={{ color: '#1d4ed8' }}>{scopeLabel}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginTop: '1px' }}>
                        {selectedCombinedGroup !== 'all'
                          ? `Generates newsletter document exclusively for ${selectedCombinedGroup} department under ${isAdmin ? selectedCombinedCenter : user.center || 'Center'}.`
                          : `Consolidates all department entries in ${isAdmin && selectedCombinedCenter === 'all' ? 'all centers' : (isAdmin ? selectedCombinedCenter : user.center || 'Center')} into a structured Word document.`}
                      </span>
                    </div>
                  </div>
                );
              })()}
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
                onClick={() => setShowCombinedModal(false)}
                disabled={downloadingCombined}
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
                onClick={() => executeDownloadCombinedDocx()}
                disabled={downloadingCombined}
                style={{
                  padding: '9px 22px',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: downloadingCombined ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  opacity: downloadingCombined ? 0.75 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {downloadingCombined ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Generating Document...</span>
                  </>
                ) : (
                  <>
                    <IconDownload size={16} />
                    <span>
                      {selectedCombinedGroup !== 'all'
                        ? `Download ${selectedCombinedGroup} (.docx)`
                        : 'Download Combined (.docx)'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Create Period Modal */}
      {showCreateModal && (() => {
        const computed = getPeriodComputedDetails(createYear, createMonth, createHalf);
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconCalendarEvent size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: '800', color: '#0f172a' }}>
                      Create Newsletter Period
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Select Year, Month, and 1st or 2nd Half
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                  }}
                >
                  <IconX size={20} />
                </button>
              </div>

              {/* Modal Form Body */}
              <form onSubmit={handleCreatePeriodSubmit} style={{ padding: '20px 24px' }}>
                {createSuccess && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#15803d',
                      fontSize: '0.84rem',
                      fontWeight: '600',
                    }}
                  >
                    ✓ {createSuccess}
                  </div>
                )}

                {createError && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      fontSize: '0.84rem',
                      fontWeight: '600',
                    }}
                  >
                    ⚠️ {createError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 1. Year and Month Selectors */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Select Year *
                      </label>
                      <select
                        value={createYear}
                        onChange={(e) => setCreateYear(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Select Month *
                      </label>
                      <select
                        value={createMonth}
                        onChange={(e) => setCreateMonth(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        {allMonthNames.map((mName, idx) => (
                          <option key={mName} value={idx + 1}>
                            {mName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2. Half Period Selection (1st Half vs 2nd Half) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                      Select Period Half *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* 1st Half Card */}
                      <div
                        onClick={() => setCreateHalf(1)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: createHalf === 1 ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: createHalf === 1 ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: '800', color: createHalf === 1 ? '#1d4ed8' : '#0f172a' }}>
                            1st Half
                          </span>
                          <span
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: createHalf === 1 ? '5px solid #2563eb' : '2px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.76rem', color: createHalf === 1 ? '#2563eb' : '#64748b', fontWeight: '600' }}>
                          1st – 15th of the month
                        </span>
                      </div>

                      {/* 2nd Half Card */}
                      <div
                        onClick={() => setCreateHalf(2)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: createHalf === 2 ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: createHalf === 2 ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: '800', color: createHalf === 2 ? '#1d4ed8' : '#0f172a' }}>
                            2nd Half
                          </span>
                          <span
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: createHalf === 2 ? '5px solid #2563eb' : '2px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.76rem', color: createHalf === 2 ? '#2563eb' : '#64748b', fontWeight: '600' }}>
                          16th – End of month
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Live Auto-Generated Summary Card */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Auto-Generated Period
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                        {user?.group || user?.group_name || 'Department'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a' }}>
                      {computed.title}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IconCalendar size={14} style={{ color: '#2563eb' }} />
                      <span>{computed.dateRangeLabel} ({computed.startDate} to {computed.endDate})</span>
                    </div>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div
                  style={{
                    marginTop: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={submittingCreate}
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
                    type="submit"
                    disabled={submittingCreate}
                    style={{
                      padding: '8px 22px',
                      fontSize: '0.86rem',
                      fontWeight: '700',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      border: 'none',
                      color: '#ffffff',
                      cursor: submittingCreate ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                      opacity: submittingCreate ? 0.75 : 1,
                    }}
                  >
                    {submittingCreate ? (
                      <>
                        <IconLoader2 size={16} className="animate-spin" />
                        <span>Creating Period...</span>
                      </>
                    ) : (
                      <>
                        <IconPlus size={16} />
                        <span>Create Period</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Deadline Reminder Modal Popup (Presented on First Page After Login) */}
      <DeadlineModal />
    </div>
  );
};

export default Periods;
