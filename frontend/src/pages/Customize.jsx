import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import Sidebar from '../components/Sidebar';

const Customize = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  // Tab inside Customize page: 'user' or 'stages'
  const [activeSection, setActiveSection] = useState('user');

  // Role Guard: Redirect non-GH users immediately
  useEffect(() => {
    if (!user) {
      navigate('/');
    } else if (user.role?.toLowerCase() !== 'gh') {
      navigate('/periods');
    }
  }, [user, navigate]);

  // Section A: User Form States
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDesignation, setUserDesignation] = useState('');
  const [userRole, setUserRole] = useState('scientist');
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userSuccessMsg, setUserSuccessMsg] = useState('');
  const [userErrorMsg, setUserErrorMsg] = useState('');

  // Section B: Category Stage States
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState('');

  // Add Stage Form States
  const [newCatName, setNewCatName] = useState('');
  const [newCatStage, setNewCatStage] = useState(0);
  const [catSubmitting, setCatSubmitting] = useState(false);

  // Edit Stage Inline States
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatStage, setEditCatStage] = useState(0);

  useEffect(() => {
    if (user && user.role?.toLowerCase() === 'gh') {
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    setCatLoading(true);
    setCatError('');
    try {
      const res = await api.get('/categories/');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCatError('Failed to load category stages.');
    } finally {
      setCatLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setUserSuccessMsg('');
    setUserErrorMsg('');

    if (!userName || !userEmail || !userPassword) {
      setUserErrorMsg('Name, Email, and Password are required.');
      return;
    }

    setUserSubmitting(true);
    try {
      await api.post('/users/', {
        name: userName,
        email: userEmail,
        password: userPassword,
        designation: userDesignation || null,
        role: userRole,
        center: user.center,
        group_name: user.group_name,
      });

      setUserSuccessMsg(`User "${userName}" created successfully!`);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserDesignation('');
      setUserRole('scientist');
    } catch (err) {
      console.error('Failed to add user:', err);
      const detail = err.response?.data?.detail;
      setUserErrorMsg(
        typeof detail === 'string' ? detail : 'Failed to create user.'
      );
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;

    setCatSubmitting(true);
    try {
      await api.post('/categories/', {
        name: newCatName,
        stage_number: parseInt(newCatStage, 10) || 0,
      });
      setNewCatName('');
      setNewCatStage(0);
      fetchCategories();
    } catch (err) {
      console.error('Failed to create stage:', err);
      alert('Failed to create category stage.');
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleStartEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatStage(cat.stage_number);
  };

  const handleSaveCategoryEdit = async (catId) => {
    try {
      await api.put(`/categories/${catId}`, {
        name: editCatName,
        stage_number: parseInt(editCatStage, 10) || 0,
      });
      setEditingCatId(null);
      fetchCategories();
    } catch (err) {
      console.error('Failed to update stage:', err);
      alert('Failed to update category stage.');
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Are you sure you want to delete this category stage?')) {
      return;
    }
    try {
      await api.delete(`/categories/${catId}`);
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete stage:', err);
      alert('Failed to delete category stage.');
    }
  };

  if (!user || user.role?.toLowerCase() !== 'gh') return null;

  return (
    <div className="dashboard-container">
      <Sidebar activePage="customize" />

      <main className="dashboard-main">
        <header className="header-bar" style={{ marginBottom: '24px' }}>
          <div>
            <h2>GH Customization Panel</h2>
            <span className="user-badge">
              Group: <strong>{user.group_name}</strong> | Center: <strong>{user.center}</strong>
            </span>
          </div>
          <div className="header-actions">
            <button
              className={`btn-action ${activeSection === 'user' ? 'edit-btn' : 'btn-secondary'}`}
              onClick={() => setActiveSection('user')}
            >
              👤 Add User
            </button>
            <button
              className={`btn-action ${activeSection === 'stages' ? 'edit-btn' : 'btn-secondary'}`}
              onClick={() => setActiveSection('stages')}
            >
              🏷️ Category Stages
            </button>
          </div>
        </header>

        {/* SECTION 1: ADD USER */}
        {activeSection === 'user' && (
          <section className="card-section">
            <h3>Add New User</h3>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              Create a new user. Center (<strong>{user.center}</strong>) and Group Name (<strong>{user.group_name}</strong>) are automatically locked to your group.
            </p>

            {userSuccessMsg && (
              <div className="success-message" style={{ color: '#16a34a', backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #bbf7d0', fontWeight: '600' }}>
                {userSuccessMsg}
              </div>
            )}
            {userErrorMsg && (
              <div className="error-message" style={{ color: '#dc2626', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #fecaca' }}>
                {userErrorMsg}
              </div>
            )}

            <form onSubmit={handleAddUser} className="vertical-form" style={{ maxWidth: '550px' }}>
              <div className="form-field">
                <label>Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. John Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Email *</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Password *</label>
                <input
                  type="password"
                  placeholder="Temporary password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Scientist B"
                  value={userDesignation}
                  onChange={(e) => setUserDesignation(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Role *</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                >
                  <option value="scientist">Scientist</option>
                  <option value="gh">Group Head (GH)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Center (Locked)</label>
                <input
                  type="text"
                  value={user.center || ''}
                  disabled
                  readOnly
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-field">
                <label>Group Name (Locked)</label>
                <input
                  type="text"
                  value={user.group_name || ''}
                  disabled
                  readOnly
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-buttons" style={{ marginTop: '10px' }}>
                <button type="submit" className="btn-primary" disabled={userSubmitting}>
                  {userSubmitting ? 'Creating User...' : 'Add User'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* SECTION 2: CATEGORY STAGES */}
        {activeSection === 'stages' && (
          <section className="card-section">
            <h3>Manage Category Stages</h3>
            <p className="section-subtitle" style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              Add, modify, or delete category stages.
            </p>

            {/* Add Category Stage Form */}
            <form
              onSubmit={handleAddCategory}
              className="horizontal-form"
              style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            >
              <div className="form-field">
                <label>Stage Name</label>
                <input
                  type="text"
                  placeholder="e.g. Workshop"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Stage Number</label>
                <input
                  type="number"
                  value={newCatStage}
                  onChange={(e) => setNewCatStage(e.target.value)}
                  required
                />
              </div>
              <div className="form-field form-field-btn">
                <button type="submit" className="btn-primary" disabled={catSubmitting}>
                  {catSubmitting ? 'Adding...' : 'Add Stage'}
                </button>
              </div>
            </form>

            {/* Categories Table */}
            {catLoading ? (
              <p className="loading-text">Loading stages...</p>
            ) : catError ? (
              <div className="error-message">{catError}</div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '12px' }}>Stage #</th>
                      <th style={{ padding: '12px' }}>Stage Name</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontWeight: '600' }}>
                          {editingCatId === cat.id ? (
                            <input
                              type="number"
                              style={{ width: '70px', padding: '6px' }}
                              value={editCatStage}
                              onChange={(e) => setEditCatStage(e.target.value)}
                            />
                          ) : (
                            `Stage ${cat.stage_number}`
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '1rem', color: '#1e293b' }}>
                          {editingCatId === cat.id ? (
                            <input
                              type="text"
                              style={{ padding: '6px' }}
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                            />
                          ) : (
                            cat.name
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={`status-badge ${cat.is_active ? 'active' : 'inactive'}`}>
                            {cat.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                          {editingCatId === cat.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveCategoryEdit(cat.id)}
                                className="btn-action edit-btn"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCatId(null)}
                                className="btn-secondary"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEditCategory(cat)}
                                className="btn-action edit-btn"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="btn-action delete-btn"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default Customize;
