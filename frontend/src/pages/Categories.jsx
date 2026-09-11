import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import { formatErrorMessage } from '../utils/formatError';
import {
  IconArrowLeft,
  IconDownload,
  IconPlus,
  IconTrash,
  IconFolder,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconCheck,
  IconX,
  IconCamera,
  IconUpload,
  IconClock,
  IconLock,
  IconFileText,
  IconUsersGroup,
  IconLoader2,
  IconCalendar,
  IconLayersSubtract,
  IconEye,
  IconUser,
  IconFilter,
  IconUserCheck,
} from '@tabler/icons-react';

const Categories = () => {
  const { periodId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const passedPeriodTitle = location.state?.periodTitle;

  const [period, setPeriod] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadingCategoryId, setDownloadingCategoryId] = useState(null);

  const isGhUser = user?.role?.trim().toLowerCase() === 'gh';
  const isViewOnly = period?.edit === false;
  const canViewAll = isGhUser || isViewOnly;

  // Accordion state: ID of currently expanded category (only one expanded at a time)
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [categoryEntries, setCategoryEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState('');

  // Add Entry mini-form state (inside expanded category)
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFiles, setNewFiles] = useState([]);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [addError, setAddError] = useState('');
  const fileInputRef = useRef(null);

  // Inline Entry Edit state
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Custom Category Modal state
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [otherTitle, setOtherTitle] = useState('');
  const [creatingOther, setCreatingOther] = useState(false);
  const [otherError, setOtherError] = useState('');

  // Preview Newsletter Modal & Contributor Filter state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewCategory, setPreviewCategory] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [loadingContributors, setLoadingContributors] = useState(false);
  const [selectedContributorId, setSelectedContributorId] = useState(null);
  const [previewEntries, setPreviewEntries] = useState([]);
  const [loadingPreviewData, setLoadingPreviewData] = useState(false);
  const [downloadingPreviewDocx, setDownloadingPreviewDocx] = useState(false);

  // Photo Lightbox modal
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchPeriod();
    fetchCategories();
  }, [user, periodId, navigate]);

  const fetchPeriod = async () => {
    try {
      const res = await api.get(`/periods/${periodId}`);
      setPeriod(res.data);
    } catch (err) {
      console.error('Failed to fetch period details:', err);
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/categories/?period_id=${periodId}`);
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError('Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch entries for a single expanded category
  const fetchCategoryEntries = async (catId) => {
    setLoadingEntries(true);
    setEntriesError('');
    try {
      let url = `/entries/?period_id=${periodId}&category_id=${catId}`;
      if (!canViewAll && user?.id) {
        url += `&created_by=${user.id}`;
      }
      const res = await api.get(url);
      setCategoryEntries(res.data);
    } catch (err) {
      console.error('Failed to fetch category entries:', err);
      setEntriesError('Failed to load entries for this category.');
    } finally {
      setLoadingEntries(false);
    }
  };

  // Accordion toggle: expands or collapses a category
  const handleToggleExpand = (catId) => {
    if (expandedCategoryId === catId) {
      setExpandedCategoryId(null);
      setCategoryEntries([]);
    } else {
      setExpandedCategoryId(catId);
      resetAddForm();
      setEditingEntryId(null);
      fetchCategoryEntries(catId);
    }
  };

  const resetAddForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewFiles([]);
    setAddError('');
  };

  // Handle adding new entry inside expanded accordion
  const handleAddEntrySubmit = async (e, catId) => {
    e.preventDefault();
    setAddError('');

    if (!newTitle.trim()) {
      setAddError('Title is required.');
      return;
    }

    setSubmittingNew(true);
    try {
      const res = await api.post('/entries/', {
        period_id: Number(periodId),
        category_id: Number(catId),
        group_name: user?.group || user?.group_name || period?.group_name || 'General',
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        display_order: categoryEntries.length,
        created_by: user.id,
      });

      // Upload initial photos if selected via batch endpoint
      if (newFiles && newFiles.length > 0 && res.data && res.data.id) {
        try {
          const formData = new FormData();
          formData.append('entry_id', res.data.id);
          formData.append('uploaded_by', user.id);
          newFiles.forEach((file) => {
            formData.append('files', file);
          });
          await api.post('/photos/batch', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (batchErr) {
          console.warn('Batch photo upload failed, attempting single upload fallback:', batchErr);
          for (let i = 0; i < newFiles.length; i++) {
            const formData = new FormData();
            formData.append('entry_id', res.data.id);
            formData.append('uploaded_by', user.id);
            formData.append('display_order', i);
            formData.append('file', newFiles[i]);
            try {
              await api.post('/photos/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
            } catch (singleErr) {
              console.error('Failed to upload photo:', singleErr);
            }
          }
        }
      }

      resetAddForm();
      fetchCategoryEntries(catId);
    } catch (err) {
      console.error('Failed to create entry:', err);
      setAddError(
        formatErrorMessage(err, 'Failed to add entry. Please try again.')
      );
    } finally {
      setSubmittingNew(false);
    }
  };

  // Handle adding a photo to an existing entry
  const handleAddPhotoToEntry = async (entryId, catId, files) => {
    if (!files || files.length === 0) return;
    try {
      const formData = new FormData();
      formData.append('entry_id', entryId);
      formData.append('uploaded_by', user.id);
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      await api.post('/photos/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchCategoryEntries(catId);
    } catch (err) {
      console.warn('Batch upload to existing entry failed, trying single upload:', err);
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('entry_id', entryId);
        formData.append('uploaded_by', user.id);
        formData.append('display_order', i);
        formData.append('file', files[i]);
        try {
          await api.post('/photos/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (singleErr) {
          console.error('Failed to upload single photo:', singleErr);
        }
      }
      fetchCategoryEntries(catId);
    }
  };

  // Handle deleting a photo from an entry
  const handleDeletePhoto = async (photoId, catId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      await api.delete(`/photos/${photoId}?user_id=${user.id}`);
      fetchCategoryEntries(catId);
    } catch (err) {
      console.error('Failed to delete photo:', err);
      alert(formatErrorMessage(err, 'Failed to delete photo.'));
    }
  };

  // Start inline editing of an entry
  const handleStartEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditTitle(entry.title || '');
    setEditDescription(entry.description || '');
  };

  // Save inline edit of an entry
  const handleSaveEditEntry = async (entryId, catId) => {
    if (!editTitle.trim()) {
      alert('Title is required.');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/entries/${entryId}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        updated_by: user.id,
      });
      setEditingEntryId(null);
      fetchCategoryEntries(catId);
    } catch (err) {
      console.error('Failed to update entry:', err);
      alert(formatErrorMessage(err, 'Failed to update entry.'));
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete an entry
  const handleDeleteEntry = async (entryId, catId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await api.delete(`/entries/${entryId}`);
      fetchCategoryEntries(catId);
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert(formatErrorMessage(err, 'Failed to delete entry.'));
    }
  };

  // Handle adding custom "Other" category
  const handleAddOtherCategory = async (e) => {
    e.preventDefault();
    setOtherError('');
    if (!otherTitle.trim()) {
      setOtherError('Category name is required.');
      return;
    }
    setCreatingOther(true);
    try {
      const maxStage = categories.reduce(
        (max, c) => (c.stage_number > max ? c.stage_number : max),
        0
      );
      await api.post('/categories/', {
        name: otherTitle.trim(),
        stage_number: maxStage + 1,
        period_id: Number(periodId),
      });
      setOtherTitle('');
      setShowOtherModal(false);
      fetchCategories();
    } catch (err) {
      console.error('Failed to create custom category:', err);
      setOtherError(
        formatErrorMessage(err, 'Failed to create category. Please try again.')
      );
    } finally {
      setCreatingOther(false);
    }
  };

  // Handle deleting a custom category
  const handleDeleteCustomCategory = async (e, catId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this custom category? All its entries will also be deleted.')) {
      return;
    }
    try {
      await api.delete(`/categories/${catId}`);
      if (expandedCategoryId === catId) {
        setExpandedCategoryId(null);
        setCategoryEntries([]);
      }
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category.');
    }
  };

  // Handle downloading full newsletter docx
  const handleDownload = async () => {
    setDownloading(true);
    try {
      let url = `/periods/${periodId}/generate-docx`;
      if (!canViewAll && user?.id) {
        url += `?created_by=${user.id}`;
      }
      const response = await api.get(url, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      const effectiveTitle = period?.title || passedPeriodTitle || `Newsletter_Period_${periodId}`;
      const filename = `${effectiveTitle.replace(/\s+/g, '_')}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (err) {
      console.error('Failed to download docx:', err);
      alert('Failed to download newsletter.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCategoryDocx = async (e, category) => {
    e.stopPropagation();
    setDownloadingCategoryId(category.id);
    try {
      let url = `/periods/${periodId}/categories/${category.id}/generate-docx`;
      if (!canViewAll && user?.id) {
        url += `?created_by=${user.id}`;
      }
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      const cleanCatName = category.name.replace(/\s+/g, '_');
      const filename = `${cleanCatName}_entries.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (err) {
      console.error('Failed to download category docx:', err);
      alert('Failed to download category document.');
    } finally {
      setDownloadingCategoryId(null);
    }
  };

  const handleOpenPreview = async (targetCategory = null) => {
    // Ensure targetCategory is a valid category object (and not a React click Event object)
    const validCategory =
      targetCategory && typeof targetCategory === 'object' && typeof targetCategory.id === 'number'
        ? targetCategory
        : null;

    setPreviewCategory(validCategory);
    setShowPreviewModal(true);
    setSelectedContributorId(null);
    setLoadingPreviewData(true);
    setLoadingContributors(true);
    try {
      let entriesUrl = `/entries/?period_id=${periodId}`;
      if (validCategory?.id) {
        entriesUrl += `&category_id=${validCategory.id}`;
      }
      if (!canViewAll && user?.id) {
        entriesUrl += `&created_by=${user.id}`;
      }
      const [contribRes, entriesRes] = await Promise.all([
        api.get(`/periods/${periodId}/contributors`),
        api.get(entriesUrl),
      ]);
      const allEntries = entriesRes.data || [];
      let allContribs = contribRes.data || [];

      if (!canViewAll && user?.id) {
        allContribs = allContribs.filter((c) => c.id === user.id);
        if (allContribs.length === 0) {
          allContribs = [
            {
              id: user.id,
              name: user.name || user.email || 'You',
              role: user.role,
              designation: user.designation,
              entry_count: allEntries.length,
            },
          ];
        } else {
          allContribs = allContribs.map((c) => ({
            ...c,
            entry_count: allEntries.length,
          }));
        }
      } else if (validCategory?.id) {
        const activeUserIds = new Set(allEntries.map((e) => e.created_by));
        allContribs = allContribs
          .filter((c) => activeUserIds.has(c.id))
          .map((c) => ({
            ...c,
            entry_count: allEntries.filter((e) => e.created_by === c.id).length,
          }));
      }

      setContributors(allContribs);
      setPreviewEntries(allEntries);

      if (!canViewAll && user?.id) {
        setSelectedContributorId(user.id);
      } else {
        if (allContribs.length > 0) {
          const contribWithEntries = allContribs.find((c) => c.entry_count > 0);
          setSelectedContributorId(contribWithEntries ? contribWithEntries.id : allContribs[0].id);
        } else {
          setSelectedContributorId(user?.id || null);
        }
      }
    } catch (err) {
      console.error('Failed to load preview details:', err);
    } finally {
      setLoadingPreviewData(false);
      setLoadingContributors(false);
    }
  };

  const handleDownloadFilteredPreview = async () => {
    const activeContribId = canViewAll ? selectedContributorId : user?.id;
    setDownloadingPreviewDocx(true);
    try {
      let url = previewCategory?.id
        ? `/periods/${periodId}/categories/${previewCategory.id}/generate-docx`
        : `/periods/${periodId}/generate-docx`;

      if (activeContribId && activeContribId !== 'all') {
        url += (url.includes('?') ? '&' : '?') + `created_by=${activeContribId}`;
      }

      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      const baseTitle = previewCategory?.name
        ? `${previewCategory.name.replace(/\s+/g, '_')}_entries`
        : (period?.title || passedPeriodTitle || `Newsletter_Period_${periodId}`).replace(/\s+/g, '_');

      let suffix = '';
      if (activeContribId && activeContribId !== 'all') {
        const found = contributors.find((c) => c.id === Number(activeContribId));
        const foundName = canViewAll ? found?.name : (user?.name || 'My_Entries');
        if (foundName) suffix = `_${foundName.replace(/\s+/g, '_')}`;
      }
      const filename = `${baseTitle}${suffix}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (err) {
      console.error('Failed to download preview docx:', err);
      alert('Failed to download document.');
    } finally {
      setDownloadingPreviewDocx(false);
    }
  };

  if (!user) return null;

  const displayPeriodTitle = period?.title || passedPeriodTitle || `Newsletter Period #${periodId}`;

  return (
    <div className="categories-page">
      {/* 1. Top Breadcrumb Navigation */}
      <div>
        <button
          onClick={() => navigate('/periods')}
          className="btn-link-back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.86rem',
            fontWeight: '600',
            color: '#2563eb',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <IconArrowLeft size={18} />
          <span>Back to Newsletter Overview</span>
        </button>
      </div>

      {/* 2. Hero Context Banner */}
      <div className="categories-hero">
        <div className="categories-hero-left">
          <h2 className="categories-hero-title">
            <IconCalendar size={24} style={{ color: '#2563eb' }} />
            <span>{displayPeriodTitle}</span>
          </h2>
          <div className="categories-hero-meta">
            <span>Department:</span>
            <span className="group-badge-hero">
              <IconUsersGroup size={13} />
              {user.group || user.group_name || 'General'}
            </span>
            <span>•</span>
            <span>Status:</span>
            {isViewOnly ? (
              <span className="status-badge-finalized">
                <IconLock size={12} />
                <span>Finalized (View-Only)</span>
              </span>
            ) : (
              <span className="status-badge-open">
                <IconCheck size={12} strokeWidth={2.5} />
                <span>Open for Editing</span>
              </span>
            )}
          </div>
        </div>

        {/* Top Actions: Preview & Download */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Preview Newsletter Button */}
          <button
            onClick={() => handleOpenPreview(null)}
            className="btn-action-preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.9rem',
              fontWeight: '600',
              borderRadius: '10px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.16s ease',
            }}
            title="Preview formatted newsletter layout and filter by contributor"
          >
            <IconEye size={18} />
            <span>Preview Newsletter</span>
          </button>

          {/* Download Full Newsletter */}
          <button
            onClick={handleDownload}
            className="btn-action-green"
            disabled={downloading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontSize: '0.9rem',
              fontWeight: '600',
              borderRadius: '10px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              cursor: downloading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
              transition: 'all 0.16s ease',
            }}
          >
            {downloading ? (
              <>
                <IconLoader2 size={18} className="animate-spin" />
                <span>Generating Document...</span>
              </>
            ) : (
              <>
                <IconDownload size={18} />
                <span>Download (.docx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Finalized Notice Banner (if applicable) */}
      {isViewOnly && (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a',
              flexShrink: 0,
            }}
          >
            <IconLock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#166534' }}>
              Finalized Newsletter (Read-Only Mode)
            </div>
            <div style={{ fontSize: '0.82rem', color: '#15803d', marginTop: '2px' }}>
              This newsletter period has been approved and finalized by the Group Head. All entries, descriptions, and photos are locked.
            </div>
          </div>
        </div>
      )}

      {/* 4. Categories Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconLayersSubtract size={20} style={{ color: '#2563eb' }} />
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: '800' }}>
            Categories
          </h3>
          <span className="kanban-count-badge">{categories.length}</span>
        </div>
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
          Click any category below to expand entries and add content
        </span>
      </div>

      {/* 5. Main Categories Accordion Stack */}
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
            Loading categories...
          </p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="category-accordion-list">
          {categories.map((category) => {
            const isExpanded = expandedCategoryId === category.id;

            return (
              <div
                key={category.id}
                className={`category-card ${isExpanded ? 'expanded' : ''}`}
              >
                {/* Accordion Header */}
                <div
                  className="category-header"
                  onClick={() => handleToggleExpand(category.id)}
                  title={`Click to ${isExpanded ? 'collapse' : 'expand'} ${category.name}`}
                >
                  <div className="category-header-left">
                    <div className="category-icon-box">
                      <IconFolder size={20} />
                    </div>

                    <div className="category-title-wrap">
                      <div className="category-name-row">
                        <h4 className="category-name-heading">{category.name}</h4>
                        {category.period_id && (
                          <span className="category-badge-custom">Custom</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Right Actions */}
                  <div className="category-header-actions">
                    {/* Delete Custom Category Button (if applicable) */}
                    {!isViewOnly && category.period_id && (
                      <button
                        type="button"
                        className="action-icon-btn"
                        style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomCategory(e, category.id);
                        }}
                        title="Delete custom category"
                        aria-label="Delete category"
                      >
                        <IconTrash size={15} />
                      </button>
                    )}

                    {/* Category Preview Button */}
                    <button
                      type="button"
                      className="action-icon-btn preview"
                      style={{ color: '#2563eb', borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPreview(category);
                      }}
                      title={`Preview ${category.name} document layout`}
                      aria-label={`Preview ${category.name} entries`}
                    >
                      <IconEye size={15} />
                    </button>

                    {/* Category Download DOCX */}
                    <button
                      type="button"
                      className="action-icon-btn download"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadCategoryDocx(e, category);
                      }}
                      title={`Download ${category.name} entries (.docx)`}
                      disabled={downloadingCategoryId === category.id}
                      aria-label="Download category document"
                    >
                      {downloadingCategoryId === category.id ? (
                        <IconLoader2 size={15} className="animate-spin text-blue-600" />
                      ) : (
                        <IconDownload size={15} />
                      )}
                    </button>

                    {/* Expand/Collapse Chevron Indicator */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isExpanded ? '#2563eb' : '#64748b',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(category.id);
                      }}
                      title={isExpanded ? 'Collapse category' : 'Expand category'}
                      aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
                    >
                      {isExpanded ? (
                        <IconChevronUp size={20} style={{ color: '#2563eb' }} />
                      ) : (
                        <IconChevronDown size={20} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content Section */}
                {isExpanded && (
                  <div className="category-content-body">
                    {/* List of Entries */}
                    {loadingEntries ? (
                      <div
                        style={{
                          padding: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          color: '#64748b',
                        }}
                      >
                        <IconLoader2 size={20} className="animate-spin text-blue-600" />
                        <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>
                          Loading entries...
                        </span>
                      </div>
                    ) : entriesError ? (
                      <div className="error-message">{entriesError}</div>
                    ) : categoryEntries.length === 0 ? (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px dashed #cbd5e1',
                          borderRadius: '10px',
                          padding: '24px 20px',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <IconFileText size={28} style={{ color: '#94a3b8' }} />
                        <h5 style={{ margin: 0, color: '#0f172a', fontSize: '0.92rem' }}>
                          No entries yet in {category.name}
                        </h5>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
                          {!isViewOnly
                            ? 'Use the form below to record your first entry and attach photos.'
                            : 'No entries were recorded for this category.'}
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {categoryEntries.map((entry) => (
                          <div key={entry.id} className="entry-card">
                            {editingEntryId === entry.id ? (
                              /* Inline Edit Form */
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                  <label
                                    style={{
                                      fontSize: '0.78rem',
                                      fontWeight: '700',
                                      color: '#475569',
                                      marginBottom: '4px',
                                      display: 'block',
                                    }}
                                  >
                                    Title *
                                  </label>
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Entry Title..."
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '0.9rem',
                                      fontWeight: '600',
                                      color: '#0f172a',
                                      outline: 'none',
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      fontSize: '0.78rem',
                                      fontWeight: '700',
                                      color: '#475569',
                                      marginBottom: '4px',
                                      display: 'block',
                                    }}
                                  >
                                    Description
                                  </label>
                                  <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Entry Description..."
                                    rows="3"
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '0.88rem',
                                      color: '#0f172a',
                                      outline: 'none',
                                      resize: 'vertical',
                                    }}
                                  />
                                </div>

                                {/* Attached Photos Management */}
                                <div>
                                  <label
                                    style={{
                                      fontSize: '0.78rem',
                                      fontWeight: '700',
                                      color: '#475569',
                                      marginBottom: '6px',
                                      display: 'block',
                                    }}
                                  >
                                    Photos
                                  </label>
                                  <div className="entry-photos-gallery">
                                    {entry.photos &&
                                      entry.photos.map((photo) => {
                                        const photoPath = photo.file_path ? photo.file_path.replace(/\\/g, '/') : '';
                                        const photoUrl = `http://${window.location.hostname || 'localhost'}:8000/${photoPath}`;
                                        return (
                                          <div
                                            key={photo.id}
                                            className="entry-photo-card"
                                            onClick={() => setPreviewPhoto({ url: photoUrl, name: photo.original_filename })}
                                            style={{ cursor: 'pointer' }}
                                            title="Click to preview image"
                                          >
                                            <img
                                              src={photoUrl}
                                              alt={photo.original_filename || 'Entry photo'}
                                            />
                                            {!isViewOnly && (
                                              <button
                                                type="button"
                                                className="photo-delete-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeletePhoto(photo.id, category.id);
                                                }}
                                                title="Delete photo"
                                                aria-label="Delete photo"
                                              >
                                                <IconX size={11} strokeWidth={2.5} />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}

                                    {/* Upload Additional Photo Button */}
                                    {!isViewOnly && (
                                      <label className="photo-upload-slot" title="Add photo to this entry">
                                        <IconUpload size={16} />
                                        <span>+ Add Photo</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          style={{ display: 'none' }}
                                          onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                              handleAddPhotoToEntry(
                                                entry.id,
                                                category.id,
                                                e.target.files
                                              );
                                              e.target.value = '';
                                            }
                                          }}
                                        />
                                      </label>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditEntry(entry.id, category.id)}
                                    disabled={savingEdit}
                                    className="btn-primary"
                                    style={{
                                      padding: '7px 16px',
                                      fontSize: '0.84rem',
                                      fontWeight: '600',
                                      borderRadius: '8px',
                                    }}
                                  >
                                    {savingEdit ? 'Saving...' : 'Save Changes'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntryId(null)}
                                    className="btn-secondary"
                                    style={{
                                      padding: '7px 14px',
                                      fontSize: '0.84rem',
                                      fontWeight: '600',
                                      borderRadius: '8px',
                                      backgroundColor: '#f1f5f9',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Standard Entry View */
                              <>
                                <div className="entry-card-header">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <h5 className="entry-title">{entry.title}</h5>
                                    {canViewAll && (
                                      <span
                                        className="entry-author-pill"
                                        title={`Added by ${entry.created_by_name || `User #${entry.created_by}`}`}
                                      >
                                        👤 {entry.created_by_name || `User #${entry.created_by}`}
                                      </span>
                                    )}
                                  </div>

                                  {/* Action Buttons for Author or GH */}
                                  {!isViewOnly && (isGhUser || entry.created_by === user?.id) && (
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditEntry(entry)}
                                        className="action-icon-btn"
                                        style={{
                                          width: '30px',
                                          height: '30px',
                                          color: '#2563eb',
                                          borderColor: '#bfdbfe',
                                          backgroundColor: '#eff6ff',
                                        }}
                                        title="Edit entry"
                                        aria-label="Edit entry"
                                      >
                                        <IconEdit size={14} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteEntry(entry.id, category.id)}
                                        className="action-icon-btn"
                                        style={{
                                          width: '30px',
                                          height: '30px',
                                          color: '#dc2626',
                                          borderColor: '#fecaca',
                                          backgroundColor: '#fef2f2',
                                        }}
                                        title="Delete entry"
                                        aria-label="Delete entry"
                                      >
                                        <IconTrash size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {entry.description && (
                                  <p className="entry-description-text">{entry.description}</p>
                                )}

                                {/* Entry Photos Gallery */}
                                <div className="entry-photos-gallery">
                                  {entry.photos &&
                                    entry.photos.map((photo) => {
                                      const photoPath = photo.file_path ? photo.file_path.replace(/\\/g, '/') : '';
                                      const photoUrl = `http://${window.location.hostname || 'localhost'}:8000/${photoPath}`;
                                      return (
                                        <div
                                          key={photo.id}
                                          className="entry-photo-card"
                                          onClick={() => setPreviewPhoto({ url: photoUrl, name: photo.original_filename })}
                                          style={{ cursor: 'pointer' }}
                                          title="Click to preview image"
                                        >
                                          <img
                                            src={photoUrl}
                                            alt={photo.original_filename || 'Entry photo'}
                                          />
                                          {!isViewOnly && (
                                            <button
                                              type="button"
                                              className="photo-delete-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePhoto(photo.id, category.id);
                                              }}
                                              title="Delete photo"
                                              aria-label="Delete photo"
                                            >
                                              <IconX size={11} strokeWidth={2.5} />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}

                                  {/* Upload Additional Photo Button */}
                                  {!isViewOnly && (
                                    <label className="photo-upload-slot" title="Add photo to this entry">
                                      <IconUpload size={16} />
                                      <span>+ Photo</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files.length > 0) {
                                            handleAddPhotoToEntry(
                                              entry.id,
                                              category.id,
                                              e.target.files
                                            );
                                            e.target.value = '';
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>

                                {/* Footer Timestamp Metadata */}
                                <div className="entry-footer-meta">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <IconClock size={13} />
                                    <span>
                                      Added by{' '}
                                      <strong style={{ color: '#475569' }}>
                                        {entry.created_by_name || `User #${entry.created_by}`}
                                      </strong>
                                      {entry.created_at && (
                                        <>
                                          {' '}on{' '}
                                          {new Date(entry.created_at).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true,
                                          })}
                                        </>
                                      )}
                                    </span>
                                  </div>

                                  {entry.updated_at && entry.updated_at !== entry.created_at && (
                                    <span>
                                      • Edited by {entry.updated_by_name || `User #${entry.updated_by}`}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Entry Mini-Form Box */}
                    {!isViewOnly && (
                      <div className="add-entry-box">
                        <h5 className="add-entry-title">
                          <IconPlus size={16} style={{ color: '#2563eb' }} />
                          <span>Add New Entry to {category.name}</span>
                        </h5>

                        {addError && (
                          <div className="error-message" style={{ fontSize: '0.82rem', margin: 0 }}>
                            {addError}
                          </div>
                        )}

                        <form
                          onSubmit={(e) => handleAddEntrySubmit(e, category.id)}
                          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                        >
                          <input
                            type="text"
                            placeholder="Entry Title *"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            required
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.88rem',
                              outline: 'none',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                            }}
                          />

                          <textarea
                            placeholder="Entry Description (optional)..."
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            rows="3"
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.88rem',
                              outline: 'none',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              resize: 'vertical',
                            }}
                          />

                          {/* Optional Photo Attachment */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                id={`file-input-new-${category.id}`}
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    const selectedFiles = Array.from(e.target.files);
                                    setNewFiles((prev) => [...prev, ...selectedFiles]);
                                  }
                                }}
                              />
                              <label
                                htmlFor={`file-input-new-${category.id}`}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: '8px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#475569',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                }}
                              >
                                <IconCamera size={16} style={{ color: '#2563eb' }} />
                                <span>
                                  {newFiles.length > 0
                                    ? `Attach Photos (${newFiles.length} selected)`
                                    : 'Attach Photos (Optional)'}
                                </span>
                              </label>
                            </div>

                            {/* Attached Files List Pills */}
                            {newFiles.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                {newFiles.map((file, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '0.75rem',
                                      backgroundColor: '#ffffff',
                                      color: '#334155',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      border: '1px solid #cbd5e1',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    📷 {file.name}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNewFiles((prev) =>
                                          prev.filter((_, i) => i !== idx)
                                        )
                                      }
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        lineHeight: 1,
                                        padding: 0,
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setNewFiles([])}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: '600',
                                    marginLeft: '4px',
                                  }}
                                >
                                  Clear all
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                              type="submit"
                              disabled={submittingNew}
                              className="btn-primary"
                              style={{
                                padding: '8px 18px',
                                fontSize: '0.86rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                borderRadius: '8px',
                              }}
                            >
                              {submittingNew ? (
                                <>
                                  <IconLoader2 size={16} className="animate-spin" />
                                  <span>Saving Entry...</span>
                                </>
                              ) : (
                                <>
                                  <IconPlus size={16} />
                                  <span>Save Entry</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* "+ Add Custom Category" Button */}
          {!isViewOnly && (
            <div
              className="add-custom-cat-card"
              onClick={() => {
                setOtherTitle('');
                setOtherError('');
                setShowOtherModal(true);
              }}
              role="button"
              tabIndex={0}
              title="Add a custom category for this newsletter edition"
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconPlus size={16} strokeWidth={2.5} />
              </div>
              <span>Add Custom Category</span>
            </div>
          )}
        </div>
      )}

      {/* 6. Modal for Custom "Other" Category */}
      {showOtherModal && (
        <div className="modal-backdrop" onClick={() => setShowOtherModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              animation: 'profilePopIn 0.18s ease-out',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                Add Custom Category
              </h3>
              <button
                type="button"
                onClick={() => setShowOtherModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                }}
              >
                <IconX size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '16px', lineHeight: '1.4' }}>
              This category will be attached <strong>specifically to {displayPeriodTitle}</strong>.
            </p>

            {otherError && (
              <div className="error-message" style={{ marginBottom: '12px', fontSize: '0.82rem' }}>
                {otherError}
              </div>
            )}

            <form onSubmit={handleAddOtherCategory}>
              <div className="form-field" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special Workshop, Guest Lecture, Industrial Visit"
                  value={otherTitle}
                  onChange={(e) => setOtherTitle(e.target.value)}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="form-buttons" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowOtherModal(false)}
                  className="btn-secondary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.86rem',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creatingOther}
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.86rem',
                    borderRadius: '8px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                  }}
                >
                  {creatingOther ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Newsletter Preview & Contributor Filter Modal */}
      {showPreviewModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPreviewModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
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
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
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
                  <IconEye size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                    {canViewAll
                      ? (previewCategory ? `${previewCategory.name} — Category Preview` : 'Newsletter Document Preview')
                      : (previewCategory ? `${previewCategory.name} — My Entries Preview` : 'My Newsletter Entries Preview')}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    {canViewAll
                      ? (previewCategory
                        ? `Previewing formatted entries and contributors specifically for ${previewCategory.name}`
                        : 'Preview formatted layout matching the exported Word (.docx) document across all contributors')
                      : (previewCategory
                        ? `Previewing your submitted entries in ${previewCategory.name}`
                        : 'Previewing your formatted newsletter entries matching the exported Word (.docx) document')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Contributor Filter Selector Bar */}
            <div
              style={{
                padding: '12px 24px',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <IconFilter size={14} style={{ color: '#2563eb' }} />
                  <span>{canViewAll ? 'Filter by Contributor:' : 'My Contributed Entries:'}</span>
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {canViewAll
                    ? `${contributors.length} member${contributors.length === 1 ? '' : 's'} contributed ${previewCategory ? `in ${previewCategory.name}` : 'to this edition'}`
                    : `Showing entries for ${user.name || user.email}`}
                </span>
              </div>

              {loadingContributors ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', color: '#64748b', fontSize: '0.84rem' }}>
                  <IconLoader2 size={16} className="animate-spin text-blue-600" />
                  <span>Loading contributors...</span>
                </div>
              ) : contributors.length === 0 ? (
                <div style={{ fontSize: '0.84rem', color: '#64748b', padding: '4px 0' }}>
                  {canViewAll
                    ? `No members have contributed entries yet ${previewCategory ? `in ${previewCategory.name}` : 'for this newsletter edition'}.`
                    : `You have not contributed any entries yet ${previewCategory ? `in ${previewCategory.name}` : 'for this edition'}.`}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    maxHeight: '80px',
                    overflowY: 'auto',
                    padding: '2px 0',
                  }}
                >
                  {/* Individual Contributor Pills — show active contributors for GH, or self for member */}
                  {contributors.map((c) => {
                    const isSelected = selectedContributorId === c.id;
                    const isUserGh = c.role?.trim().toLowerCase() === 'gh';
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedContributorId(c.id)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          color: isSelected ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 1px 4px rgba(37,99,235,0.2)' : 'none',
                        }}
                        title={`${c.name} (${isUserGh ? 'Group Head' : c.designation || 'Member'}) — ${c.entry_count} entries`}
                      >
                        <IconUser size={14} style={{ color: isSelected ? '#2563eb' : '#64748b' }} />
                        <span>{!canViewAll && c.id === user.id ? `My Entries (${c.name})` : c.name}</span>
                        {isUserGh && (
                          <span
                            style={{
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              fontSize: '0.68rem',
                              fontWeight: '800',
                              border: '1px solid #fde68a',
                            }}
                          >
                            GH
                          </span>
                        )}
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '10px',
                            backgroundColor: isSelected ? '#bfdbfe' : '#f1f5f9',
                            color: isSelected ? '#1e40af' : '#64748b',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                          }}
                        >
                          {c.entry_count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Document Paper Sheet Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                backgroundColor: '#cbd5e1',
                padding: '24px 16px',
              }}
            >
              {loadingPreviewData ? (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    padding: '60px 24px',
                    textAlign: 'center',
                    maxWidth: '780px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#64748b',
                  }}
                >
                  <IconLoader2 size={32} className="animate-spin text-blue-600" />
                  <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Loading preview document...</span>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    maxWidth: '780px',
                    margin: '0 auto',
                    borderRadius: '6px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    padding: '40px 48px',
                    fontFamily: 'Calibri, Inter, sans-serif',
                    minHeight: '450px',
                  }}
                >
                  {/* Document Header Line */}
                  <div
                    style={{
                      borderBottom: '2px solid #0f172a',
                      paddingBottom: '12px',
                      marginBottom: '24px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '1.25rem',
                          fontWeight: '800',
                          color: '#0f172a',
                          lineHeight: '1.3',
                        }}
                      >
                        {previewCategory ? `${previewCategory.name} — Event Details` : displayPeriodTitle}
                      </h2>
                      <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Department: <strong>{user.group || user.group_name || 'General'}</strong></span>
                        {previewCategory && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#2563eb', fontWeight: '700' }}>📁 Category: {previewCategory.name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        Contributor: {contributors.find((c) => c.id === Number(selectedContributorId))?.name || user?.name || 'Contributor'}
                      </span>
                    </div>
                  </div>

                  {/* Render Entries Grouped by Category */}
                  {(() => {
                    const activeEntries = selectedContributorId
                      ? previewEntries.filter((e) => e.created_by === Number(selectedContributorId))
                      : [];

                    if (activeEntries.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          <IconFileText size={36} style={{ color: '#94a3b8', margin: '0 auto 10px auto' }} />
                          <h4 style={{ margin: 0, color: '#334155' }}>No entries found</h4>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                            {canViewAll
                              ? (contributors.length === 0
                                ? previewCategory
                                  ? `No members have contributed entries in ${previewCategory.name} yet.`
                                  : 'No members have contributed entries to this newsletter edition yet.'
                                : `This contributor has not submitted any entries ${previewCategory ? `in ${previewCategory.name}` : 'for this edition'}.`)
                              : `You have not submitted any entries ${previewCategory ? `in ${previewCategory.name}` : 'for this edition'} yet.`}
                          </p>
                        </div>
                      );
                    }

                    // Group by target categories (either only the selected category or all categories)
                    const targetCategories = previewCategory
                      ? categories.filter((c) => c.id === previewCategory.id)
                      : categories;

                    let globalEntryIndex = 1;
                    return targetCategories.map((cat) => {
                      const catEntries = activeEntries.filter((e) => e.category_id === cat.id);
                      if (catEntries.length === 0) return null;

                      return (
                        <div key={cat.id} style={{ marginBottom: '28px' }}>
                          {/* Category Header */}
                          <div
                            style={{
                              backgroundColor: '#f8fafc',
                              borderLeft: '4px solid #2563eb',
                              padding: '6px 12px',
                              marginBottom: '16px',
                              borderRadius: '0 6px 6px 0',
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '1.02rem',
                                fontWeight: '700',
                                color: '#1e293b',
                              }}
                            >
                              {cat.name}
                            </h3>
                          </div>

                          {/* Entries in Category */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {catEntries.map((entry) => {
                              const itemNumber = globalEntryIndex++;
                              return (
                                <div key={entry.id} style={{ paddingLeft: '8px' }}>
                                  {/* Title & Author Attribution */}
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                                    <h4
                                      style={{
                                        margin: 0,
                                        fontSize: '0.98rem',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                      }}
                                    >
                                      {itemNumber}. {entry.title}
                                    </h4>
                                    {selectedContributorId === 'all' && (
                                      <span
                                        style={{
                                          fontSize: '0.74rem',
                                          color: '#2563eb',
                                          backgroundColor: '#eff6ff',
                                          padding: '2px 8px',
                                          borderRadius: '12px',
                                          fontWeight: '600',
                                        }}
                                      >
                                        👤 {entry.created_by_name || `User #${entry.created_by}`}
                                      </span>
                                    )}
                                  </div>

                                  {/* Description Text */}
                                  {entry.description && (
                                    <p
                                      style={{
                                        margin: '6px 0 10px 0',
                                        fontSize: '0.9rem',
                                        lineHeight: '1.5',
                                        color: '#334155',
                                        whiteSpace: 'pre-wrap',
                                      }}
                                    >
                                      {entry.description}
                                    </p>
                                  )}

                                  {/* Photos Layout (Standard Centered Word Layout) */}
                                  {entry.photos && entry.photos.length > 0 && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginTop: '10px',
                                      }}
                                    >
                                      {entry.photos.map((photo) => {
                                        const photoPath = photo.file_path ? photo.file_path.replace(/\\/g, '/') : '';
                                        const photoUrl = `http://${window.location.hostname || 'localhost'}:8000/${photoPath}`;
                                        return (
                                          <div
                                            key={photo.id}
                                            style={{
                                              width: '100%',
                                              maxWidth: '460px',
                                              aspectRatio: '3 / 2',
                                              textAlign: 'center',
                                              cursor: 'pointer',
                                              borderRadius: '6px',
                                              overflow: 'hidden',
                                              border: '1px solid #cbd5e1',
                                              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                            }}
                                            onClick={() => setPreviewPhoto({ url: photoUrl, name: photo.original_filename })}
                                            title="Click to zoom photo"
                                          >
                                            <img
                                              src={photoUrl}
                                              alt={photo.original_filename || 'Entry Photo'}
                                              style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                objectPosition: 'center',
                                              }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
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
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '14px 24px',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                {canViewAll
                  ? (selectedContributorId === 'all' || !selectedContributorId
                    ? `Showing ${previewEntries.length} entries from ${contributors.length} contributor(s)${previewCategory ? ` in ${previewCategory.name}` : ''}`
                    : `Showing entries for: ${contributors.find((c) => c.id === Number(selectedContributorId))?.name || 'Contributor'}${previewCategory ? ` in ${previewCategory.name}` : ''}`)
                  : `Showing your entries${previewCategory ? ` in ${previewCategory.name}` : ''}`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                    fontWeight: '600',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFilteredPreview}
                  disabled={downloadingPreviewDocx || !selectedContributorId}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                    fontWeight: '600',
                    backgroundColor: !selectedContributorId ? '#94a3b8' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    cursor: downloadingPreviewDocx || !selectedContributorId ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: selectedContributorId ? '0 2px 6px rgba(5,150,105,0.25)' : 'none',
                  }}
                >
                  {downloadingPreviewDocx ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" />
                      <span>Generating Document...</span>
                    </>
                  ) : (
                    <>
                      <IconDownload size={16} />
                      <span>
                        {selectedContributorId === 'all' || !selectedContributorId
                          ? (previewCategory ? `Download ${previewCategory.name} (.docx)` : 'Download Full Newsletter (.docx)')
                          : (canViewAll
                            ? `Download ${contributors.find((c) => c.id === Number(selectedContributorId))?.name || 'Contributor'}'s Entries (.docx)`
                            : 'Download My Entries (.docx)')}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Image Lightbox Preview Modal */}
      {previewPhoto && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '85vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#0f172a',
              padding: '12px',
              borderRadius: '16px',
              border: '1px solid #334155',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                fontWeight: 'bold',
              }}
              title="Close"
            >
              <IconX size={18} />
            </button>
            <img
              src={previewPhoto.url}
              alt={previewPhoto.name || 'Photo preview'}
              style={{
                maxWidth: '80vw',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '10px',
              }}
            />
            {previewPhoto.name && (
              <span style={{ marginTop: '8px', color: '#cbd5e1', fontSize: '0.82rem' }}>
                {previewPhoto.name}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
