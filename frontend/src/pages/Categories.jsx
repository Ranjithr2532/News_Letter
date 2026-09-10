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
} from '@tabler/icons-react';

const Categories = () => {
  const { periodId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const periodTitle = location.state?.periodTitle;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadingCategoryId, setDownloadingCategoryId] = useState(null);

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

  // Other Custom Category Modal state
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [otherTitle, setOtherTitle] = useState('');
  const [creatingOther, setCreatingOther] = useState(false);
  const [otherError, setOtherError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchCategories();
  }, [user, periodId, navigate]);

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
      const res = await api.get(
        `/entries/?period_id=${periodId}&category_id=${catId}`
      );
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
      const response = await api.get(`/periods/${periodId}/generate-docx`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = periodTitle
        ? `${periodTitle.replace(/\s+/g, '_')}.docx`
        : `newsletter_period_${periodId}.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
      const response = await api.get(
        `/periods/${periodId}/categories/${category.id}/generate-docx`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanCatName = category.name.replace(/\s+/g, '_');
      const filename = `${cleanCatName}_event.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download category docx:', err);
      alert('Failed to download category document.');
    } finally {
      setDownloadingCategoryId(null);
    }
  };

  if (!user) return null;

  return (
    <div
      className="categories-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* Top Navigation */}
      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => navigate('/periods')} className="btn-link-back">
          <IconArrowLeft size={18} />
          <span>Back to newsletters</span>
        </button>
      </div>

      {/* Main Categories Card Section */}
      <section
        className="card-section"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginBottom: 0,
        }}
      >
        {/* Header with Title on Left & Main Download Button on Right */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.4rem',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Categories</h3>
            <p
              style={{
                fontSize: '0.88rem',
                color: '#64748b',
                margin: '4px 0 0 0',
              }}
            >
              Click a category to expand inline and manage entry details for this newsletter.
            </p>
          </div>

          <button
            onClick={handleDownload}
            className="btn-action-green"
            style={{ marginLeft: 'auto' }}
            disabled={downloading}
          >
            <IconDownload size={18} />
            <span>{downloading ? 'Generating...' : 'Download Newsletter (.docx)'}</span>
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading categories...</p>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {categories.map((category) => {
              const isExpanded = expandedCategoryId === category.id;
              const hasActiveExpanded =
                expandedCategoryId !== null && !isExpanded;

              if (isExpanded) {
                // EXPANDED Category Card (Vertical stack item)
                return (
                  <div
                    key={category.id}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                      overflow: 'hidden',
                      transition: 'opacity 0.15s ease-in-out',
                    }}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => handleToggleExpand(category.id)}
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '16px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <IconFolder size={20} />
                        </div>
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <h4
                              style={{
                                margin: 0,
                                fontSize: '0.96rem',
                                color: 'var(--text-heading)',
                                fontWeight: '700',
                                lineHeight: '1.3',
                              }}
                            >
                              {category.name}
                            </h4>
                            <IconChevronUp size={18} style={{ color: '#94a3b8' }} />
                          </div>
                          {category.period_id && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#94a3b8',
                                fontWeight: '500',
                              }}
                            >
                              Custom Category
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Far Right: Delete & Download Icon */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginLeft: 'auto',
                        }}
                      >
                        {category.period_id && (
                          <button
                            className="btn-ghost-danger"
                            style={{ padding: '4px 6px', border: 'none' }}
                            onClick={(e) =>
                              handleDeleteCustomCategory(e, category.id)
                            }
                            title="Delete custom category"
                          >
                            <IconTrash size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onClick={(e) =>
                            handleDownloadCategoryDocx(e, category)
                          }
                          title={`Download ${category.name} docx`}
                          disabled={downloadingCategoryId === category.id}
                        >
                          <IconDownload size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Content Section below header */}
                    <div
                      style={{
                        padding: '18px 20px',
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      {/* Entries List */}
                      {loadingEntries ? (
                        <p className="loading-text">Loading entries...</p>
                      ) : entriesError ? (
                        <div className="error-message">{entriesError}</div>
                      ) : categoryEntries.length === 0 ? (
                        <p
                          className="empty-state"
                          style={{
                            fontSize: '0.88rem',
                            marginBottom: '16px',
                            textAlign: 'left',
                          }}
                        >
                          No entries found for this category yet. Add one
                          below.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            marginBottom: '20px',
                          }}
                        >
                          {categoryEntries.map((entry) => (
                            <div
                              key={entry.id}
                              style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '14px 16px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                              }}
                            >
                              {editingEntryId === entry.id ? (
                                /* Inline Edit Form */
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Entry Title..."
                                    style={{
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '0.9rem',
                                      fontWeight: '600',
                                    }}
                                  />
                                  <textarea
                                    value={editDescription}
                                    onChange={(e) =>
                                      setEditDescription(e.target.value)
                                    }
                                    placeholder="Entry Description..."
                                    rows="3"
                                    style={{
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '0.88rem',
                                    }}
                                  />
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: '8px',
                                      marginTop: '4px',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSaveEditEntry(entry.id, category.id)
                                      }
                                      disabled={savingEdit}
                                      className="btn-primary"
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      {savingEdit ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingEntryId(null)}
                                      className="btn-secondary"
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Entry View Card */
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justify: 'space-between',
                                      alignItems: 'flex-start',
                                      gap: '12px',
                                    }}
                                  >
                                    <h5
                                      style={{
                                        fontSize: '0.95rem',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        margin: 0,
                                        lineHeight: '1.35',
                                      }}
                                    >
                                      {entry.title}
                                    </h5>

                                    {/* Action Buttons (Outline Style) */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: '8px',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartEditEntry(entry)
                                        }
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: '0.78rem',
                                          fontWeight: '600',
                                          color: '#2563eb',
                                          backgroundColor: '#ffffff',
                                          border: '1px solid #2563eb',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <IconEdit size={14} />
                                        <span>Edit</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteEntry(entry.id, category.id)
                                        }
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: '0.78rem',
                                          fontWeight: '600',
                                          color: '#dc2626',
                                          backgroundColor: '#ffffff',
                                          border: '1px solid #dc2626',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <IconTrash size={14} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  </div>

                                  {entry.description && (
                                    <p
                                      style={{
                                        fontSize: '0.86rem',
                                        color: '#475569',
                                        marginTop: '6px',
                                        marginBottom: 0,
                                        whiteSpace: 'pre-wrap',
                                      }}
                                    >
                                      {entry.description}
                                    </p>
                                  )}

                                  {/* Photos List & Add Photo button */}
                                  <div style={{ marginTop: '10px' }}>
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        gap: '8px',
                                      }}
                                    >
                                      {entry.photos &&
                                        entry.photos.map((photo) => (
                                          <div
                                            key={photo.id}
                                            style={{
                                              position: 'relative',
                                              width: '64px',
                                              height: '64px',
                                              flexShrink: 0,
                                            }}
                                          >
                                            <img
                                              src={`http://${window.location.hostname ||
                                                'localhost'
                                                }:8000/${photo.file_path}`}
                                              alt={
                                                photo.original_filename ||
                                                'Entry photo'
                                              }
                                              style={{
                                                width: '64px',
                                                height: '64px',
                                                objectFit: 'cover',
                                                borderRadius: '6px',
                                                border: '1px solid #e2e8f0',
                                              }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDeletePhoto(
                                                  photo.id,
                                                  category.id
                                                )
                                              }
                                              title="Delete photo"
                                              style={{
                                                position: 'absolute',
                                                top: '-4px',
                                                right: '-4px',
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                backgroundColor: '#dc2626',
                                                color: '#ffffff',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                              }}
                                            >
                                              <IconX size={10} />
                                            </button>
                                          </div>
                                        ))}

                                      <label
                                        title="Upload photo"
                                        style={{
                                          width: '64px',
                                          height: '64px',
                                          border: '1.5px dashed #cbd5e1',
                                          borderRadius: '6px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '2px',
                                          cursor: 'pointer',
                                          backgroundColor: '#f8fafc',
                                          color: '#64748b',
                                          fontSize: '0.68rem',
                                          fontWeight: '600',
                                        }}
                                      >
                                        <IconUpload size={14} />
                                        <span>+ Photo</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          style={{ display: 'none' }}
                                          onChange={(e) => {
                                            if (
                                              e.target.files &&
                                              e.target.files.length > 0
                                            ) {
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
                                    </div>
                                  </div>

                                  {/* Footer Metadata */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      marginTop: '8px',
                                      color: '#94a3b8',
                                      fontSize: '0.72rem',
                                    }}
                                  >
                                    <IconClock size={12} />
                                    <span>
                                      Updated by{' '}
                                      {entry.updated_by_name ||
                                        `User #${entry.updated_by}`}{' '}
                                      on{' '}
                                      {entry.updated_at
                                        ? new Date(
                                          entry.updated_at
                                        ).toLocaleString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })
                                        : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* b. Add New Entry Mini-Form Box */}
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '18px 20px',
                        }}
                      >
                        <h5
                          style={{
                            margin: '0 0 14px 0',
                            fontSize: '0.92rem',
                            fontWeight: '700',
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <IconPlus size={14} />
                          </div>
                          <span>Add New Entry for {category.name}</span>
                        </h5>

                        {addError && (
                          <div
                            className="error-message"
                            style={{ marginBottom: '10px', fontSize: '0.82rem' }}
                          >
                            {addError}
                          </div>
                        )}

                        <form
                          onSubmit={(e) =>
                            handleAddEntrySubmit(e, category.id)
                          }
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
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
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
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
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                fontSize: '0.82rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <IconCamera size={16} style={{ color: '#64748b' }} />
                              <span>
                                {newFiles.length > 0
                                  ? `Attach Photos (${newFiles.length} selected)`
                                  : 'Attach Photos (Optional)'}
                              </span>
                            </label>

                            {newFiles.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '6px',
                                  marginTop: '6px',
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
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      border: '1px solid #cbd5e1',
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
                              }}
                            >
                              <IconPlus size={16} />
                              <span>
                                {submittingNew ? 'Saving Entry...' : 'Add Entry'}
                              </span>
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              }

              // COLLAPSED Category Card
              return (
                <div
                  key={category.id}
                  className="clickable-card"
                  onClick={() => handleToggleExpand(category.id)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    width: '100%',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s ease-in-out, border-color 0.15s ease-in-out',
                    minHeight: '76px',
                    opacity: hasActiveExpanded ? 0.7 : 1,
                  }}
                >
                  {/* Left: Folder + Title + Down Chevron */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                        color: 'var(--primary-btn)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconFolder size={20} />
                    </div>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '0.96rem',
                            color: 'var(--text-heading)',
                            fontWeight: '700',
                            lineHeight: '1.3',
                          }}
                        >
                          {category.name}
                        </h4>
                        <IconChevronDown size={18} style={{ color: '#94a3b8' }} />
                      </div>
                      {category.period_id && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#94a3b8',
                            fontWeight: '500',
                          }}
                        >
                          Custom Category
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Far Right (End of Box): Delete & Download Icon */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginLeft: 'auto',
                    }}
                  >
                    {category.period_id && (
                      <button
                        className="btn-ghost-danger"
                        style={{ padding: '4px 6px', border: 'none' }}
                        onClick={(e) =>
                          handleDeleteCustomCategory(e, category.id)
                        }
                        title="Delete custom category"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onClick={(e) => handleDownloadCategoryDocx(e, category)}
                      title={`Download ${category.name} docx`}
                      disabled={downloadingCategoryId === category.id}
                    >
                      <IconDownload size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* "+ Add Custom Category" Card */}
            <div
              className="clickable-card"
              onClick={() => {
                setOtherTitle('');
                setOtherError('');
                setShowOtherModal(true);
              }}
              style={{
                background: 'rgba(241, 245, 249, 0.5)',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                minHeight: '76px',
                color: 'var(--primary-btn)',
                fontWeight: '700',
                fontSize: '0.92rem',
                transition: 'all 0.18s ease-in-out',
                opacity: expandedCategoryId !== null ? 0.7 : 1,
              }}
            >
              <IconPlus size={20} />
              <span>Others</span>
            </div>
          </div>
        )}
      </section>

      {/* Modal for adding custom "Other" category */}
      {showOtherModal && (
        <div className="modal-backdrop" onClick={() => setShowOtherModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Add Custom Category for this Newsletter
            </h3>
            <p
              style={{
                fontSize: '0.85rem',
                color: '#64748b',
                marginBottom: '1.2rem',
              }}
            >
              This category will be created <strong>only for this Newsletter.</strong>
            </p>
            {otherError && <div className="error-message">{otherError}</div>}
            <form onSubmit={handleAddOtherCategory}>
              <div className="form-field" style={{ marginBottom: '1.2rem' }}>
                <label>Category Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Special Workshop, Guest Lecture, Exhibition"
                  value={otherTitle}
                  onChange={(e) => setOtherTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div
                className="form-buttons"
                style={{ justifyContent: 'flex-end', gap: '10px' }}
              >
                <button
                  type="button"
                  onClick={() => setShowOtherModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creatingOther}
                >
                  {creatingOther ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
