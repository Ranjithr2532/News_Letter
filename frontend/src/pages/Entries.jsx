import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';

const Entries = () => {
  const { periodId, categoryId } = useParams();
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const periodTitle = location.state?.periodTitle;
  const categoryName = location.state?.categoryName;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchEntries();
  }, [user, periodId, categoryId, navigate]);

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

        // If a file was selected, upload it for the newly created entry
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

  // Upload an additional photo to an existing entry
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

  // Delete a photo
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
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="page-container">
      <header className="header-bar">
        <div>
          <button
            onClick={() =>
              navigate(`/categories/${periodId}`, {
                state: { periodTitle },
              })
            }
            className="btn-link"
          >
            &larr; Back to Categories
          </button>
          <h2>Entries</h2>
          <span className="user-badge">
            {categoryName ? `Category: ${categoryName}` : `Category ID: ${categoryId}`}{' '}
            {periodTitle ? `| Period: ${periodTitle}` : `| Period ID: ${periodId}`}
          </span>
        </div>
        <button onClick={handleLogout} className="btn-secondary">
          Logout
        </button>
      </header>

      <main className="content">
        {/* Entries List */}
        <section className="card-section">
          <h3>Existing Entries</h3>
          {loading ? (
            <p className="loading-text">Loading entries...</p>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : entries.length === 0 ? (
            <p className="empty-state">No entries yet — add one below</p>
          ) : (
            <div className="entries-list">
              {entries.map((entry) => (
                <div key={entry.id} className="entry-card">
                  <div className="entry-header">
                    <h4>{entry.title}</h4>
                    <div className="entry-actions">
                      <button
                        onClick={() => handleEditClick(entry)}
                        className="btn-action edit-btn"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(entry.id)}
                        className="btn-action delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {entry.description && (
                    <p className="entry-description">{entry.description}</p>
                  )}

                  {/* Photos Section on Entry Card */}
                  <div className="photos-section">
                    <div className="photos-grid">
                      {entry.photos &&
                        entry.photos.map((photo) => (
                          <div key={photo.id} className="photo-thumbnail-wrapper">
                            <img
                              src={`http://localhost:8000/${photo.file_path}`}
                              alt={photo.original_filename || 'Entry photo'}
                              className="photo-thumbnail"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="photo-delete-btn"
                              title="Delete photo"
                            >
                              &times;
                            </button>
                          </div>
                        ))}

                      {/* Add Photo Button for Existing Entry */}
                      <label className="add-photo-label" title="Upload additional photo">
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

                  {/* Last Updated Metadata */}
                  <div className="entry-meta">
                    Last updated by User #{entry.updated_by ?? entry.created_by} on{' '}
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add / Edit Entry Form */}
        <section className="card-section">
          <h3>{editingEntryId ? 'Edit Entry' : 'Add New Entry'}</h3>
          {formError && <div className="error-message">{formError}</div>}
          <form onSubmit={handleSubmit} className="vertical-form">
            <div className="form-field">
              <label>Title</label>
              <input
                type="text"
                placeholder="Entry title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Description</label>
              <textarea
                rows="4"
                placeholder="Entry details / description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {!editingEntryId && (
              <div className="form-field">
                <label>Photo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) =>
                    setSelectedFile(e.target.files ? e.target.files[0] : null)
                  }
                />
              </div>
            )}

            <div className="form-buttons">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting
                  ? 'Saving...'
                  : editingEntryId
                  ? 'Update Entry'
                  : 'Add Entry'}
              </button>
              {editingEntryId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Entries;
