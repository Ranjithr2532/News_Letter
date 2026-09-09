import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import {
  IconArrowLeft,
  IconDownload,
  IconPlus,
  IconEdit,
  IconTrash,
  IconUpload,
  IconX,
  IconCheck,
  IconClock,
  IconCamera,
  IconChevronUp,
} from '@tabler/icons-react';

const Entries = () => {
  const { periodId, categoryId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const periodTitle = location.state?.periodTitle;
  const categoryName = location.state?.categoryName;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form toggle & states
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchEntries();
  }, [user, periodId, categoryId, navigate]);

  const handleDownloadCategoryDocx = async () => {
    setDownloading(true);
    try {
      const response = await api.get(
        `/periods/${periodId}/categories/${categoryId}/generate-docx`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = categoryName
        ? `${categoryName.replace(/\s+/g, '_')}_event.docx`
        : `category_${categoryId}_event.docx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download category docx:', err);
      alert('Failed to download category document.');
    } finally {
      setDownloading(false);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(
        `/entries/?period_id=${periodId}&category_id=${categoryId}`
      );
      setEntries(res.data);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      setError('Failed to load entries.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title) {
      setFormError('Title is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingEntryId) {
        // PUT update entry
        await api.put(`/entries/${editingEntryId}`, {
          title,
          description,
          updated_by: user.id,
        });
      } else {
        // POST create entry
        const res = await api.post('/entries/', {
          period_id: parseInt(periodId, 10),
          group_name: user.group_name,
          category_id: parseInt(categoryId, 10),
          title,
          description,
          display_order: entries.length,
          created_by: user.id,
        });

        // Upload initial photo if selected
        if (selectedFile && res.data && res.data.id) {
          const formData = new FormData();
          formData.append('entry_id', res.data.id);
          formData.append('uploaded_by', user.id);
          formData.append('display_order', 0);
          formData.append('file', selectedFile);

          try {
            await api.post('/photos/', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (photoErr) {
            console.error('Failed to upload initial photo:', photoErr);
            alert('Entry created, but photo upload failed.');
          }
        }
      }

      resetForm();
      fetchEntries();
    } catch (err) {
      console.error('Failed to save entry:', err);
      setFormError('Failed to save entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (entry) => {
    setEditingEntryId(entry.id);
    setTitle(entry.title || '');
    setDescription(entry.description || '');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFormError('');
    setShowForm(true);
  };

  const handleDeleteClick = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await api.delete(`/entries/${entryId}`);
      if (editingEntryId === entryId) {
        resetForm();
      }
      fetchEntries();
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Failed to delete entry.');
    }
  };

  const handleAddPhotoToEntry = async (entryId, file) => {
    if (!file) return;

    const entry = entries.find((e) => e.id === entryId);
    const displayOrder = entry && entry.photos ? entry.photos.length : 0;

    const formData = new FormData();
    formData.append('entry_id', entryId);
    formData.append('uploaded_by', user.id);
    formData.append('display_order', displayOrder);
    formData.append('file', file);

    try {
      await api.post('/photos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchEntries();
    } catch (err) {
      console.error('Failed to upload photo:', err);
      alert('Failed to upload photo.');
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      await api.delete(`/photos/${photoId}`);
      fetchEntries();
    } catch (err) {
      console.error('Failed to delete photo:', err);
      alert('Failed to delete photo.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setEditingEntryId(null);
    setFormError('');
    setShowForm(false);
  };

  if (!user) return null;

  return (
    <div className="entries-page">
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <button
          onClick={() =>
            navigate(`/categories/${periodId}`, {
              state: { periodTitle },
            })
          }
          className="btn-link-back"
          style={{ marginBottom: 0 }}
        >
          <IconArrowLeft size={18} />
          <span>Back to categories</span>
        </button>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              if (showForm && !editingEntryId) {
                setShowForm(false);
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="btn-primary"
          >
            {showForm ? <IconChevronUp size={18} /> : <IconPlus size={18} />}
            <span>{showForm ? 'Close Form' : 'Add New Entry'}</span>
          </button>

          <button
            onClick={handleDownloadCategoryDocx}
            className="btn-action-green"
            disabled={downloading}
          >
            <IconDownload size={18} />
            <span>{downloading ? 'Generating...' : 'Download (.docx)'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Form Card Section */}
      {showForm && (
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '22px 24px',
            marginBottom: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                color: 'var(--primary-btn)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0,
              }}
            >
              {editingEntryId ? <IconEdit size={20} /> : <IconPlus size={20} />}
              <span>{editingEntryId ? 'Edit Entry' : 'Create New Entry'}</span>
            </h3>
            <button
              type="button"
              onClick={resetForm}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
              }}
              title="Close form"
            >
              <IconX size={20} />
            </button>
          </div>

          {formError && <div className="error-message">{formError}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-heading)' }}>
                Title *
              </label>
              <input
                type="text"
                placeholder="Enter entry title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.95rem',
                  color: 'var(--text-body)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Description Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-heading)' }}>
                Description
              </label>
              <textarea
                rows="4"
                placeholder="Enter entry details / description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.95rem',
                  color: 'var(--text-body)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Photo Attachment (for new entries) */}
            {!editingEntryId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-heading)' }}>
                  Attach Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                />
                <div
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  style={{
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: 'fit-content',
                  }}
                >
                  <IconCamera size={20} style={{ color: 'var(--primary-btn)' }} />
                  <span style={{ fontSize: '0.88rem', color: 'var(--primary-btn)', fontWeight: '600' }}>
                    {selectedFile ? selectedFile.name : 'Choose Photo'}
                  </span>
                </div>
              </div>
            )}

            {/* Form Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {editingEntryId ? <IconCheck size={18} /> : <IconPlus size={18} />}
                <span>{submitting ? 'Saving...' : editingEntryId ? 'Update Entry' : 'Save Entry'}</span>
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Entries List Section */}
      <section className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>
            {categoryName ? `${categoryName} Entries` : 'Entries'}
          </h3>
          <span className="kanban-count-badge">{entries.length}</span>
        </div>

        {loading ? (
          <p className="loading-text">Loading entries...</p>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p className="empty-state" style={{ marginBottom: '16px' }}>
              No entries found for this category.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn-primary"
            >
              <IconPlus size={18} />
              <span>Add First Entry</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px 18px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.18s ease-in-out',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <h4
                    style={{
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: 'var(--text-heading)',
                      margin: 0,
                      lineHeight: '1.35',
                    }}
                  >
                    {entry.title}
                  </h4>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleEditClick(entry)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                      title="Edit entry"
                    >
                      <IconEdit size={15} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(entry.id)}
                      className="btn-ghost-danger"
                      style={{ padding: '4px 8px', border: 'none', fontSize: '0.78rem' }}
                      title="Delete entry"
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {entry.description && (
                  <p
                    style={{
                      color: 'var(--text-body)',
                      fontSize: '0.88rem',
                      lineHeight: '1.5',
                      marginTop: '8px',
                      marginBottom: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {entry.description}
                  </p>
                )}

                {/* Photos Grid */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                    {entry.photos &&
                      entry.photos.map((photo) => (
                        <div
                          key={photo.id}
                          style={{
                            position: 'relative',
                            width: '80px',
                            height: '80px',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={`http://${window.location.hostname || 'localhost'}:8000/${photo.file_path}`}
                            alt={photo.original_filename || 'Entry photo'}
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              display: 'block',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo.id)}
                            title="Delete photo"
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-4px',
                              width: '20px',
                              height: '20px',
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
                            <IconX size={12} />
                          </button>
                        </div>
                      ))}

                    {/* Inline Add Photo Button */}
                    <label
                      title="Upload photo"
                      style={{
                        width: '80px',
                        height: '80px',
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
                        fontSize: '0.72rem',
                        fontWeight: '600',
                      }}
                    >
                      <IconUpload size={16} />
                      <span>+ Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleAddPhotoToEntry(entry.id, e.target.files[0]);
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
                    gap: '6px',
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #f1f5f9',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                  }}
                >
                  <IconClock size={13} />
                  <span>
                    Updated by {entry.updated_by_name || `User #${entry.updated_by}`} on{' '}
                    {entry.updated_at
                      ? new Date(entry.updated_at).toLocaleString('en-US', {
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Entries;
