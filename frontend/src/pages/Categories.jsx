import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import {
  IconArrowLeft,
  IconDownload,
  IconPlus,
  IconTrash,
  IconFolder,
  IconChevronRight,
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

  // Other Category Modal state
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
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category.');
    }
  };

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
      {/* Top Header Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate('/periods')} className="btn-link-back">
          <IconArrowLeft size={18} />
          <span>Back to newsletters</span>
        </button>

        <button
          onClick={handleDownload}
          className="btn-action-green"
          disabled={downloading}
        >
          <IconDownload size={18} />
          <span>{downloading ? 'Generating...' : 'Download Newsletter (.docx)'}</span>
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
        <h3>Categories</h3>
        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.4rem', marginTop: '-0.5rem' }}>
          Select a category to view or add entry details for this newsletter period.
        </p>

        {loading ? (
          <p className="loading-text">Loading categories...</p>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              alignContent: 'start',
            }}
          >
            {categories.map((category) => (
              <div
                key={category.id}
                className="clickable-card"
                onClick={() =>
                  navigate(`/entries/${periodId}/${category.id}`, {
                    state: {
                      categoryName: category.name,
                      periodTitle,
                    },
                  })
                }
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px 18px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease-in-out',
                  minHeight: '76px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                    {category.period_id && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '500' }}>
                        Custom Category
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                    onClick={(e) => handleDownloadCategoryDocx(e, category)}
                    title={`Download ${category.name} docx`}
                    disabled={downloadingCategoryId === category.id}
                  >
                    <IconDownload size={14} />
                  </button>

                  {category.period_id && (
                    <button
                      className="btn-ghost-danger"
                      style={{ padding: '4px 6px', border: 'none' }}
                      onClick={(e) => handleDeleteCustomCategory(e, category.id)}
                      title="Delete custom category"
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                  <IconChevronRight size={18} style={{ color: '#94a3b8' }} />
                </div>
              </div>
            ))}

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
            <h3 style={{ marginTop: 0 }}>Add Custom Category for this Newsletter</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.2rem' }}>
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
              <div className="form-buttons" style={{ justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowOtherModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creatingOther}>
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
