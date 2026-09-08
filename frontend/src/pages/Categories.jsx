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

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchCategories();
  }, [user, navigate]);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/categories/');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError('Failed to load categories.');
    } finally {
      setLoading(false);
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
          ) : categories.length === 0 ? (
            <p className="empty-state">No categories available.</p>
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
                  <h4>{category.name}</h4>
                  <span className="stage-tag">Stage {category.stage_number}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Categories;
