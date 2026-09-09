import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';

const Categories = () => {
  const { periodId } = useParams();
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const periodTitle = location.state?.periodTitle;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="page-container">
      <header className="header-bar">
        <div>
          <button onClick={() => navigate('/periods')} className="btn-link">
            &larr; Back to Periods
          </button>
          <h2>Categories</h2>
          <span className="user-badge">
            {periodTitle ? `Period: ${periodTitle}` : `Period ID: ${periodId}`}
          </span>
        </div>
        <div className="header-actions">
          {user.role?.toLowerCase() === 'gh' && (
            <button
              onClick={() => navigate('/admin')}
              className="btn-primary"
            >
              Admin Panel
            </button>
          )}
          <button
            onClick={handleDownload}
            className="btn-download"
            disabled={downloading}
          >
            {downloading ? 'Generating...' : 'Download Newsletter (.docx)'}
          </button>
          <button onClick={handleLogout} className="btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <main className="content">
        <section className="card-section">
          <h3>Select a Category</h3>
          {loading ? (
            <p className="loading-text">Loading categories...</p>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <div className="grid-list">
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
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0 }}>{category.name}</h4>
                    {category.period_id && (
                      <button
                        className="btn-action delete-btn"
                        onClick={(e) => handleDeleteCustomCategory(e, category.id)}
                        title="Delete custom category"
                        style={{ marginLeft: '8px' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="stage-tag">
                      {category.period_id ? 'Custom (This Period)' : `Stage ${category.stage_number}`}
                    </span>
                  </div>
                </div>
              ))}

              {/* "Other Category" Card */}
              <div
                className="clickable-card add-other-card"
                onClick={() => {
                  setOtherTitle('');
                  setOtherError('');
                  setShowOtherModal(true);
                }}
                style={{
                  border: '2px dashed #94a3b8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '110px',
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.8rem', color: '#2563eb', fontWeight: 'bold', lineHeight: '1' }}>
                  +
                </div>
                <h4 style={{ margin: '6px 0 0 0', color: '#1e293b' }}>Other</h4>
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Add title for this period
                </span>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal for adding custom "Other" category */}
      {showOtherModal && (
        <div className="modal-backdrop" onClick={() => setShowOtherModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add Custom Category for this Period</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.2rem' }}>
              This category will be created <strong>only for this period</strong> and will not be added to standard categories.
            </p>
            {otherError && <div className="error-message">{otherError}</div>}
            <form onSubmit={handleAddOtherCategory}>
              <div className="form-field" style={{ marginBottom: '1.2rem' }}>
                <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                  Category Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special Workshop, Guest Lecture, Exhibition"
                  value={otherTitle}
                  onChange={(e) => setOtherTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-buttons" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
