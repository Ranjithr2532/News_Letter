import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
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
      setError('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch entries for a specific expanded category
  const fetchCategoryEntries = async (catId) => {
    setLoadingEntries(true);
    setEntriesError('');
    try {
      let url = `/entries/?period_id=${periodId}&category_id=${catId}`;
      if (!isGhUser && user?.id) {
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

  // Toggle category accordion expansion
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
        period_id: parseInt(periodId, 10),
        group_name: user.group || user.group_name,
        category_id: parseInt(catId, 10),
        title: newTitle.trim(),
        description: newDescription.trim(),
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
      console.error('Failed to add entry:', err);
      setAddError('Failed to add entry. Please try again.');
    } finally {
      setSubmittingNew(false);
    }
  };

  // Inline entry editing handlers
  const handleStartEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditTitle(entry.title || '');
    setEditDescription(entry.description || '');
  };

  const handleSaveEditEntry = async (entryId, catId) => {
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    try {
      await api.put(`/entries/${entryId}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        updated_by: user.id,
      });
      setEditingEntryId(null);
      fetchCategoryEntries(catId);
    } catch (err) {
      console.error('Failed to update entry:', err);
      alert('Failed to update entry.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEntry = async (entryId, catId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }
    try {
      await api.delete(`/entries/${entryId}`);
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
      }
      fetchCategoryEntries(catId);
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Failed to delete entry.');
    }
  };

  // Entry photo handlers inside accordion
  const handleAddPhotoToEntry = async (entryId, catId, files) => {
    if (!files) return;
    const fileList = Array.from(files.length !== undefined ? files : [files]);
    if (fileList.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('entry_id', entryId);
      formData.append('uploaded_by', user.id);
      fileList.forEach((file) => {
        formData.append('files', file);
      });
      await api.post('/photos/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (batchErr) {
      console.warn('Batch upload failed, attempting single upload fallback:', batchErr);
      const entry = categoryEntries.find((e) => e.id === entryId);
      let startOrder = entry && entry.photos ? entry.photos.length : 0;
      for (let i = 0; i < fileList.length; i++) {
        const formData = new FormData();
        formData.append('entry_id', entryId);
        formData.append('uploaded_by', user.id);
        formData.append('display_order', startOrder + i);
        formData.append('file', fileList[i]);
        try {
          await api.post('/photos/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (singleErr) {
          console.error('Failed to upload photo:', singleErr);
        }
      }
    }
    fetchCategoryEntries(catId);
  };

  const handleDeletePhoto = async (photoId, catId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return;
    }
    try {
      await api.delete(`/photos/${photoId}?user_id=${user.id}`);
      fetchCategoryEntries(catId);
    } catch (err) {
      console.error('Failed to delete photo:', err);
      alert('Failed to delete photo.');
    }
  };

  // Add custom "Other" category
  const handleAddOtherCategory = async (e) => {
    e.preventDefault();
    if (!otherTitle.trim()) {
      setOtherError('Please enter a category title.');
      return;
    }
    setCreatingOther(true);
    setOtherError('');
    try {
      await api.post('/categories/', {
        name: otherTitle.trim(),
        stage_number: categories.length + 1,
        period_id: parseInt(periodId, 10),
      });
      setOtherTitle('');
      setShowOtherModal(false);
      fetchCategories();
    } catch (err) {
      console.error('Failed to add custom category:', err);
      setOtherError('Failed to add custom category.');
    } finally {
      setCreatingOther(false);
    }
  };

  const handleDeleteCustomCategory = async (e, categoryId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this custom category?')) {
      return;
    }
    try {
      await api.delete(`/categories/${categoryId}`);
      if (expandedCategoryId === categoryId) {
        setExpandedCategoryId(null);
      }
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category.');
    }
  };

  // Document download handlers
  const handleDownload = async () => {
    setDownloading(true);
    try {
      let url = `/periods/${periodId}/generate-docx`;
      if (!isGhUser && user?.id) {
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
      if (!isGhUser && user?.id) {
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

        {/* Top Action: Download Full Newsletter */}
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
              <span>Download Newsletter (.docx)</span>
            </>
          )}
        </button>
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
                  <div
                    className="category-header-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Delete Custom Category Button (if applicable) */}
                    {!isViewOnly && category.period_id && (
                      <button
                        type="button"
                        className="action-icon-btn"
                        style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                        onClick={(e) => handleDeleteCustomCategory(e, category.id)}
                        title="Delete custom category"
                        aria-label="Delete category"
                      >
                        <IconTrash size={15} />
                      </button>
                    )}

                    {/* Category Download DOCX */}
                    <button
                      type="button"
                      className="action-icon-btn download"
                      onClick={(e) => handleDownloadCategoryDocx(e, category)}
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
                        color: '#64748b',
                      }}
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

                                <div style={{ display: 'flex', gap: '8px' }}>
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
                                    {isGhUser && (
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
                                      const photoUrl = `http://${window.location.hostname || 'localhost'}:8000/${photo.file_path}`;
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

      {/* 7. Image Lightbox Preview Modal */}
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
