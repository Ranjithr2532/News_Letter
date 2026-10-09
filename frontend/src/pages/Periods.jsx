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
  IconCircleCheck,
  IconLock,
  IconLockOpen,
  IconX,
  IconFilter,
  IconRotateClockwise,
  IconFileText,
  IconClock,
  IconLoader2,
  IconUsersGroup,
  IconBuilding,
  IconShield,
  IconFolder,
  IconArrowLeft,
  IconHome,
  IconUpload,
  IconTrash,
  IconFile,
  IconAlertCircle,
  IconExternalLink,
} from '@tabler/icons-react';

const getMonthBlockClass = (monthIndex) => {
  if (monthIndex < 4) return 'month-block-1'; // Jan - Apr
  if (monthIndex < 8) return 'month-block-2'; // May - Aug
  return 'month-block-3'; // Sep - Dec
};

const Periods = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const currentRole = (user?.activeRole || user?.role || '').toLowerCase().trim();
  const isEditor = currentRole === 'edit' || currentRole === 'editor';
  const isAdmin = currentRole === 'admin';
  const isChUser = currentRole === 'ch';
  const isGhUser = currentRole === 'gh';
  const currentYearStr = String(new Date().getFullYear());

  const [periods, setPeriods] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Published PDF Uploads map (key: `${start_date}_${end_date}`)
  const [publishedUploads, setPublishedUploads] = useState({});

  // 12-Month Publication Calendar Modal (for Editor)
  const [showPublicationCalendarModal, setShowPublicationCalendarModal] = useState(false);
  const [calendarSelectedYear, setCalendarSelectedYear] = useState(currentYearStr);
  const [selectedCalendarMonthIndex, setSelectedCalendarMonthIndex] = useState(new Date().getMonth());

  // Direct PDF Upload state for 12-Month Publication Calendar
  const [uploadingSlotKey, setUploadingSlotKey] = useState(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState(null);

  // PDF Delete Confirmation Modal state
  const [deletePdfModal, setDeletePdfModal] = useState({
    isOpen: false,
    uploadId: null,
    title: '',
    isDeleting: false,
  });

  // Admin & CH Role: Centers, Centre Heads, and Group Heads data
  const [allCenters, setAllCenters] = useState([]);
  const [allChs, setAllChs] = useState([]);
  const [allGhs, setAllGhs] = useState([]);
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

  // Re-open / Unlock popup state (for GH & Admin roles)
  const [reopenModalPeriod, setReopenModalPeriod] = useState(null);
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // Department Selection Modal for View Categories (when multiple departments exist in a half)
  const [deptSelectModal, setDeptSelectModal] = useState(null);

  // Department Selection Modal for Download (when multiple departments exist in a half)
  const [downloadSelectModal, setDownloadSelectModal] = useState(null);

  const [creatingHalfKey, setCreatingHalfKey] = useState(null);

  // Defaults to current year (e.g. '2026') on mount
  const [filterMode, setFilterMode] = useState(currentYearStr);

  // Multi-Year Range Selection State
  const [yearSelectionType, setYearSelectionType] = useState('range');
  const [selectedFromYear, setSelectedFromYear] = useState(currentYearStr);
  const [selectedToYear, setSelectedToYear] = useState(currentYearStr);

  // Available Categories for Category-Wise Filter & Download
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('all');

  // Top Specific Filter (Year & Month & Half) - default to current year
  const [selectedFilterYear, setSelectedFilterYear] = useState(currentYearStr);
  const [selectedFilterMonth, setSelectedFilterMonth] = useState('');
  const [selectedFilterHalf, setSelectedFilterHalf] = useState('');

  const fetchPublishedUploads = async () => {
    try {
      const res = await api.get('/newsletter-upload/');
      const list = res.data || [];
      const map = {};
      list.forEach((item) => {
        if (item.start_date && item.end_date) {
          const key = `${item.start_date}_${item.end_date}`;
          map[key] = item;
        }
      });
      setPublishedUploads(map);
    } catch (err) {
      console.error('Failed to fetch published newsletter uploads:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const userGroup = user.group || user.group_name || '';

    const initPeriods = async () => {
      // 1. Fetch Centers, Centre Heads, and Group Heads for institutional hierarchy
      try {
        const promises = [api.get('/users/ghs/list')];
        if (isEditor || isChUser) {
          promises.push(api.get('/users/chs/list'));
        }
        if (isEditor) {
          promises.push(api.get('/users/centers/list'));
        }
        const results = await Promise.all(promises);
        setAllGhs(results[0]?.data || []);
        if (isEditor || isChUser) {
          setAllChs(results[1]?.data || []);
        }
        if (isEditor) {
          setAllCenters(results[2]?.data || []);
        }
      } catch (hierarchyErr) {
        console.error('Failed to fetch centers/chs/ghs:', hierarchyErr);
      }

      // 2. Fetch available categories for category-wise filtering and download
      try {
        const catRes = await api.get('/categories/');
        setAvailableCategories(catRes.data || []);
      } catch (catErr) {
        console.error('Failed to fetch categories:', catErr);
      }

      // 3. If CH, fetch all active groups under this center
      if (isChUser && user?.center) {
        setSelectedCenter(user.center);
        try {
          const gRes = await api.get(
            `/users/groups/list?center=${encodeURIComponent(user.center)}`
          );
          setCenterGroups(gRes.data || []);
        } catch (gErr) {
          console.error('Failed to fetch center groups:', gErr);
        }
      }

      // 4. Fetch available years, published uploads, and load current year's periods
      const initialCenter = isEditor ? 'all' : (isChUser ? user?.center : undefined);
      const initialGroup = 'all';
      setSelectedGroup('all');
      fetchAvailableYears(initialGroup, initialCenter);
      fetchPublishedUploads();
      fetchPeriods(currentYearStr, currentYearStr, '', initialGroup, initialCenter, 'single');
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

  const ghMapByGroup = useMemo(() => {
    const map = {};
    allGhs.forEach((gh) => {
      const grp = (gh.group || gh.group_name || '').trim().toUpperCase();
      const ctr = (gh.center || '').trim().toUpperCase();
      if (grp) {
        if (ctr) {
          map[`${ctr}_${grp}`] = gh;
        }
        if (!map[grp]) {
          map[grp] = gh;
        }
      }
    });
    return map;
  }, [allGhs]);

  const fetchAvailableYears = async (
    grp = selectedGroup,
    targetCenter = (isEditor ? selectedCenter : isChUser ? user?.center : undefined)
  ) => {
    try {
      let url = '/periods/years/?';
      const params = [];
      if (targetCenter && targetCenter !== 'all') {
        params.push(`center=${encodeURIComponent(targetCenter)}`);
      }
      if (grp && grp !== 'all') {
        params.push(`group_name=${encodeURIComponent(grp)}`);
      } else if (!isEditor && !isChUser) {
        const userGroup = user?.group || user?.group_name || '';
        if (userGroup) params.push(`group_name=${encodeURIComponent(userGroup)}`);
      }
      url += params.join('&');
      const res = await api.get(url);
      const fetchedYears = res?.data || [];
      const curYr = new Date().getFullYear();
      const defaultYears = [curYr, curYr - 1, curYr - 2, curYr - 3];
      const combined = Array.from(new Set([...fetchedYears, ...defaultYears])).sort((a, b) => b - a);
      setAvailableYears(combined);
    } catch (err) {
      console.error('Failed to fetch period years:', err);
      const curYr = new Date().getFullYear();
      setAvailableYears([curYr, curYr - 1, curYr - 2, curYr - 3]);
    }
  };

  const curYr = new Date().getFullYear();

  // 1. Top 3 quick buttons: Current Year + 2 previous years (Total 3 years: e.g. 2026, 2025, 2024)
  const topThreeYears = useMemo(() => [curYr, curYr - 1, curYr - 2], [curYr]);

  // 2. More Years List (from curYr - 3 down to 2019)
  const moreYearsList = useMemo(() => {
    const list = [];
    for (let y = curYr - 3; y >= 2019; y--) {
      list.push(y);
    }
    availableYears.forEach((y) => {
      if (!topThreeYears.includes(y) && !list.includes(y)) {
        list.push(y);
      }
    });
    list.sort((a, b) => b - a);
    return list;
  }, [curYr, topThreeYears, availableYears]);

  // 3. Selectable Years in Dropdowns: Up to Current Year, going back to 2019
  const allSelectableYears = useMemo(() => {
    const list = [];
    for (let y = curYr; y >= 2019; y--) {
      list.push(y);
    }
    const combined = Array.from(new Set([...list, ...availableYears])).sort((a, b) => b - a);
    return combined;
  }, [curYr, availableYears]);

  // 4. Selectable To-Years in Dropdown: Only years >= selectedFromYear
  const toYearOptions = useMemo(() => {
    const fromY = parseInt(selectedFromYear, 10);
    if (isNaN(fromY)) return allSelectableYears;
    return allSelectableYears.filter((yr) => yr >= fromY);
  }, [allSelectableYears, selectedFromYear]);

  // 12-Month Calendar Grid Data for the Editor Publication Timetable
  const calendarMonthsData = useMemo(() => {
    const yr = parseInt(calendarSelectedYear || currentYearStr, 10);
    const monthDefs = [
      { fullName: 'January', name: 'Jan', index: 0 },
      { fullName: 'February', name: 'Feb', index: 1 },
      { fullName: 'March', name: 'Mar', index: 2 },
      { fullName: 'April', name: 'April', index: 3 },
      { fullName: 'May', name: 'May', index: 4 },
      { fullName: 'June', name: 'June', index: 5 },
      { fullName: 'July', name: 'July', index: 6 },
      { fullName: 'August', name: 'Aug', index: 7 },
      { fullName: 'September', name: 'Sept', index: 8 },
      { fullName: 'October', name: 'Oct', index: 9 },
      { fullName: 'November', name: 'Nov', index: 10 },
      { fullName: 'December', name: 'Dec', index: 11 },
    ];

    return monthDefs.map((m) => {
      const padMo = String(m.index + 1).padStart(2, '0');
      const lastDay = new Date(yr, m.index + 1, 0).getDate();

      const h1Start = `${yr}-${padMo}-01`;
      const h1End = `${yr}-${padMo}-15`;
      const h1Key = `${h1Start}_${h1End}`;
      const h1Upload = publishedUploads[h1Key] || null;

      const h2Start = `${yr}-${padMo}-16`;
      const h2End = `${yr}-${padMo}-${String(lastDay).padStart(2, '0')}`;
      const h2Key = `${h2Start}_${h2End}`;
      const h2Upload = publishedUploads[h2Key] || null;

      const publishedCount = (h1Upload ? 1 : 0) + (h2Upload ? 1 : 0);

      return {
        ...m,
        year: yr,
        lastDay,
        publishedCount,
        isPublished: publishedCount > 0,
        h1: {
          startDate: h1Start,
          endDate: h1End,
          label: `${m.name} 01 – 15`,
          upload: h1Upload,
        },
        h2: {
          startDate: h2Start,
          endDate: h2End,
          label: `${m.name} 16 – End`,
          upload: h2Upload,
        },
      };
    });
  }, [calendarSelectedYear, publishedUploads, currentYearStr]);

  const fetchPeriods = async (
    mode = currentYearStr,
    filterYear = selectedFilterYear,
    filterMonth = selectedFilterMonth,
    grp = selectedGroup,
    targetCenter = (isEditor ? selectedCenter : isChUser ? user?.center : undefined),
    rangeType = yearSelectionType,
    fromYr = selectedFromYear,
    toYr = selectedToYear
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
      } else if (!isEditor && !isChUser) {
        const userGroup = user?.group || user?.group_name || '';
        if (userGroup) params.push(`group_name=${encodeURIComponent(userGroup)}`);
      }

      if (mode === 'all' || filterYear === 'all' || rangeType === 'all') {
        params.push('all_years=true');
        if (filterMonth) {
          params.push(`month=${filterMonth}`);
        }
      } else if (rangeType === 'past2' || mode === 'past2') {
        params.push(`from_year=${curYr - 1}`);
        params.push(`to_year=${curYr}`);
        if (filterMonth) {
          params.push(`month=${filterMonth}`);
        }
      } else if (rangeType === 'past3' || mode === 'past3') {
        params.push(`from_year=${curYr - 2}`);
        params.push(`to_year=${curYr}`);
        if (filterMonth) {
          params.push(`month=${filterMonth}`);
        }
      } else if (rangeType === 'range' || mode === 'range') {
        const minY = Math.min(parseInt(fromYr || curYr - 2, 10), parseInt(toYr || curYr, 10));
        const maxY = Math.max(parseInt(fromYr || curYr - 2, 10), parseInt(toYr || curYr, 10));
        params.push(`from_year=${minY}`);
        params.push(`to_year=${maxY}`);
        if (filterMonth) {
          params.push(`month=${filterMonth}`);
        }
      } else {
        const yrToSend = filterYear || (mode && !isNaN(parseInt(mode, 10)) ? mode : currentYearStr);
        params.push(`year=${yrToSend}`);
        if (filterMonth) {
          params.push(`month=${filterMonth}`);
        }
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

  const handleResetAllFilters = () => {
    const defaultCenter = isEditor ? 'all' : (user?.center || 'all');
    setSelectedCenter(defaultCenter);
    setSelectedGroup('all');
    setSelectedCombinedCenter(defaultCenter);
    setSelectedCombinedGroup('all');
    if (isEditor) {
      setCenterGroups([]);
    }
    setSelectedFromYear(currentYearStr);
    setSelectedToYear(currentYearStr);
    setSelectedFilterMonth('');
    setSelectedFilterHalf('');
    setSelectedFilterYear(currentYearStr);
    setFilterMode('range');
    setYearSelectionType('range');
    setSelectedFilterCategory('all');

    fetchPeriods('range', '', '', 'all', defaultCenter, 'range', currentYearStr, currentYearStr);
    fetchAvailableYears('all', defaultCenter);
  };

  const handleOpenDownloadModal = async (e, period) => {
    if (e) e.stopPropagation();
    if (!period) return;

    setDownloadingId(period.id);
    try {
      let url = `/periods/${period.id}/generate-docx`;
      // For regular members (Scientist/Engineer) when period is not finalized:
      // download ONLY their own entries
      if (!isEditor && !isChUser && !isGhUser && period.edit !== false) {
        url += `?created_by=${user.id}`;
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
      const userSuffix = (!isEditor && !isChUser && !isGhUser && period.edit !== false && user?.name)
        ? `_${user.name.replace(/\s+/g, '_')}`
        : '';
      const filename = `${period.title.replace(/\s+/g, '_')}${userSuffix}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download period docx:', err);
      let errorMsg = 'Failed to download period document.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.detail) errorMsg = json.detail;
        } catch (_) { }
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }
      alert(errorMsg);
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

  const handleConfirmReopen = async () => {
    if (!reopenModalPeriod) return;
    setSubmittingReopen(true);
    try {
      await api.post(`/periods/${reopenModalPeriod.id}/reopen`);
      setPeriods((prev) =>
        prev.map((p) =>
          p.id === reopenModalPeriod.id ? { ...p, edit: true } : p
        )
      );
      setReopenModalPeriod(null);
    } catch (err) {
      console.error('Failed to reopen period:', err);
      alert(err.response?.data?.detail || 'Failed to re-open newsletter.');
    } finally {
      setSubmittingReopen(false);
    }
  };

  const handleDirectPdfUpload = async (file, startDate, endDate, rangeLabel, existingUpload = null) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Please select a valid PDF file (.pdf).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50MB limit.');
      return;
    }

    const slotKey = `${startDate}_${endDate}`;
    setUploadingSlotKey(slotKey);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      formData.append('uploaded_by', user.id);

      const defaultTitle =
        existingUpload?.title ||
        file.name.replace(/\.pdf$/i, '').trim() ||
        `CMTI Official Newsletter — ${rangeLabel}`;
      formData.append('title', defaultTitle);

      await api.post('/newsletter-upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      await fetchPublishedUploads();
      await fetchPeriods(
        filterMode,
        selectedFilterYear,
        selectedFilterMonth,
        selectedGroup,
        isEditor ? selectedCenter : user?.center
      );
    } catch (err) {
      console.error('Failed to upload published newsletter PDF:', err);
      alert(err.response?.data?.detail || 'Failed to upload PDF. Please check server connection.');
    } finally {
      setUploadingSlotKey(null);
      setDragOverSlotKey(null);
    }
  };

  const handleConfirmDeletePdf = async () => {
    if (!deletePdfModal.uploadId) return;
    setDeletePdfModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      await api.delete(`/newsletter-upload/${deletePdfModal.uploadId}?user_id=${user.id}`);
      setDeletePdfModal({ isOpen: false, uploadId: null, title: '', isDeleting: false });
      await fetchPublishedUploads();
      await fetchPeriods(
        filterMode,
        selectedFilterYear,
        selectedFilterMonth,
        selectedGroup,
        isEditor ? selectedCenter : user?.center
      );
    } catch (err) {
      console.error('Failed to delete published PDF:', err);
      alert(err.response?.data?.detail || 'Failed to delete published newsletter PDF.');
      setDeletePdfModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const executeDownloadCombinedDocx = async (overrideParams = null) => {
    const userDept = user?.group || user?.group_name || '';
    const targetCenter =
      overrideParams?.center !== undefined
        ? overrideParams.center
        : (isEditor ? (selectedCenter || 'all') : (user?.center || 'all'));
    const targetGroup =
      overrideParams?.group_name !== undefined
        ? overrideParams.group_name
        : (!isEditor && !isChUser && userDept ? userDept : (selectedGroup || 'all'));
    const targetCategory =
      overrideParams?.category !== undefined
        ? overrideParams.category
        : (selectedFilterCategory && selectedFilterCategory !== 'all' ? selectedFilterCategory : null);

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
      if (targetCategory && targetCategory !== 'all') {
        url += `&category=${encodeURIComponent(targetCategory)}`;
      }

      let filenameLabel = '';
      if (targetCategory && targetCategory !== 'all') {
        filenameLabel += `_${targetCategory.replace(/\s+/g, '_')}`;
      }

      if (overrideParams?.start_date && overrideParams?.end_date) {
        url += `&start_date=${overrideParams.start_date}&end_date=${overrideParams.end_date}`;
        filenameLabel += `_${overrideParams.start_date}_to_${overrideParams.end_date}`;
      } else if (overrideParams?.from_year && overrideParams?.to_year) {
        const minY = Math.min(overrideParams.from_year, overrideParams.to_year);
        const maxY = Math.max(overrideParams.from_year, overrideParams.to_year);
        url += `&from_year=${minY}&to_year=${maxY}`;
        if (minY === maxY && overrideParams.month) {
          const padMo = String(overrideParams.month).padStart(2, '0');
          url += `&month=${overrideParams.month}`;
          filenameLabel += `_${minY}_Month_${padMo}`;
        } else {
          filenameLabel += `_${minY}_to_${maxY}`;
        }
      } else if (overrideParams?.all_years) {
        url += '&all_years=true';
        filenameLabel += '_All_Years';
        if (overrideParams.month) {
          const padMo = String(overrideParams.month).padStart(2, '0');
          url += `&month=${overrideParams.month}`;
          filenameLabel += `_Month_${padMo}`;
        }
      } else if (overrideParams?.year) {
        url += `&year=${overrideParams.year}`;
        filenameLabel += `_Year_${overrideParams.year}`;
        if (overrideParams.month) {
          const padMo = String(overrideParams.month).padStart(2, '0');
          url += `&month=${overrideParams.month}`;
          filenameLabel += `_Month_${padMo}`;
        }
      } else {
        // Fall back to active filter state
        if (yearSelectionType === 'past2' || filterMode === 'past2') {
          url += `&from_year=${curYr - 1}&to_year=${curYr}`;
          filenameLabel += `_${curYr - 1}_to_${curYr}`;
          if (selectedFilterMonth) {
            url += `&month=${selectedFilterMonth}`;
            filenameLabel += `_Month_${String(selectedFilterMonth).padStart(2, '0')}`;
          }
        } else if (yearSelectionType === 'past3' || filterMode === 'past3') {
          url += `&from_year=${curYr - 2}&to_year=${curYr}`;
          filenameLabel += `_${curYr - 2}_to_${curYr}`;
          if (selectedFilterMonth) {
            url += `&month=${selectedFilterMonth}`;
            filenameLabel += `_Month_${String(selectedFilterMonth).padStart(2, '0')}`;
          }
        } else if (yearSelectionType === 'range' || filterMode === 'range') {
          const minY = Math.min(parseInt(selectedFromYear, 10), parseInt(selectedToYear, 10));
          const maxY = Math.max(parseInt(selectedFromYear, 10), parseInt(selectedToYear, 10));
          url += `&from_year=${minY}&to_year=${maxY}`;
          filenameLabel += `_${minY}_to_${maxY}`;
          if (selectedFilterMonth) {
            url += `&month=${selectedFilterMonth}`;
            filenameLabel += `_Month_${String(selectedFilterMonth).padStart(2, '0')}`;
          }
        } else if (yearSelectionType === 'all' || filterMode === 'all' || selectedFilterYear === 'all') {
          url += '&all_years=true';
          filenameLabel += '_All_Years';
          if (selectedFilterMonth) {
            url += `&month=${selectedFilterMonth}`;
            filenameLabel += `_Month_${String(selectedFilterMonth).padStart(2, '0')}`;
          }
        } else {
          const yr = parseInt(selectedFilterYear || currentYearStr, 10);
          url += `&year=${yr}`;
          filenameLabel += `_Year_${yr}`;
          if (selectedFilterMonth) {
            url += `&month=${selectedFilterMonth}`;
            filenameLabel += `_Month_${String(selectedFilterMonth).padStart(2, '0')}`;
          }
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
    } catch (err) {
      console.error('Failed to download combined docx:', err);
      let errorMsg = 'No entries found for this selection in the specified period.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.detail) errorMsg = json.detail;
        } catch (_) { }
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }
      alert(errorMsg);
    } finally {
      setDownloadingCombined(false);
    }
  };

  // Helper: Group periods array into Month Cards (each card represents one month with Half 1 & Half 2)
  const groupPeriodsIntoMonthCards = (
    periodsList,
    currentMode,
    currentYearFilter,
    currentMonthFilter,
    rangeType = yearSelectionType,
    fromYr = selectedFromYear,
    toYr = selectedToYear
  ) => {
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

    // Determine which years to populate
    let targetYears = [];
    if (rangeType === 'range' || currentMode === 'range') {
      const minY = Math.min(parseInt(fromYr || curYr - 2, 10), parseInt(toYr || curYr, 10));
      const maxY = Math.max(parseInt(fromYr || curYr - 2, 10), parseInt(toYr || curYr, 10));
      for (let y = maxY; y >= minY; y--) {
        targetYears.push(y);
      }
    } else if (rangeType === 'past2' || currentMode === 'past2') {
      targetYears = [curYr, curYr - 1];
    } else if (rangeType === 'past3' || currentMode === 'past3') {
      targetYears = [curYr, curYr - 1, curYr - 2];
    } else if (currentYearFilter && currentYearFilter !== 'all' && rangeType === 'single') {
      targetYears = [parseInt(currentYearFilter, 10)];
    } else if (currentMode === 'all' || currentYearFilter === 'all' || rangeType === 'all') {
      const yearsFromPeriods = periodsList
        .map((p) => (p.start_date ? parseInt(p.start_date.split('-')[0], 10) : null))
        .filter(Boolean);
      const allYearsSet = new Set([...topThreeYears, ...yearsFromPeriods, parseInt(currentYearStr, 10)]);
      targetYears = Array.from(allYearsSet).sort((a, b) => b - a);
    } else if (currentMode && currentMode !== 'recent' && currentMode !== 'custom' && !isNaN(parseInt(currentMode, 10))) {
      targetYears = [parseInt(currentMode, 10)];
    } else {
      targetYears = [parseInt(currentYearStr, 10)];
    }

    // Determine which months to populate (0..11 or specific selectedFilterMonth - 1)
    const targetMonths = currentMonthFilter
      ? [parseInt(currentMonthFilter, 10) - 1]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    // Pre-populate all target months for target years
    targetYears.forEach((year) => {
      targetMonths.forEach((monthIndex) => {
        if (monthIndex < 0 || monthIndex > 11) return;
        const padMonth = String(monthIndex + 1).padStart(2, '0');
        const monthKey = `${year}-${padMonth}`;
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        monthMap[monthKey] = {
          yearMonthStr: monthKey,
          year,
          monthIndex,
          monthName: `${monthNamesFull[monthIndex]} ${year}`,
          monthAbbrev: monthNamesAbbrev[monthIndex],
          lastDayOfMonth: lastDay,
          half1: [],
          half2: [],
        };
      });
    });

    // Merge existing DB periods into half1 and half2
    periodsList.forEach((period) => {
      if (!period.start_date) return;
      const [yStr, mStr, dStr] = period.start_date.split('-');
      const year = parseInt(yStr, 10);
      const monthIndex = parseInt(mStr, 10) - 1;
      const day = parseInt(dStr, 10);
      const padMonth = String(monthIndex + 1).padStart(2, '0');
      const monthKey = `${year}-${padMonth}`;

      // If a specific month is selected, skip any period that belongs to other months
      if (currentMonthFilter && (monthIndex + 1) !== parseInt(currentMonthFilter, 10)) {
        return;
      }

      if (monthMap[monthKey]) {
        if (day <= 15) {
          monthMap[monthKey].half1.push(period);
        } else {
          monthMap[monthKey].half2.push(period);
        }
      } else if (currentMode === 'all' || currentYearFilter === 'all' || rangeType === 'all' || rangeType === 'range' || rangeType === 'past2' || rangeType === 'past3') {
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        monthMap[monthKey] = {
          yearMonthStr: monthKey,
          year,
          monthIndex,
          monthName: `${monthNamesFull[monthIndex]} ${year}`,
          monthAbbrev: monthNamesAbbrev[monthIndex],
          lastDayOfMonth: lastDay,
          half1: day <= 15 ? [period] : [],
          half2: day > 15 ? [period] : [],
        };
      }
    });

    Object.values(monthMap).forEach((m) => {
      m.half1.sort((a, b) => (a.group_name || '').localeCompare(b.group_name || ''));
      m.half2.sort((a, b) => (a.group_name || '').localeCompare(b.group_name || ''));
    });

    // Sort years descending, then months ascending Jan to Dec (1 to 12)
    const sortedKeys = Object.keys(monthMap).sort((a, b) => {
      const [yA, mA] = a.split('-').map(Number);
      const [yB, mB] = b.split('-').map(Number);
      if (yA !== yB) return yB - yA;
      return mA - mB;
    });

    return sortedKeys.map((key) => monthMap[key]);
  };

  // Compute live statistics
  const stats = useMemo(() => {
    const total = periods.length;
    const finalized = periods.filter((p) => p.edit === false).length;
    const open = total - finalized;
    return { total, finalized, open };
  }, [periods]);

  // Open Department Selection Modal to View Categories (or directly open for CH)
  const handleHalfRowClick = (periodsInHalf, rangeLabel) => {
    if (isEditor) return;
    if (!periodsInHalf || periodsInHalf.length === 0) return;

    if (isChUser) {
      const allPeriodIds = periodsInHalf.map((p) => p.id).join(',');
      const combinedTitle = `${user?.center || 'Center'} Combined — ${rangeLabel}`;
      navigate(`/categories/${periodsInHalf[0].id}?all_periods=${allPeriodIds}`, {
        state: {
          periodTitle: combinedTitle,
          rangeLabel,
          allPeriodIds: periodsInHalf.map((p) => p.id),
          isCombined: periodsInHalf.length > 1,
        },
      });
      return;
    }

    const userGrp = (user?.group || user?.group_name || '').trim().toUpperCase();
    const myPeriod = periodsInHalf.find(
      (p) => (p.group_name || '').trim().toUpperCase() === userGrp
    );
    if (myPeriod) {
      navigate(`/categories/${myPeriod.id}`, {
        state: { periodTitle: myPeriod.title },
      });
      return;
    }

    // Deduplicate periods by group_name
    const distinctDeptsMap = new Map();
    periodsInHalf.forEach((p) => {
      const key = (p.group_name || 'General').trim().toUpperCase();
      if (!distinctDeptsMap.has(key)) {
        distinctDeptsMap.set(key, p);
      }
    });
    const uniquePeriods = Array.from(distinctDeptsMap.values());

    if (uniquePeriods.length === 1) {
      navigate(`/categories/${uniquePeriods[0].id}`, {
        state: { periodTitle: uniquePeriods[0].title },
      });
    } else {
      setDeptSelectModal({
        rangeLabel,
        periods: uniquePeriods,
      });
    }
  };

  // On-demand click for empty / un-instantiated half slots
  const handleEmptyHalfClick = async (monthData, halfNum, rangeLabel) => {
    if (isEditor) return;

    const yr = monthData.year;
    const mo = monthData.monthIndex + 1;
    const padMo = String(mo).padStart(2, '0');
    const lastDay = monthData.lastDayOfMonth;
    const sDate = halfNum === 1 ? `${yr}-${padMo}-01` : `${yr}-${padMo}-16`;
    const eDate = halfNum === 1 ? `${yr}-${padMo}-15` : `${yr}-${padMo}-${String(lastDay).padStart(2, '0')}`;
    const slotKey = `${yr}-${mo}-${halfNum}`;

    setCreatingHalfKey(slotKey);

    try {
      if (isChUser) {
        if (!user?.center) {
          alert('Center information is missing for your account.');
          setCreatingHalfKey(null);
          return;
        }

        const res = await api.post(
          `/periods/ensure-half-center?center=${encodeURIComponent(user.center)}&start_date=${sDate}&end_date=${eDate}&created_by=${user.id}`
        );

        const ensuredPeriods = res.data || [];
        if (ensuredPeriods.length === 0) {
          alert('No departments found under your center to create periods.');
          setCreatingHalfKey(null);
          return;
        }

        const allPeriodIds = ensuredPeriods.map((p) => p.id).join(',');
        const combinedTitle = `${user.center} Combined — ${rangeLabel}`;

        // Update local periods state so the card immediately reflects the newly created periods
        setPeriods((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newToAdd = ensuredPeriods.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newToAdd];
        });

        navigate(`/categories/${ensuredPeriods[0].id}?all_periods=${allPeriodIds}`, {
          state: {
            periodTitle: combinedTitle,
            rangeLabel,
            allPeriodIds: ensuredPeriods.map((p) => p.id),
            isCombined: ensuredPeriods.length > 1,
          },
        });
      } else {
        const userGroup = user?.group || user?.group_name || '';
        if (!userGroup) {
          alert('Department/Group information is missing for your account.');
          setCreatingHalfKey(null);
          return;
        }

        const res = await api.post(
          `/periods/ensure-half?group_name=${encodeURIComponent(userGroup)}&start_date=${sDate}&end_date=${eDate}&created_by=${user.id}`
        );

        const period = res.data;
        if (!period || !period.id) {
          alert('Failed to initialize period.');
          setCreatingHalfKey(null);
          return;
        }

        // Update local periods state
        setPeriods((prev) => {
          if (prev.some((p) => p.id === period.id)) return prev;
          return [...prev, period];
        });

        navigate(`/categories/${period.id}`, {
          state: { periodTitle: period.title },
        });
      }
    } catch (err) {
      console.error('Failed to initialize half period:', err);
      alert(err.response?.data?.detail || 'Failed to open newsletter period.');
    } finally {
      setCreatingHalfKey(null);
    }
  };

  // Open Department Selection Modal to Download
  const handleHalfDownloadClick = (e, periodsInHalf, rangeLabel, monthData, halfNum) => {
    if (e) e.stopPropagation();
    if (!periodsInHalf || periodsInHalf.length === 0) return;

    if (isChUser || isEditor) {
      const targetCenter = isEditor ? selectedCenter : user?.center;
      const yr = monthData.year;
      const mo = monthData.monthIndex + 1;
      const padMo = String(mo).padStart(2, '0');
      const lastDay = monthData.lastDayOfMonth;
      const sDate = halfNum === 1 ? `${yr}-${padMo}-01` : `${yr}-${padMo}-16`;
      const eDate = halfNum === 1 ? `${yr}-${padMo}-15` : `${yr}-${padMo}-${String(lastDay).padStart(2, '0')}`;
      executeDownloadCombinedDocx({
        center: targetCenter,
        group_name: selectedGroup,
        start_date: sDate,
        end_date: eDate,
      });
      return;
    }

    const userGrp = (user?.group || user?.group_name || '').trim().toUpperCase();
    const myPeriod = periodsInHalf.find(
      (p) => (p.group_name || '').trim().toUpperCase() === userGrp
    );
    if (myPeriod) {
      handleOpenDownloadModal(e, myPeriod);
      return;
    }

    // Deduplicate by group_name
    const distinctDeptsMap = new Map();
    periodsInHalf.forEach((p) => {
      const key = (p.group_name || 'General').trim().toUpperCase();
      if (!distinctDeptsMap.has(key)) {
        distinctDeptsMap.set(key, p);
      }
    });
    const uniquePeriods = Array.from(distinctDeptsMap.values());

    if (uniquePeriods.length === 1) {
      handleOpenDownloadModal(e, uniquePeriods[0]);
    } else {
      setDownloadSelectModal({
        rangeLabel,
        monthData,
        halfNum,
        periods: uniquePeriods,
      });
    }
  };

  // Download for empty / un-instantiated half slots
  const handleEmptyHalfDownloadClick = async (e, monthData, halfNum, rangeLabel) => {
    if (e) e.stopPropagation();

    const yr = monthData.year;
    const mo = monthData.monthIndex + 1;
    const padMo = String(mo).padStart(2, '0');
    const lastDay = monthData.lastDayOfMonth;
    const sDate = halfNum === 1 ? `${yr}-${padMo}-01` : `${yr}-${padMo}-16`;
    const eDate = halfNum === 1 ? `${yr}-${padMo}-15` : `${yr}-${padMo}-${String(lastDay).padStart(2, '0')}`;

    if (isChUser || isEditor) {
      const targetCenter = isEditor ? selectedCenter : user?.center;
      executeDownloadCombinedDocx({
        center: targetCenter,
        group_name: selectedGroup,
        start_date: sDate,
        end_date: eDate,
      });
      return;
    }

    const userGroup = user?.group || user?.group_name || '';
    if (!userGroup) {
      alert('Department information missing.');
      return;
    }

    const slotKey = `dl-${yr}-${mo}-${halfNum}`;
    setDownloadingId(slotKey);
    try {
      const res = await api.post(
        `/periods/ensure-half?group_name=${encodeURIComponent(userGroup)}&start_date=${sDate}&end_date=${eDate}&created_by=${user.id}`
      );
      const p = res.data;
      if (p) {
        handleOpenDownloadModal(e, p);
      }
    } catch (err) {
      console.error('Failed to prepare period for download:', err);
      alert(err.response?.data?.detail || 'Failed to prepare download.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Render function for a Half Row inside a Month Card (strictly 1 row per half: H1 or H2)
  const renderHalfRow = (monthData, halfNum) => {
    const periodsInHalf = halfNum === 1 ? monthData.half1 : monthData.half2;
    const hasPeriods = Array.isArray(periodsInHalf) && periodsInHalf.length > 0;

    const yr = monthData.year;
    const mo = monthData.monthIndex + 1;
    const padMo = String(mo).padStart(2, '0');
    const startDay = halfNum === 1 ? 1 : 16;
    const endDay = halfNum === 1 ? 15 : monthData.lastDayOfMonth;
    const sDate = halfNum === 1 ? `${yr}-${padMo}-01` : `${yr}-${padMo}-16`;
    const eDate = halfNum === 1 ? `${yr}-${padMo}-15` : `${yr}-${padMo}-${String(endDay).padStart(2, '0')}`;
    const rangeLabel = `${monthData.monthAbbrev} ${startDay} – ${monthData.monthAbbrev} ${endDay}`;
    const cycleKey = `${sDate}_${eDate}`;

    // Look up published upload for this cycle
    const publishedUpload =
      publishedUploads[cycleKey] ||
      (hasPeriods ? periodsInHalf.find((p) => p.newsletter_upload)?.newsletter_upload : null);

    if (hasPeriods) {
      const allFinalized = periodsInHalf.every((p) => p.edit === false);
      const isAnyDownloading = periodsInHalf.some((p) => downloadingId === p.id);

      // Check if logged-in GH has a period in this half
      const userGrp = (user?.group || user?.group_name || '').trim().toUpperCase();
      const myGhPeriod = isGhUser
        ? periodsInHalf.find((p) => (p.group_name || '').trim().toUpperCase() === userGrp || !p.group_name)
        : null;

      const rowTooltip = isChUser
        ? `Period: ${rangeLabel}. Click to open entries from all departments.`
        : periodsInHalf.length > 1
          ? `${periodsInHalf.length} departments (${periodsInHalf.map((p) => p.group_name).filter(Boolean).join(', ')}). Click to select department.`
          : `Period: ${rangeLabel}${periodsInHalf[0]?.group_name ? ` (${periodsInHalf[0].group_name})` : ''}. Click to view.`;

      return (
        <div
          className={`half-row ${isEditor ? '' : 'clickable'}`}
          onClick={() => handleHalfRowClick(periodsInHalf, rangeLabel)}
          title={isEditor ? `Period: ${rangeLabel}` : rowTooltip}
          style={isEditor ? { cursor: 'default' } : {}}
        >
          {/* Left side: Badge + Clean Date Range */}
          <div className="half-left-meta">
            <div className="half-pill-badge">
              {halfNum === 1 ? 'H1' : 'H2'}
            </div>

            <div className="half-details">
              <span className="half-date-label" style={{ whiteSpace: 'nowrap' }}>
                {rangeLabel}
              </span>
            </div>
          </div>

          {/* Right side: Action Buttons */}
          <div className="half-actions-group">
            {/* Official Published PDF icon button (Visible when published by Editor, on LEFT side of Open status badge) */}
            {publishedUpload && (
              <button
                type="button"
                className="action-icon-btn pdf-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(publishedUpload.file_url, '_blank', 'noopener,noreferrer');
                }}
                title={`View published official newsletter PDF (${publishedUpload.title || publishedUpload.file_name})`}
                aria-label="View published PDF"
              >
                <IconFileText size={15} strokeWidth={2.2} />
              </button>
            )}

            {/* Status Badge: Open / Finalized (Always visible for non-editors, and for editors when finalized) */}
            {!isEditor ? (
              allFinalized ? (
                <span
                  className="status-badge-finalized"
                  title="Finalized (View-only for all users). Click to view categories."
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHalfRowClick(periodsInHalf, rangeLabel);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <IconLock size={12} />
                  <span>Finalized</span>
                </span>
              ) : (
                <span
                  className="status-badge-open"
                  title="Open for editing & submissions. Click to view categories."
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHalfRowClick(periodsInHalf, rangeLabel);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <IconCircleCheck size={12} />
                  <span>Open</span>
                </span>
              )
            ) : (
              allFinalized && (
                <span className="status-badge-finalized" title="Finalized">
                  <IconLock size={12} />
                  <span>Finalized</span>
                </span>
              )
            )}

            {/* GH Finalize Action Button (Group Head only) */}
            {myGhPeriod && myGhPeriod.edit !== false && (
              <button
                type="button"
                className="action-icon-btn finalize"
                onClick={(e) => {
                  e.stopPropagation();
                  setFinalizeModalPeriod(myGhPeriod);
                }}
                title="Finalize newsletter (Group Head only)"
                aria-label="Finalize newsletter"
              >
                <IconCheck size={15} strokeWidth={2.5} />
              </button>
            )}

            {/* GH Re-open (Unlock) Action Button */}
            {myGhPeriod && myGhPeriod.edit === false && (
              <button
                type="button"
                className="action-icon-btn reopen"
                onClick={(e) => {
                  e.stopPropagation();
                  setReopenModalPeriod(myGhPeriod);
                }}
                title="Re-open newsletter for editing"
                aria-label="Re-open newsletter"
                style={{
                  backgroundColor: '#fffbeb',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                }}
              >
                <IconLockOpen size={15} strokeWidth={2.4} />
              </button>
            )}

            {/* Download DOCX Button */}
            <button
              type="button"
              className="action-icon-btn download"
              onClick={(e) => handleHalfDownloadClick(e, periodsInHalf, rangeLabel, monthData, halfNum)}
              title={periodsInHalf.length > 1 ? 'Choose department to download (.docx)' : 'Download newsletter (.docx)'}
              disabled={isAnyDownloading}
              aria-label="Download newsletter docx"
            >
              {isAnyDownloading ? (
                <IconLoader2 size={15} className="animate-spin text-blue-600" />
              ) : (
                <IconDownload size={15} />
              )}
            </button>

            {/* View Chevron Link - Only for non-admin users */}
            {!isEditor && (
              <div
                className="chevron-arrow"
                onClick={() => handleHalfRowClick(periodsInHalf, rangeLabel)}
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
      const isCreating = creatingHalfKey === `${monthData.year}-${monthData.monthIndex + 1}-${halfNum}`;
      const isDownloading = downloadingId === `dl-${monthData.year}-${monthData.monthIndex + 1}-${halfNum}`;

      return (
        <div
          className={`half-row ${isEditor ? '' : 'clickable'}`}
          onClick={() => !isEditor && handleEmptyHalfClick(monthData, halfNum, rangeLabel)}
          title={isEditor ? `Period: ${rangeLabel}` : `Period: ${rangeLabel}. Click to open and add entries.`}
          style={isEditor ? { cursor: 'default' } : {}}
        >
          {/* Left side: Badge + Date Range */}
          <div className="half-left-meta">
            <div className="half-pill-badge">
              {halfNum === 1 ? 'H1' : 'H2'}
            </div>

            <div className="half-details">
              <span className="half-date-label" style={{ whiteSpace: 'nowrap' }}>
                {rangeLabel}
              </span>
            </div>
          </div>

          {/* Right side: Actions */}
          <div className="half-actions-group">
            {/* Official Published PDF icon button (if uploaded for this cycle, on LEFT of Open status badge) */}
            {publishedUpload && (
              <button
                type="button"
                className="action-icon-btn pdf-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(publishedUpload.file_url, '_blank', 'noopener,noreferrer');
                }}
                title={`View published official newsletter PDF (${publishedUpload.title || publishedUpload.file_name})`}
                aria-label="View published PDF"
              >
                <IconFileText size={15} strokeWidth={2.2} />
              </button>
            )}

            {/* Status Badge: Open (Only for Non-Editors, clickable to open and add entries) */}
            {!isEditor && (
              <span
                className="status-badge-open"
                title="Open for entries. Click to open."
                onClick={(e) => {
                  e.stopPropagation();
                  handleEmptyHalfClick(monthData, halfNum, rangeLabel);
                }}
                style={{ cursor: 'pointer' }}
              >
                <IconCircleCheck size={12} />
                <span>Open</span>
              </span>
            )}

            {/* Download DOCX Button */}
            <button
              type="button"
              className="action-icon-btn download"
              onClick={(e) => handleEmptyHalfDownloadClick(e, monthData, halfNum, rangeLabel)}
              title="Download newsletter (.docx)"
              disabled={isDownloading || isCreating}
              aria-label="Download newsletter docx"
            >
              {isDownloading ? (
                <IconLoader2 size={15} className="animate-spin text-blue-600" />
              ) : (
                <IconDownload size={15} />
              )}
            </button>

            {/* View Chevron Link - Only for non-admin users */}
            {!isEditor && (
              <div
                className="chevron-arrow"
                onClick={() => handleEmptyHalfClick(monthData, halfNum, rangeLabel)}
                title="Open period"
                role="button"
                tabIndex={0}
              >
                {isCreating ? (
                  <IconLoader2 size={16} className="animate-spin text-blue-600" />
                ) : (
                  <IconChevronRight size={18} />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  const activeYearForGrouping =
    selectedFilterYear ||
    (filterMode !== 'all' && filterMode && !isNaN(parseInt(filterMode, 10))
      ? filterMode
      : currentYearStr);

  const monthCardsList = groupPeriodsIntoMonthCards(
    periods,
    filterMode,
    activeYearForGrouping,
    selectedFilterMonth,
    yearSelectionType,
    selectedFromYear,
    selectedToYear
  );

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
            {isEditor ? (
              <span className="role-badge role-admin" style={{ padding: '3px 10px', fontSize: '0.78rem' }}>
                <IconShield size={14} />
                System Administrator
              </span>
            ) : isChUser ? (
              <span className="role-badge" style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '3px 10px', fontSize: '0.78rem' }}>
                <IconBuilding size={14} />
                Centre Head (CH) • {user.center || 'Center'}
              </span>
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

        {/* Live Overview Stats */}
        <div className="periods-stats-strip">

          {isEditor && (
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

          {isChUser && (
            <div className="stat-pill">
              <div className="stat-pill-icon blue" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <IconUsersGroup size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{centerGroups.length}</span>
                <span className="stat-pill-label">Departments</span>
              </div>
            </div>
          )}

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

      {/* 1.4 Unified Filter Toolbar (For All Roles) */}
      <div className="unified-filter-card">
        {/* Left: All Filter Capsules in One Clean Compact Row */}
        <div className="unified-filter-group">
          {/* Center Dropdown (Admin/Editor only) */}
          {isEditor && (
            <div className={`filter-capsule ${selectedCenter !== 'all' ? 'active-filter' : ''}`}>
              <span className="filter-capsule-label">
                <IconBuilding size={14} style={{ color: selectedCenter !== 'all' ? '#2563eb' : '#64748b' }} />
                Center
              </span>
              <select
                className="filter-capsule-select"
                value={selectedCenter}
                onChange={(e) => handleSelectCenter(e.target.value)}
                style={{ minWidth: '100px', maxWidth: '140px' }}
              >
                <option value="all">🌐 All Centers ({allCenters.length})</option>
                {allCenters.map((cName) => (
                  <option key={cName} value={cName}>
                    🏢 {cName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Department Filter (Admin & CH: Select dropdown) */}
          {(isEditor || isChUser) && (
            <div className={`filter-capsule ${selectedGroup !== 'all' ? 'active-filter' : ''}`}>
              <span className="filter-capsule-label">
                <IconUsersGroup size={14} style={{ color: selectedGroup !== 'all' ? '#2563eb' : '#64748b' }} />
                Dept{isChUser ? ` (${user?.center || 'Center'})` : ''}
              </span>
              <select
                className="filter-capsule-select"
                value={selectedGroup}
                onChange={(e) => {
                  const grp = e.target.value;
                  setSelectedGroup(grp);
                  const targetCenter = isEditor ? selectedCenter : user?.center;
                  fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, grp, targetCenter, yearSelectionType, selectedFromYear, selectedToYear);
                  fetchAvailableYears(grp, targetCenter);
                }}
                style={{ minWidth: '100px', maxWidth: '140px' }}
              >
                <option value="all">
                  📁 All Depts {centerGroups.length > 0 ? `(${centerGroups.length})` : ''}
                </option>
                {centerGroups.map((grp) => (
                  <option key={grp} value={grp}>
                    📁 {grp}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter Dropdown */}
          <div className={`filter-capsule ${selectedFilterCategory !== 'all' ? 'active-filter' : ''}`}>
            <span className="filter-capsule-label">
              <IconFileText size={14} style={{ color: selectedFilterCategory !== 'all' ? '#2563eb' : '#64748b' }} />
              Category
            </span>
            <select
              className="filter-capsule-select"
              value={selectedFilterCategory}
              onChange={(e) => setSelectedFilterCategory(e.target.value)}
              style={{ minWidth: '120px', maxWidth: '180px' }}
              title="Filter newsletter export by specific category (e.g., Training & Programs)"
            >
              <option value="all">📂 All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat.id || cat.name} value={cat.name}>
                  🏷️ {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Range: From & To */}
          <div className={`filter-capsule ${selectedFromYear !== currentYearStr || selectedToYear !== currentYearStr ? 'active-filter' : ''}`}>
            <span className="filter-capsule-label">
              <IconCalendarEvent size={14} style={{ color: selectedFromYear !== currentYearStr || selectedToYear !== currentYearStr ? '#2563eb' : '#64748b' }} />
              Years
            </span>
            <select
              className="filter-capsule-select"
              value={selectedFromYear}
              onChange={(e) => {
                const newFrom = e.target.value;
                setSelectedFromYear(newFrom);
                let newTo = selectedToYear;
                if (parseInt(newFrom, 10) > parseInt(selectedToYear, 10)) {
                  newTo = newFrom;
                  setSelectedToYear(newFrom);
                }
                const targetCenter = isEditor ? selectedCenter : user?.center;
                setYearSelectionType('range');
                setFilterMode('range');
                fetchPeriods('range', '', selectedFilterMonth, selectedGroup, targetCenter, 'range', String(newFrom), String(newTo));
              }}
              style={{ minWidth: '60px' }}
              title="From Year"
            >
              {allSelectableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>

            <span className="filter-range-separator">→</span>

            <select
              className="filter-capsule-select"
              value={selectedToYear}
              onChange={(e) => {
                const newTo = e.target.value;
                setSelectedToYear(newTo);
                let newFrom = selectedFromYear;
                if (parseInt(newTo, 10) < parseInt(selectedFromYear, 10)) {
                  newFrom = newTo;
                  setSelectedFromYear(newFrom);
                }
                const targetCenter = isEditor ? selectedCenter : user?.center;
                setYearSelectionType('range');
                setFilterMode('range');
                fetchPeriods('range', '', selectedFilterMonth, selectedGroup, targetCenter, 'range', String(newFrom), String(newTo));
              }}
              style={{ minWidth: '60px' }}
              title="To Year"
            >
              {toYearOptions.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Month Dropdown Filter */}
          <div className={`filter-capsule ${selectedFilterMonth ? 'active-filter' : ''}`}>
            <span className="filter-capsule-label">
              <IconCalendar size={14} style={{ color: selectedFilterMonth ? '#2563eb' : '#64748b' }} />
              Month
            </span>
            <select
              className="filter-capsule-select"
              value={selectedFilterMonth}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFilterMonth(val);
                if (!val) {
                  setSelectedFilterHalf('');
                }
                const targetCenter = isEditor ? selectedCenter : user?.center;
                fetchPeriods('range', '', val, selectedGroup, targetCenter, 'range', selectedFromYear, selectedToYear);
              }}
              style={{ minWidth: '95px' }}
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
          </div>

          {/* Half / Period Dropdown Filter */}
          <div
            className={`filter-capsule ${selectedFilterHalf ? 'active-filter' : ''}`}
            style={{ opacity: selectedFilterMonth ? 1 : 0.6 }}
          >
            <span className="filter-capsule-label">
              <IconClock size={14} style={{ color: selectedFilterHalf ? '#2563eb' : selectedFilterMonth ? '#64748b' : '#94a3b8' }} />
              Half
            </span>
            <select
              className="filter-capsule-select"
              value={selectedFilterHalf}
              disabled={!selectedFilterMonth}
              onChange={(e) => {
                setSelectedFilterHalf(e.target.value);
              }}
              style={{ minWidth: '95px' }}
              title={!selectedFilterMonth ? 'Select a month first to filter by half' : 'Select specific half period'}
            >
              <option value="">Both Halves</option>
              <option value="1">1st Half (1–15)</option>
              <option value="2">2nd Half (16–End)</option>
            </select>
          </div>
        </div>

        {/* Right: Actions (Reset & Download DOCX) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: 'auto' }}>
          {/* Reset Filter Button */}
          {(selectedCenter !== (isEditor ? 'all' : user?.center || 'all') || selectedGroup !== 'all' || selectedFilterCategory !== 'all' || selectedFromYear !== currentYearStr || selectedToYear !== currentYearStr || selectedFilterMonth || selectedFilterHalf || filterMode !== 'range') && (
            <button
              type="button"
              className="filter-clear-btn"
              onClick={handleResetAllFilters}
              title="Reset all filters to defaults"
            >
              <IconRotateClockwise size={13} />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            className="filter-export-btn"
            disabled={downloadingCombined}
            onClick={() => {
              const userDept = user?.group || user?.group_name || '';
              const grp = (!isEditor && !isChUser && userDept) ? userDept : (selectedGroup || 'all');
              const ctr = isEditor ? selectedCenter : (user?.center || 'all');
              const cat = selectedFilterCategory !== 'all' ? selectedFilterCategory : null;
              const mo = selectedFilterMonth ? parseInt(selectedFilterMonth, 10) : null;

              if (yearSelectionType === 'all' || filterMode === 'all') {
                executeDownloadCombinedDocx({
                  center: ctr,
                  group_name: grp,
                  category: cat,
                  all_years: true,
                  month: mo,
                });
              } else {
                const minY = Math.min(parseInt(selectedFromYear, 10), parseInt(selectedToYear, 10));
                const maxY = Math.max(parseInt(selectedFromYear, 10), parseInt(selectedToYear, 10));

                if (minY === maxY && mo && selectedFilterHalf) {
                  const padMo = String(mo).padStart(2, '0');
                  if (selectedFilterHalf === '1') {
                    const sDate = `${minY}-${padMo}-01`;
                    const eDate = `${minY}-${padMo}-15`;
                    executeDownloadCombinedDocx({
                      center: ctr,
                      group_name: grp,
                      category: cat,
                      start_date: sDate,
                      end_date: eDate,
                    });
                  } else if (selectedFilterHalf === '2') {
                    const lastDay = new Date(minY, mo, 0).getDate();
                    const sDate = `${minY}-${padMo}-16`;
                    const eDate = `${minY}-${padMo}-${String(lastDay).padStart(2, '0')}`;
                    executeDownloadCombinedDocx({
                      center: ctr,
                      group_name: grp,
                      category: cat,
                      start_date: sDate,
                      end_date: eDate,
                    });
                  }
                } else {
                  executeDownloadCombinedDocx({
                    center: ctr,
                    group_name: grp,
                    category: cat,
                    from_year: minY,
                    to_year: maxY,
                    month: mo,
                  });
                }
              }
            }}
            title={
              selectedFilterCategory !== 'all'
                ? `Download newsletter (.docx) for category: ${selectedFilterCategory}`
                : (!isEditor && !isChUser)
                  ? `Download newsletter (.docx) for ${user?.group || user?.group_name || 'Department'}`
                  : `Download newsletter (.docx) based on active filters`
            }
          >
            {downloadingCombined ? (
              <>
                <IconLoader2 size={15} className="animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <IconDownload size={15} strokeWidth={2.2} />
                <span>Download (.docx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1.6 Interactive Breadcrumb & 1-Click Back Navigation Strip */}
      {isEditor && (selectedCenter !== 'all' || selectedGroup !== 'all') && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          {/* Left: Interactive Breadcrumb Path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.84rem' }}>
            <button
              type="button"
              onClick={() => handleSelectCenter('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: 'none',
                color: selectedCenter === 'all' ? '#0f172a' : '#2563eb',
                fontWeight: selectedCenter === 'all' ? '700' : '600',
                cursor: selectedCenter === 'all' ? 'default' : 'pointer',
                padding: '3px 6px',
                borderRadius: '6px',
              }}
              title="Return to Centers Directory"
            >
              <IconHome size={15} />
              <span>Centers</span>
            </button>
            <IconChevronRight size={14} style={{ color: '#94a3b8' }} />

            {selectedCenter !== 'all' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedGroup !== 'all') {
                      setSelectedGroup('all');
                      fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, 'all', selectedCenter);
                      fetchAvailableYears('all', selectedCenter);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'none',
                    border: 'none',
                    color: selectedGroup === 'all' ? '#0f172a' : '#2563eb',
                    fontWeight: selectedGroup === 'all' ? '700' : '600',
                    cursor: selectedGroup === 'all' ? 'default' : 'pointer',
                    padding: '3px 6px',
                    borderRadius: '6px',
                  }}
                  title={selectedGroup !== 'all' ? `View all ${selectedCenter} departments` : ''}
                >
                  <IconBuilding size={15} />
                  <span>{selectedCenter} Center</span>
                </button>
                {selectedGroup !== 'all' && (
                  <IconChevronRight size={14} style={{ color: '#94a3b8' }} />
                )}
              </>
            )}

            {selectedGroup !== 'all' && (
              <span style={{ fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <IconFolder size={15} style={{ color: '#2563eb' }} />
                <span>{selectedGroup} Department</span>
              </span>
            )}
          </div>

          {/* Right: Quick 1-Click Back Button */}
          <div>
            {selectedGroup !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedGroup('all');
                  fetchPeriods(filterMode, selectedFilterYear, selectedFilterMonth, 'all', selectedCenter);
                  fetchAvailableYears('all', selectedCenter);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                  e.currentTarget.style.borderColor = '#93c5fd';
                  e.currentTarget.style.color = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title={`Back to ${selectedCenter} department list`}
              >
                <IconArrowLeft size={15} />
                <span>Back to {selectedCenter !== 'all' ? `${selectedCenter} ` : ''}Departments</span>
              </button>
            ) : selectedCenter !== 'all' ? (
              <button
                type="button"
                onClick={() => handleSelectCenter('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                  e.currentTarget.style.borderColor = '#93c5fd';
                  e.currentTarget.style.color = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                }}
                title="Back to Centers Directory"
              >
                <IconArrowLeft size={15} />
                <span>Back to Centers</span>
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* 2. Control & Filter Panel */}
      <div className="periods-control-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        {/* Quick Year Pill Selectors */}
        <div className="periods-quick-years" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="quick-year-label">Select Year:</span>

          {topThreeYears.map((yr) => {
            const isSelected =
              filterMode !== 'all' &&
              selectedFromYear === String(yr) &&
              selectedToYear === String(yr);
            return (
              <button
                key={yr}
                type="button"
                className={`year-tab-btn ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setYearSelectionType('range');
                  setSelectedFromYear(String(yr));
                  setSelectedToYear(String(yr));
                  setSelectedFilterMonth('');
                  setSelectedFilterHalf('');
                  setFilterMode('range');
                  fetchPeriods('range', '', '', selectedGroup, isEditor ? selectedCenter : user?.center, 'range', String(yr), String(yr));
                }}
              >
                <span>{yr}</span>
              </button>
            );
          })}

          {/* More Years Dropdown Selector */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className={`year-tab-btn ${moreYearsList.includes(parseInt(selectedFromYear, 10)) && selectedFromYear === selectedToYear && filterMode !== 'all' ? 'active' : ''}`}
              value={
                moreYearsList.includes(parseInt(selectedFromYear, 10)) && selectedFromYear === selectedToYear && filterMode !== 'all'
                  ? String(selectedFromYear)
                  : ''
              }
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                setYearSelectionType('range');
                setSelectedFromYear(val);
                setSelectedToYear(val);
                setSelectedFilterMonth('');
                setSelectedFilterHalf('');
                setFilterMode('range');
                fetchPeriods('range', '', '', selectedGroup, isEditor ? selectedCenter : user?.center, 'range', val, val);
              }}
              style={{
                cursor: 'pointer',
                outline: 'none',
                appearance: 'auto',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: '600',
              }}
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#64748b' }}>
                {moreYearsList.includes(parseInt(selectedFromYear, 10)) && selectedFromYear === selectedToYear && filterMode !== 'all'
                  ? `Year: ${selectedFromYear}`
                  : 'More Years...'}
              </option>
              {moreYearsList.map((yr) => (
                <option key={yr} value={yr} style={{ backgroundColor: '#ffffff', color: '#1e293b' }}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Central Upload PDF Button (Editor Only) */}
        {isEditor && (
          <button
            type="button"
            className="editor-calendar-portal-btn"
            onClick={() => {
              setCalendarSelectedYear(selectedFilterYear || currentYearStr);
              const moNum = selectedFilterMonth ? parseInt(selectedFilterMonth, 10) - 1 : new Date().getMonth();
              setSelectedCalendarMonthIndex(moNum >= 0 && moNum <= 11 ? moNum : new Date().getMonth());
              setShowPublicationCalendarModal(true);
            }}
            title="Upload and manage published newsletter PDFs"
          >
            <IconUpload size={15} strokeWidth={2.4} />
            <span>Upload PDF</span>
          </button>
        )}
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
      ) : (new Set(monthCardsList.map(m => m.year)).size > 1) ? (
        /* Multi-Year Grouped View with Year Section Headers */
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
                  {monthsByYear[yr].map((monthData) => {
                    const blockClass = getMonthBlockClass(monthData.monthIndex);
                    return (
                      <div key={monthData.yearMonthStr} className={`month-card ${blockClass}`}>
                        <div className="month-card-header">
                          <h4 className="month-card-title">
                            <IconCalendarEvent size={18} className="month-card-icon" />
                            <span>{monthData.monthName}</span>
                          </h4>
                        </div>

                        <div className="month-card-body">
                          {(!selectedFilterHalf || selectedFilterHalf === '1') && renderHalfRow(monthData, 1)}
                          {!selectedFilterHalf && <div className="row-separator" />}
                          {(!selectedFilterHalf || selectedFilterHalf === '2') && renderHalfRow(monthData, 2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      ) : (
        /* Standard Month Cards Grid (Single Department / Specific Filtered View) */
        <div className="month-cards-grid">
          {monthCardsList.map((monthData) => {
            const blockClass = getMonthBlockClass(monthData.monthIndex);
            return (
              <div key={monthData.yearMonthStr} className={`month-card ${blockClass}`}>
                <div className="month-card-header">
                  <h4 className="month-card-title">
                    <IconCalendarEvent size={18} className="month-card-icon" />
                    <span>{monthData.monthName}</span>
                  </h4>
                </div>

                <div className="month-card-body">
                  {(!selectedFilterHalf || selectedFilterHalf === '1') && renderHalfRow(monthData, 1)}
                  {!selectedFilterHalf && <div className="row-separator" />}
                  {(!selectedFilterHalf || selectedFilterHalf === '2') && renderHalfRow(monthData, 2)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Department Selection Modal to View Categories */}
      {deptSelectModal && (
        <div
          className="modal-backdrop"
          onClick={() => setDeptSelectModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 32px -4px rgba(0,0,0,0.18)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              animation: 'profilePopIn 0.16s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
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
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconUsersGroup size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: '#0f172a' }}>
                    Select Department to Open
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {deptSelectModal.rangeLabel}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeptSelectModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Modal Body: List of Departments */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
              {deptSelectModal.periods.map((period) => {
                const isFinalized = period.edit === false;
                const pCenter = (period.center || (isEditor ? selectedCenter : user?.center) || '').trim().toUpperCase();
                const pDept = (period.group_name || '').trim().toUpperCase();
                const ghUser = (pCenter && pCenter !== 'ALL')
                  ? (ghMapByGroup[`${pCenter}_${pDept}`] || ghMapByGroup[pDept])
                  : ghMapByGroup[pDept];
                const userGrp = (user?.group || user?.group_name || '').trim().toUpperCase();
                const ghName = ghUser?.name?.trim() || (isGhUser && userGrp === pDept ? user.name?.trim() : '');

                return (
                  <div
                    key={period.id}
                    onClick={() => {
                      setDeptSelectModal(null);
                      navigate(`/categories/${period.id}`, {
                        state: { periodTitle: period.title },
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = '#93c5fd';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconBuilding size={16} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>
                          {period.group_name || 'General'}
                        </h4>
                        {ghName && (
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            Group Head: {ghName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isFinalized ? (
                        <span className="status-badge-finalized" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                          <IconLock size={11} />
                          <span>Finalized</span>
                        </span>
                      ) : (
                        <span className="status-badge-open" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                          <IconCircleCheck size={11} />
                          <span>Open</span>
                        </span>
                      )}
                      <IconChevronRight size={16} style={{ color: '#2563eb' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Department Selection Modal to Download */}
      {downloadSelectModal && (
        <div
          className="modal-backdrop"
          onClick={() => setDownloadSelectModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
              boxShadow: '0 20px 32px -4px rgba(0,0,0,0.18)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              animation: 'profilePopIn 0.16s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
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
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconDownload size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: '#0f172a' }}>
                    Select Department to Download
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {downloadSelectModal.rangeLabel}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDownloadSelectModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Modal Body: List of Department Download Options */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
              {downloadSelectModal.periods.map((period) => {
                const pCenter = (period.center || (isEditor ? selectedCenter : user?.center) || '').trim().toUpperCase();
                const pDept = (period.group_name || '').trim().toUpperCase();
                const ghUser = (pCenter && pCenter !== 'ALL')
                  ? (ghMapByGroup[`${pCenter}_${pDept}`] || ghMapByGroup[pDept])
                  : ghMapByGroup[pDept];
                const userGrp = (user?.group || user?.group_name || '').trim().toUpperCase();
                const ghName = ghUser?.name?.trim() || (isGhUser && userGrp === pDept ? user.name?.trim() : '');

                return (
                  <div
                    key={period.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconBuilding size={16} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>
                          {period.group_name || 'General'}
                        </h4>
                        {ghName && (
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            Group Head: {ghName}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        setDownloadSelectModal(null);
                        handleOpenDownloadModal(e, period);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                        e.currentTarget.style.color = '#1d4ed8';
                      }}
                    >
                      <IconDownload size={14} />
                      <span>Download</span>
                    </button>
                  </div>
                );
              })}

              {/* Combined Center Download Option */}
              {(isEditor || isChUser) && downloadSelectModal.periods.length > 1 && (
                <div
                  style={{
                    marginTop: '6px',
                    paddingTop: '12px',
                    borderTop: '1px dashed #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.84rem', color: '#0f172a' }}>
                      All Departments (Combined)
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Merge all departments into a single .docx document
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const targetCenter = isEditor ? selectedCenter : user?.center;
                      const yr = downloadSelectModal.monthData.year;
                      const mo = downloadSelectModal.monthData.monthIndex + 1;
                      const padMo = String(mo).padStart(2, '0');
                      const lastDay = downloadSelectModal.monthData.lastDayOfMonth;
                      const sDate = downloadSelectModal.halfNum === 1 ? `${yr}-${padMo}-01` : `${yr}-${padMo}-16`;
                      const eDate = downloadSelectModal.halfNum === 1 ? `${yr}-${padMo}-15` : `${yr}-${padMo}-${String(lastDay).padStart(2, '0')}`;
                      setDownloadSelectModal(null);
                      executeDownloadCombinedDocx({
                        center: targetCenter,
                        group_name: 'all',
                        start_date: sDate,
                        end_date: eDate,
                      });
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
                      flexShrink: 0,
                    }}
                  >
                    <IconDownload size={14} strokeWidth={2.2} />
                    <span>Download Combined</span>
                  </button>
                </div>
              )}
            </div>
          </div>
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
              {/* <p
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
              </p> */}
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

      {/* Re-open / Unlock Period Modal (for GH / Admin) */}
      {reopenModalPeriod && (
        <div
          className="modal-backdrop"
          onClick={() => !submittingReopen && setReopenModalPeriod(null)}
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
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                  }}
                >
                  <IconLockOpen size={19} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: '700' }}>
                    Re-open Newsletter
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                    Unlock edition for submissions & editing
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !submittingReopen && setReopenModalPeriod(null)}
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
              <p
                style={{
                  margin: '0 0 14px 0',
                  color: '#334155',
                  fontSize: '0.92rem',
                  lineHeight: '1.5',
                }}
              >
                Are you sure you want to re-open{' '}
                <strong style={{ color: '#0f172a' }}>{reopenModalPeriod.title}</strong>?
              </p>
              <p
                style={{
                  margin: 0,
                  color: '#b45309',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  lineHeight: '1.4',
                }}
              >
                🔓 Re-opening will unlock the period, allowing team members to add and edit entries again.
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
                onClick={() => setReopenModalPeriod(null)}
                disabled={submittingReopen}
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
                onClick={handleConfirmReopen}
                disabled={submittingReopen}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  backgroundColor: '#d97706',
                  border: 'none',
                  color: '#ffffff',
                  cursor: submittingReopen ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
                  opacity: submittingReopen ? 0.75 : 1,
                }}
              >
                {submittingReopen ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Re-opening...</span>
                  </>
                ) : (
                  <>
                    <IconLockOpen size={16} />
                    <span>Confirm Re-open</span>
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
                    Download Newsletter (.docx)
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Export newsletter document
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
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Center Selector (if Admin) */}
              {isEditor && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                    Center:
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
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.86rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Centers</option>
                    {allCenters.map((cName) => (
                      <option key={cName} value={cName}>
                        {cName} Center
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Department Selector (if single center is selected or CH) */}
              {(!isEditor || selectedCombinedCenter !== 'all') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                    Department:
                  </label>
                  <select
                    value={selectedCombinedGroup}
                    onChange={(e) => setSelectedCombinedGroup(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.86rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Departments</option>
                    {centerGroups.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Year & Month Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '5px' }}>
                    Year:
                  </label>
                  <select
                    value={selectedCombinedYear}
                    onChange={(e) => setSelectedCombinedYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                    }}
                  >
                    {allSelectableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '5px' }}>
                    Month:
                  </label>
                  <select
                    value={selectedCombinedMonth}
                    onChange={(e) => setSelectedCombinedMonth(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
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

              {/* Edition Selector */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  Period:
                </label>
                {(() => {
                  const yrNum = parseInt(selectedCombinedYear || currentYearStr, 10);
                  const moNum = parseInt(selectedCombinedMonth || String(new Date().getMonth() + 1), 10);
                  const lastDay = new Date(yrNum, moNum, 0).getDate();

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setCombinedScope('h1')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          border: combinedScope === 'h1' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'h1' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'h1' ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        1st Half (1 – 15)
                      </button>

                      <button
                        type="button"
                        onClick={() => setCombinedScope('h2')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          border: combinedScope === 'h2' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'h2' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'h2' ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        2nd Half (16 – {lastDay})
                      </button>

                      <button
                        type="button"
                        onClick={() => setCombinedScope('month')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          border: combinedScope === 'month' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'month' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'month' ? '#1d4ed8' : '#334155',
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
                          fontWeight: '600',
                          border: combinedScope === 'year' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: combinedScope === 'year' ? '#eff6ff' : '#ffffff',
                          color: combinedScope === 'year' ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Full Year
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
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
                  padding: '7px 16px',
                  fontSize: '0.84rem',
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
                  padding: '8px 18px',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: downloadingCombined ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                  opacity: downloadingCombined ? 0.75 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {downloadingCombined ? (
                  <>
                    <IconLoader2 size={15} className="animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <IconDownload size={15} />
                    <span>Download (.docx)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4.5. Master-Detail 12-Month Publication Calendar / Timetable Modal (Editor Only) */}
      {showPublicationCalendarModal && (() => {
        const currentSelectedMonth = calendarMonthsData[selectedCalendarMonthIndex] || calendarMonthsData[0];
        const totalYearUploads = calendarMonthsData.reduce((acc, m) => acc + m.publishedCount, 0);

        return (
          <div
            className="modal-backdrop"
            onClick={() => setShowPublicationCalendarModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9990,
              padding: '16px',
            }}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                maxWidth: '1200px',
                width: '100%',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                animation: 'profilePopIn 0.2s ease-out',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {/* Title & Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #dbeafe',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconCalendarEvent size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.01em' }}>
                      Newsletter Timetable &amp; Calendar
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Manage and upload monthly editions.
                    </span>
                  </div>
                </div>

                {/* Year Switcher inside Modal + Close Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#f1f5f9',
                      padding: '3px 6px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', padding: '0 4px' }}>Year:</span>
                    {topThreeYears.map((yr) => {
                      const isSelected = String(yr) === String(calendarSelectedYear);
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setCalendarSelectedYear(String(yr))}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '7px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? '700' : '600',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#ffffff' : 'transparent',
                            color: isSelected ? '#2563eb' : '#64748b',
                            boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {yr}
                        </button>
                      );
                    })}
                    <select
                      value={moreYearsList.includes(parseInt(calendarSelectedYear, 10)) ? calendarSelectedYear : ''}
                      onChange={(e) => e.target.value && setCalendarSelectedYear(e.target.value)}
                      style={{
                        background: moreYearsList.includes(parseInt(calendarSelectedYear, 10)) ? '#ffffff' : 'transparent',
                        color: moreYearsList.includes(parseInt(calendarSelectedYear, 10)) ? '#2563eb' : '#64748b',
                        border: '1px solid transparent',
                        padding: '3px 6px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="" disabled style={{ color: '#94a3b8', background: '#ffffff' }}>
                        More...
                      </option>
                      {moreYearsList.map((yr) => (
                        <option key={yr} value={yr} style={{ color: '#1e293b', background: '#ffffff' }}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPublicationCalendarModal(false)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '6px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.color = '#0f172a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.color = '#64748b';
                    }}
                    title="Close Calendar"
                  >
                    <IconX size={18} />
                  </button>
                </div>
              </div>

              {/* Master-Detail Split Body */}
              <div className="calendar-split-container">
                {/* Left Column: Month List (3 Columns x 4 Rows) */}
                <div className="calendar-split-left">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                      Month List
                    </h4>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '9999px' }}>
                      12 Months
                    </span>
                  </div>

                  <div className="calendar-month-grid-3col">
                    {calendarMonthsData.map((m) => {
                      const isSelected = selectedCalendarMonthIndex === m.index;
                      const blockClass = getMonthBlockClass(m.index);
                      const hasBoth = m.h1.upload && m.h2.upload;
                      const hasAny = m.h1.upload || m.h2.upload;

                      return (
                        <div
                          key={m.index}
                          className={`calendar-month-tile ${blockClass} ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedCalendarMonthIndex(m.index)}
                        >
                          {/* Month Header */}
                          <div className="calendar-month-tile-header">
                            <span className="calendar-month-tile-name">
                              <IconCalendarEvent size={15} style={{ color: isSelected ? '#2563eb' : '#64748b' }} />
                              <span>{m.name}</span>
                            </span>

                            {hasBoth ? (
                              <span
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  backgroundColor: '#ecfdf5',
                                  border: '1px solid #a7f3d0',
                                  color: '#059669',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Both H1 and H2 uploaded"
                              >
                                <IconCheck size={11} strokeWidth={3} />
                              </span>
                            ) : hasAny ? (
                              <span
                                style={{
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '50%',
                                  backgroundColor: '#10b981',
                                }}
                                title="1 of 2 uploaded"
                              />
                            ) : null}
                          </div>

                          {/* 2 Sub-lines for H1 and H2 */}
                          <div className="calendar-month-tile-body">
                            {/* H1 line */}
                            <div className="calendar-status-line">
                              <span className={`calendar-status-dot ${m.h1.upload ? 'green' : 'gray'}`} />
                              <span style={{ color: m.h1.upload ? '#059669' : '#94a3b8', fontWeight: m.h1.upload ? '700' : '500' }}>
                                {m.h1.upload ? '✓ H1' : 'H1 · Empty'}
                              </span>
                            </div>

                            {/* H2 line */}
                            <div className="calendar-status-line">
                              <span className={`calendar-status-dot ${m.h2.upload ? 'green' : 'gray'}`} />
                              <span style={{ color: m.h2.upload ? '#059669' : '#94a3b8', fontWeight: m.h2.upload ? '700' : '500' }}>
                                {m.h2.upload ? '✓ H2' : 'H2 · Empty'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Detail View for Selected Month */}
                <div className="calendar-split-right">
                  <div style={{ fontSize: '0.76rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Detail View
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', margin: '2px 0 18px 0' }}>
                    {currentSelectedMonth.fullName} {currentSelectedMonth.year}
                  </h2>

                  {/* H1 Section (01 – 15) */}
                  <div className="calendar-detail-section">
                    <input
                      id="h1-direct-file-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleDirectPdfUpload(
                            e.target.files[0],
                            currentSelectedMonth.h1.startDate,
                            currentSelectedMonth.h1.endDate,
                            currentSelectedMonth.h1.label,
                            currentSelectedMonth.h1.upload
                          );
                          e.target.value = '';
                        }
                      }}
                    />

                    <div className="calendar-detail-section-header">
                      <div className="calendar-detail-section-title">
                        <span className="calendar-slot-badge">H1</span>
                        <span className="calendar-slot-date-label">
                          {currentSelectedMonth.name} 01 – 15, {currentSelectedMonth.year}
                        </span>
                      </div>

                      {uploadingSlotKey === `${currentSelectedMonth.h1.startDate}_${currentSelectedMonth.h1.endDate}` ? (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: '700',
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <IconLoader2 size={13} className="animate-spin" /> Uploading...
                        </span>
                      ) : currentSelectedMonth.h1.upload ? (
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: '700',
                            color: '#059669',
                            backgroundColor: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Published PDF Present"
                        >
                          <IconCheck size={12} strokeWidth={3} /> Published
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            color: '#64748b',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                          }}
                        >
                          Not Uploaded
                        </span>
                      )}
                    </div>

                    {uploadingSlotKey === `${currentSelectedMonth.h1.startDate}_${currentSelectedMonth.h1.endDate}` ? (
                      <div
                        className="calendar-doc-card"
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          padding: '24px',
                          backgroundColor: '#eff6ff',
                          border: '1.5px dashed #3b82f6',
                        }}
                      >
                        <IconLoader2 size={22} className="animate-spin" style={{ color: '#2563eb' }} />
                        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1d4ed8' }}>
                          Uploading &amp; Publishing Newsletter PDF...
                        </span>
                      </div>
                    ) : currentSelectedMonth.h1.upload ? (
                      <div className="calendar-doc-card">
                        <div className="calendar-doc-row">
                          <div className="calendar-doc-icon-box">
                            <IconFileText size={22} strokeWidth={1.8} />
                            <span style={{ fontSize: '0.58rem', fontWeight: '800', color: '#dc2626', marginTop: '1px' }}>PDF</span>
                          </div>
                          <div className="calendar-doc-info">
                            <div className="calendar-doc-title">
                              {currentSelectedMonth.h1.upload.title || currentSelectedMonth.h1.upload.file_name}
                            </div>
                            <div className="calendar-doc-meta">
                              <span>Official Published Edition • {currentSelectedMonth.name} 01–15</span>
                            </div>
                          </div>
                        </div>

                        <div className="calendar-doc-actions">
                          <button
                            type="button"
                            onClick={() => window.open(currentSelectedMonth.h1.upload.file_url, '_blank', 'noopener,noreferrer')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #bfdbfe',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                          >
                            <IconFileText size={14} />
                            <span>View PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => document.getElementById('h1-direct-file-input')?.click()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            <IconUpload size={14} />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletePdfModal({
                              isOpen: true,
                              uploadId: currentSelectedMonth.h1.upload.id,
                              title: currentSelectedMonth.h1.upload.title || currentSelectedMonth.h1.upload.file_name,
                              isDeleting: false,
                            })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #fecdd3',
                              backgroundColor: '#fff1f2',
                              color: '#e11d48',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            <IconTrash size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`calendar-dropzone-box ${dragOverSlotKey === `${currentSelectedMonth.h1.startDate}_${currentSelectedMonth.h1.endDate}` ? 'dragover' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlotKey(`${currentSelectedMonth.h1.startDate}_${currentSelectedMonth.h1.endDate}`);
                        }}
                        onDragLeave={() => setDragOverSlotKey(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSlotKey(null);
                          if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                            handleDirectPdfUpload(
                              e.dataTransfer.files[0],
                              currentSelectedMonth.h1.startDate,
                              currentSelectedMonth.h1.endDate,
                              currentSelectedMonth.h1.label,
                              null
                            );
                          }
                        }}
                        onClick={() => document.getElementById('h1-direct-file-input')?.click()}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconUpload size={18} strokeWidth={2.2} />
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1e293b' }}>
                          + Drag &amp; drop or Browse PDF
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                          Click to upload PDF edition for {currentSelectedMonth.name} 01 – 15
                        </span>
                      </div>
                    )}
                  </div>

                  {/* H2 Section (16 – End) */}
                  <div className="calendar-detail-section">
                    <input
                      id="h2-direct-file-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleDirectPdfUpload(
                            e.target.files[0],
                            currentSelectedMonth.h2.startDate,
                            currentSelectedMonth.h2.endDate,
                            currentSelectedMonth.h2.label,
                            currentSelectedMonth.h2.upload
                          );
                          e.target.value = '';
                        }
                      }}
                    />

                    <div className="calendar-detail-section-header">
                      <div className="calendar-detail-section-title">
                        <span className="calendar-slot-badge">H2</span>
                        <span className="calendar-slot-date-label">
                          {currentSelectedMonth.name} 16 – {currentSelectedMonth.lastDay}, {currentSelectedMonth.year}
                        </span>
                      </div>

                      {uploadingSlotKey === `${currentSelectedMonth.h2.startDate}_${currentSelectedMonth.h2.endDate}` ? (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: '700',
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <IconLoader2 size={13} className="animate-spin" /> Uploading...
                        </span>
                      ) : currentSelectedMonth.h2.upload ? (
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: '700',
                            color: '#059669',
                            backgroundColor: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Published PDF Present"
                        >
                          <IconCheck size={12} strokeWidth={3} /> Published
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            color: '#64748b',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                          }}
                        >
                          Not Uploaded
                        </span>
                      )}
                    </div>

                    {uploadingSlotKey === `${currentSelectedMonth.h2.startDate}_${currentSelectedMonth.h2.endDate}` ? (
                      <div
                        className="calendar-doc-card"
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          padding: '24px',
                          backgroundColor: '#eff6ff',
                          border: '1.5px dashed #3b82f6',
                        }}
                      >
                        <IconLoader2 size={22} className="animate-spin" style={{ color: '#2563eb' }} />
                        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1d4ed8' }}>
                          Uploading &amp; Publishing Newsletter PDF...
                        </span>
                      </div>
                    ) : currentSelectedMonth.h2.upload ? (
                      <div className="calendar-doc-card">
                        <div className="calendar-doc-row">
                          <div className="calendar-doc-icon-box">
                            <IconFileText size={22} strokeWidth={1.8} />
                            <span style={{ fontSize: '0.58rem', fontWeight: '800', color: '#dc2626', marginTop: '1px' }}>PDF</span>
                          </div>
                          <div className="calendar-doc-info">
                            <div className="calendar-doc-title">
                              {currentSelectedMonth.h2.upload.title || currentSelectedMonth.h2.upload.file_name}
                            </div>
                            <div className="calendar-doc-meta">
                              <span>Official Published Edition • {currentSelectedMonth.name} 16–{currentSelectedMonth.lastDay}</span>
                            </div>
                          </div>
                        </div>

                        <div className="calendar-doc-actions">
                          <button
                            type="button"
                            onClick={() => window.open(currentSelectedMonth.h2.upload.file_url, '_blank', 'noopener,noreferrer')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #bfdbfe',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                          >
                            <IconFileText size={14} />
                            <span>View PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => document.getElementById('h2-direct-file-input')?.click()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            <IconUpload size={14} />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletePdfModal({
                              isOpen: true,
                              uploadId: currentSelectedMonth.h2.upload.id,
                              title: currentSelectedMonth.h2.upload.title || currentSelectedMonth.h2.upload.file_name,
                              isDeleting: false,
                            })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #fecdd3',
                              backgroundColor: '#fff1f2',
                              color: '#e11d48',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            <IconTrash size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`calendar-dropzone-box ${dragOverSlotKey === `${currentSelectedMonth.h2.startDate}_${currentSelectedMonth.h2.endDate}` ? 'dragover' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlotKey(`${currentSelectedMonth.h2.startDate}_${currentSelectedMonth.h2.endDate}`);
                        }}
                        onDragLeave={() => setDragOverSlotKey(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSlotKey(null);
                          if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                            handleDirectPdfUpload(
                              e.dataTransfer.files[0],
                              currentSelectedMonth.h2.startDate,
                              currentSelectedMonth.h2.endDate,
                              currentSelectedMonth.h2.label,
                              null
                            );
                          }
                        }}
                        onClick={() => document.getElementById('h2-direct-file-input')?.click()}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconUpload size={18} strokeWidth={2.2} />
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1e293b' }}>
                          + Drag &amp; drop or Browse PDF
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                          Click to upload PDF edition for {currentSelectedMonth.name} 16 – {currentSelectedMonth.lastDay}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '12px 24px',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#64748b' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: totalYearUploads > 0 ? '#10b981' : '#cbd5e1',
                    }}
                  />
                  <span>
                    Year <strong>{calendarSelectedYear}</strong>: <strong>{totalYearUploads} of 24</strong> bi-monthly editions published
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPublicationCalendarModal(false)}
                  style={{
                    padding: '7px 22px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. Delete Published PDF Confirmation Modal */}
      {deletePdfModal.isOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !deletePdfModal.isDeleting && setDeletePdfModal({ isOpen: false, uploadId: null, title: '', isDeleting: false })}
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
              boxShadow: '0 24px 38px -6px rgba(0, 0, 0, 0.18)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              animation: 'profilePopIn 0.18s ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconTrash size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffffff', fontWeight: '700' }}>
                  Delete Published PDF
                </h3>
              </div>

              <button
                type="button"
                onClick={() => !deletePdfModal.isDeleting && setDeletePdfModal({ isOpen: false, uploadId: null, title: '', isDeleting: false })}
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.28)',
                  cursor: 'pointer',
                  color: '#ffffff',
                  padding: '5px',
                  borderRadius: '6px',
                  display: 'flex',
                }}
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: 0, color: '#334155', fontSize: '0.92rem', lineHeight: '1.5' }}>
                Are you sure you want to delete <strong style={{ color: '#0f172a', wordBreak: 'break-all' }}>{deletePdfModal.title}</strong>?
              </p>
            </div>

            {/* Footer */}
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
                onClick={() => setDeletePdfModal({ isOpen: false, uploadId: null, title: '', isDeleting: false })}
                disabled={deletePdfModal.isDeleting}
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
                onClick={handleConfirmDeletePdf}
                disabled={deletePdfModal.isDeleting}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  cursor: deletePdfModal.isDeleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                  opacity: deletePdfModal.isDeleting ? 0.75 : 1,
                }}
              >
                {deletePdfModal.isDeleting ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <IconTrash size={16} />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deadline Reminder Modal Popup (Presented on First Page After Login) */}
      <DeadlineModal />
    </div>
  );
};

export default Periods;
