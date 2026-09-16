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
  const [showCombinedModal, setShowCombinedModal] = useState(false);
  const [combinedScope, setCombinedScope] = useState('period'); // 'period' | 'month' | 'year'
  const [selectedCombinedCenter, setSelectedCombinedCenter] = useState('all');
  const [selectedCombinedPeriod, setSelectedCombinedPeriod] = useState('');
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
  const [createTitle, setCreateTitle] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createGroupName, setCreateGroupName] = useState('');
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

  // Open Create Period Modal (with optional preset dates from unscheduled half row)
  const handleOpenCreateModal = (presetMonthData, halfNum) => {
    setCreateError('');
    setCreateSuccess('');

    if (presetMonthData && halfNum) {
      const year = presetMonthData.year;
      const monthIdx = presetMonthData.monthIndex;
      const monthName = presetMonthData.monthName;
      const lastDay = presetMonthData.lastDayOfMonth;

      const startDay = halfNum === 1 ? 1 : 16;
      const endDay = halfNum === 1 ? 15 : lastDay;

      const sDayStr = String(startDay).padStart(2, '0');
      const eDayStr = String(endDay).padStart(2, '0');
      const mStr = String(monthIdx + 1).padStart(2, '0');

      setCreateTitle(`${monthName} ${year} - ${halfNum === 1 ? '1st Half' : '2nd Half'}`);
      setCreateStartDate(`${year}-${mStr}-${sDayStr}`);
      setCreateEndDate(`${year}-${mStr}-${eDayStr}`);
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const mStr = String(today.getMonth() + 1).padStart(2, '0');
      const monthName = today.toLocaleString('default', { month: 'long' });
      const isH1 = today.getDate() <= 15;

      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      const startDay = isH1 ? '01' : '16';
      const endDay = isH1 ? '15' : String(lastDay).padStart(2, '0');

      setCreateTitle(`${monthName} ${year} - ${isH1 ? '1st Half' : '2nd Half'}`);
      setCreateStartDate(`${year}-${mStr}-${startDay}`);
      setCreateEndDate(`${year}-${mStr}-${endDay}`);
    }

    setCreateGroupName(user?.group || user?.group_name || 'General');
    setShowCreateModal(true);
  };

  // Submit Manual Period Creation to Backend API
  const handleCreatePeriodSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    if (!createTitle.trim()) {
      setCreateError('Please enter a period title.');
      return;
    }
    if (!createStartDate || !createEndDate) {
      setCreateError('Please select both start and end dates.');
      return;
    }
    if (createStartDate > createEndDate) {
      setCreateError('Start date cannot be after end date.');
      return;
    }

    const groupToUse = isAdmin ? (createGroupName || 'General') : (user?.group || user?.group_name || 'General');

    setSubmittingCreate(true);
    try {
      const payload = {
        title: createTitle.trim(),
        start_date: createStartDate,
        end_date: createEndDate,
        group_name: groupToUse,
        created_by: user?.id || 1,
        edit: true,
      };

      await api.post('/periods/', payload);
      setCreateSuccess('Newsletter period created successfully!');
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

  // Extract unique half-month date ranges across all periods for CH
  const uniquePeriodRanges = useMemo(() => {
    const map = new Map();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    periods.forEach((p) => {
      if (p.start_date && p.end_date) {
        const key = `${p.start_date}|${p.end_date}`;
        if (!map.has(key)) {
          const [sy, sm, sd] = p.start_date.split('-');
          const [ey, em, ed] = p.end_date.split('-');
          const sMonth = monthNames[parseInt(sm, 10) - 1] || sm;
          const eMonth = monthNames[parseInt(em, 10) - 1] || em;
          const label = `${sMonth} ${parseInt(sd, 10)} – ${eMonth} ${parseInt(ed, 10)}, ${ey}`;
          map.set(key, {
            key,
            start_date: p.start_date,
            end_date: p.end_date,
            label,
            title: p.title || label,
            year: sy,
            month: parseInt(sm, 10),
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [periods]);

  const executeDownloadCombinedDocx = async (overrideParams = null) => {
    const targetCenter =
      overrideParams?.center ||
      (isAdmin ? selectedCombinedCenter || selectedCenter : user?.center);

    setDownloadingCombined(true);
    try {
      let url = '/periods/center/generate-combined-docx?';
      if (targetCenter && targetCenter !== 'all') {
        url += `center=${encodeURIComponent(targetCenter)}`;
      } else {
        url += 'center=all';
      }
      let filenameLabel = '';

      if (overrideParams?.start_date && overrideParams?.end_date) {
        url += `&start_date=${overrideParams.start_date}&end_date=${overrideParams.end_date}`;
        filenameLabel = `_${overrideParams.start_date}_to_${overrideParams.end_date}`;
      } else if (combinedScope === 'period') {
        const selectedRangeKey = selectedCombinedPeriod || (uniquePeriodRanges[0]?.key);
        if (selectedRangeKey) {
          const [sDate, eDate] = selectedRangeKey.split('|');
          url += `&start_date=${sDate}&end_date=${eDate}`;
          filenameLabel = `_${sDate}_to_${eDate}`;
        }
      } else if (combinedScope === 'month') {
        const yr = selectedCombinedYear || currentYearStr;
        const mo = selectedCombinedMonth || String(new Date().getMonth() + 1);
        url += `&year=${yr}&month=${mo}`;
        filenameLabel = `_${yr}_Month_${mo}`;
      } else if (combinedScope === 'year') {
        const yr = selectedCombinedYear || currentYearStr;
        url += `&year=${yr}`;
        filenameLabel = `_Year_${yr}`;
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
      const filename = `${centerClean}_Combined_Newsletter${filenameLabel}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setShowCombinedModal(false);
      setDownloadModalPeriod(null);
    } catch (err) {
      console.error('Failed to download combined docx:', err);
      alert(err.response?.data?.detail || 'Failed to download consolidated newsletter. No entries found for this selection.');
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
            <span>Newsletter Overview</span>
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
          {canCreatePeriod && (
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '10px 16px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                color: '#2563eb',
                border: '1.5px solid #2563eb',
                fontSize: '0.86rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                transition: 'all 0.18s ease',
                height: 'fit-content',
                alignSelf: 'center',
              }}
              title="Create a new newsletter period manually"
            >
              <IconPlus size={18} strokeWidth={2.4} />
              <span>Create Period Manually</span>
            </button>
          )}

          {(isAdmin || isChUser) && (
            <button
              type="button"
              onClick={() => {
                if (uniquePeriodRanges.length > 0 && !selectedCombinedPeriod) {
                  setSelectedCombinedPeriod(uniquePeriodRanges[0].key);
                }
                setSelectedCombinedCenter(isAdmin ? selectedCenter : user?.center || 'all');
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
              title={isAdmin ? "Download Combined Institutional DOCX" : "Download Center Combined DOCX"}
            >
              <IconDownload size={18} strokeWidth={2.2} />
              <span>{isAdmin ? 'Download Institutional Combined (.docx)' : 'Download Center Combined (.docx)'}</span>
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
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconBuilding size={18} style={{ color: '#d97706' }} />
            <span style={{ fontSize: '0.86rem', fontWeight: '700', color: '#1e293b' }}>
              Filter by Department ({isAdmin ? selectedCenter : user?.center}):
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedGroup('all');
                fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, 'all');
                fetchAvailableYears('all');
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '700',
                border: selectedGroup === 'all' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: selectedGroup === 'all' ? '#eff6ff' : '#ffffff',
                color: selectedGroup === 'all' ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
                boxShadow: selectedGroup === 'all' ? '0 1px 4px rgba(37,99,235,0.2)' : 'none',
              }}
            >
              <IconUsersGroup size={14} style={{ color: selectedGroup === 'all' ? '#2563eb' : '#64748b' }} />
              <span>All Groups {centerGroups.length > 0 ? `(${centerGroups.length})` : ''}</span>
            </button>

            {centerGroups.map((grp) => {
              const isSelected = selectedGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => {
                    setSelectedGroup(grp);
                    fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, grp);
                    fetchAvailableYears(grp);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 4px rgba(37,99,235,0.2)' : 'none',
                  }}
                >
                  <span>{grp}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                if (uniquePeriodRanges.length > 0 && !selectedCombinedPeriod) {
                  setSelectedCombinedPeriod(uniquePeriodRanges[0].key);
                }
                setSelectedCombinedCenter(isAdmin ? selectedCenter : user?.center || 'all');
                setShowCombinedModal(true);
              }}
              style={{
                marginLeft: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '700',
                border: '1.5px solid #059669',
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 4px rgba(5, 150, 105, 0.15)',
              }}
              title="Download combined newsletter for all departments under this center"
            >
              <IconDownload size={14} />
              <span>Combined DOCX</span>
            </button>
          </div>
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
        /* Single Center Multi-Department Sectioned View (One Dept Section -> Divider -> Next Dept Section) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {(() => {
            const groupedDepts = {};
            periods.forEach((p) => {
              const g = p.group_name || 'General';
              if (!groupedDepts[g]) groupedDepts[g] = [];
              groupedDepts[g].push(p);
            });

            const deptNames = Object.keys(groupedDepts).sort();

            return deptNames.map((deptName, idx) => {
              const deptPeriods = groupedDepts[deptName];
              const deptMonthCards = groupPeriodsIntoMonthCards(deptPeriods);
              const ghPeriod = deptPeriods.find((p) => p.creator_name);
              const ghName = ghPeriod?.creator_name;

              return (
                <div key={deptName} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Department Section Header Banner */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderLeft: '5px solid #2563eb',
                      borderRadius: '12px',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconUsersGroup size={18} />
                      </div>
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: '800',
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span>Department:</span>
                          <span style={{ color: '#2563eb' }}>{deptName}</span>
                        </h3>
                        {ghName && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', fontWeight: '500' }}>
                            Group Head (GH): <strong style={{ color: '#334155' }}>{ghName}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          color: '#1d4ed8',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '3px 10px',
                          borderRadius: '14px',
                        }}
                      >
                        {deptPeriods.length} {deptPeriods.length === 1 ? 'Period' : 'Periods'}
                      </span>
                    </div>
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

                  {/* Clean Horizontal Divider line after department data */}
                  {idx < deptNames.length - 1 && (
                    <div
                      style={{
                        height: '1px',
                        backgroundColor: '#cbd5e1',
                        margin: '18px 0 6px 0',
                        opacity: 0.8,
                      }}
                    />
                  )}
                </div>
              );
            });
          })()}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
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
                  <IconDownload size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#f8fafc', fontWeight: '800' }}>
                    {isAdmin && selectedCombinedCenter === 'all'
                      ? 'Download Institutional Combined Document'
                      : `Download Combined ${isAdmin ? selectedCombinedCenter : user.center || ''} Document`}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {isAdmin && selectedCombinedCenter === 'all'
                      ? 'Consolidate all centers and all departments across CMTI'
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
                    onChange={(e) => setSelectedCombinedCenter(e.target.value)}
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
                    : `${centerGroups.length || 'All'} Departments`}
                </span>
              </div>

              {/* Scope Selector Tabs */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '8px', display: 'block' }}>
                  Choose Export Scope:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCombinedScope('period')}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      border: combinedScope === 'period' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: combinedScope === 'period' ? '#eff6ff' : '#ffffff',
                      color: combinedScope === 'period' ? '#1d4ed8' : '#64748b',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Half-Month Period
                  </button>

                  <button
                    type="button"
                    onClick={() => setCombinedScope('month')}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      border: combinedScope === 'month' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: combinedScope === 'month' ? '#eff6ff' : '#ffffff',
                      color: combinedScope === 'month' ? '#1d4ed8' : '#64748b',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Full Month
                  </button>

                  <button
                    type="button"
                    onClick={() => setCombinedScope('year')}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      border: combinedScope === 'year' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: combinedScope === 'year' ? '#eff6ff' : '#ffffff',
                      color: combinedScope === 'year' ? '#1d4ed8' : '#64748b',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Full Year
                  </button>
                </div>
              </div>

              {/* Dynamic Controls Based on Scope */}
              {combinedScope === 'period' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>
                    Select Half-Month Period:
                  </label>
                  {uniquePeriodRanges.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                      No active periods recorded for this selection.
                    </div>
                  ) : (
                    <select
                      value={selectedCombinedPeriod || (uniquePeriodRanges[0]?.key || '')}
                      onChange={(e) => setSelectedCombinedPeriod(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        fontWeight: '600',
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      {uniquePeriodRanges.map((r) => (
                        <option key={r.key} value={r.key}>
                          📅 {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {combinedScope === 'month' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                      Year:
                    </label>
                    <select
                      value={selectedCombinedYear}
                      onChange={(e) => setSelectedCombinedYear(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        fontWeight: '600',
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
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
                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                      Month:
                    </label>
                    <select
                      value={selectedCombinedMonth}
                      onChange={(e) => setSelectedCombinedMonth(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        fontWeight: '600',
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
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
              )}

              {combinedScope === 'year' && (
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    Select Year:
                  </label>
                  <select
                    value={selectedCombinedYear}
                    onChange={(e) => setSelectedCombinedYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Info Note */}
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#475569',
                  lineHeight: '1.45',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '10px 12px',
                  borderRadius: '8px',
                }}
              >
                ℹ️ The generated Word document (.docx) will automatically organize entries{' '}
                <strong>
                  {isAdmin && selectedCombinedCenter === 'all'
                    ? 'Center-by-Center and Department-by-Department'
                    : 'Department-by-Department'}
                </strong>
                , including Centre Head / Group Head attributions, sequential numbering, and centered high-resolution photos.
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
                disabled={downloadingCombined || (combinedScope === 'period' && uniquePeriodRanges.length === 0)}
                style={{
                  padding: '8px 22px',
                  fontSize: '0.86rem',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: downloadingCombined ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  opacity: downloadingCombined ? 0.75 : 1,
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
                      {isAdmin && selectedCombinedCenter === 'all'
                        ? 'Download Institutional Combined (.docx)'
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
      {showCreateModal && (
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
              maxWidth: '520px',
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
                    Manually define a new period for newsletter entries
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Period Title *
                  </label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="e.g. September 2026 - 1st Half"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={createStartDate}
                      onChange={(e) => setCreateStartDate(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={createEndDate}
                      onChange={(e) => setCreateEndDate(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Department / Group *
                    </label>
                    <input
                      type="text"
                      value={createGroupName}
                      onChange={(e) => setCreateGroupName(e.target.value)}
                      placeholder="e.g. Design & Precision Engineering"
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
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
      )}

      {/* Deadline Reminder Modal Popup (Presented on First Page After Login) */}
      <DeadlineModal />
    </div>
  );
};

export default Periods;
