import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import {
  IconArrowLeft,
  IconUserPlus,
  IconListNumbers,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconUsers,
  IconShield,
  IconBriefcase,
  IconBuilding,
  IconMail,
  IconLoader2,
  IconX,
  IconFolderPlus,
  IconAdjustments,
} from '@tabler/icons-react';

const Customize = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  // Role Guard: Redirect non-GH users immediately
  useEffect(() => {
    if (!user) {
      navigate('/');
    } else if (user.role?.toLowerCase() !== 'gh') {
      navigate('/periods');
    }
  }, [user, navigate]);

  // Active Tab: 'users' or 'categories'
  const [activeTab, setActiveTab] = useState('users');

  // Section A: User Form States
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDesignation, setUserDesignation] = useState('');
  const [userRoleSelect, setUserRoleSelect] = useState('scientist');
  const [customRoleText, setCustomRoleText] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userSuccessMsg, setUserSuccessMsg] = useState('');
  const [userErrorMsg, setUserErrorMsg] = useState('');

  // Group Users List state
  const [groupUsers, setGroupUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Section B: Category Stage States
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState('');

  // Add Stage Form States
  const [newCatName, setNewCatName] = useState('');
  const [newCatStage, setNewCatStage] = useState(1);
  const [catSubmitting, setCatSubmitting] = useState(false);

  // Edit Stage Inline States
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatStage, setEditCatStage] = useState(0);

  useEffect(() => {
    if (user && user.role?.toLowerCase() === 'gh') {
      fetchCategories();
      fetchGroupUsers();
    }
  }, [user]);

  const fetchGroupUsers = async () => {
    const userGroup = user?.group || user?.group_name;
    if (!userGroup) return;
    setUsersLoading(true);
    try {
      const res = await api.get(`/users/?group=${encodeURIComponent(userGroup)}`);
      setGroupUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch group users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCategories = async () => {
    setCatLoading(true);
    setCatError('');
    try {
      const res = await api.get('/categories/');
      setCategories(res.data);
      if (res.data && res.data.length > 0) {
        const maxStage = Math.max(...res.data.map((c) => c.stage_number || 0));
        setNewCatStage(maxStage + 1);
      }
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

    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      setUserErrorMsg('Full Name, Email, and Password are required.');
      return;
    }

    const effectiveRole =
      userRoleSelect === 'other'
        ? (customRoleText.trim() || 'scientist')
        : userRoleSelect;

    setUserSubmitting(true);
    try {
      await api.post('/users/', {
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword.trim(),
        designation: userDesignation.trim() || null,
        role: effectiveRole,
        center: user.center,
        group: user.group || user.group_name,
        group_name: user.group || user.group_name,
      });

      setUserSuccessMsg(`User "${userName.trim()}" (${formatRole(effectiveRole)}) created successfully!`);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserDesignation('');
      setUserRoleSelect('scientist');
      setCustomRoleText('');
      fetchGroupUsers();
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

  const handleDeleteUser = async (userId, name) => {
    if (userId === user.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove user "${name}"?`)) {
      return;
    }
    try {
      await api.delete(`/users/${userId}`);
      fetchGroupUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user.');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCatSubmitting(true);
    try {
      await api.post('/categories/', {
        name: newCatName.trim(),
        stage_number: parseInt(newCatStage, 10) || 0,
      });
      setNewCatName('');
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
    if (!editCatName.trim()) return;
    try {
      await api.put(`/categories/${catId}`, {
        name: editCatName.trim(),
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

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatRole = (role) => {
    if (!role) return 'Scientist';
    const lower = role.toLowerCase().trim();
    if (lower === 'gh') return 'Group Head (GH)';
    if (lower === 'scientist') return 'Scientist';
    if (lower === 'technical staff') return 'Technical Staff';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="customize-page">
      {/* 1. Back Navigation Button */}
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

      {/* 2. Admin Hero Banner */}
      <div className="admin-hero">
        <div className="admin-hero-title-group">
          <h2>
            <IconAdjustments size={26} style={{ color: '#2563eb' }} />
            <span>Admin & Configuration</span>
          </h2>
          <p>
            <span>Department:</span>
            <span className="group-badge-hero">
              <IconUsers size={13} />
              {user.group || user.group_name || 'General'}
            </span>
            <span>• Center:</span>
            <strong style={{ color: '#0f172a' }}>{user.center || 'Main'}</strong>
            <span>• Role:</span>
            <span className="detail-value role-badge role-gh">Group Head (GH)</span>
          </p>
        </div>

        {/* Live Counters */}
        <div className="periods-stats-strip">
          <div className="stat-pill">
            <div className="stat-pill-icon blue">
              <IconUsers size={18} />
            </div>
            <div className="stat-pill-info">
              <span className="stat-pill-count">{groupUsers.length}</span>
              <span className="stat-pill-label">Team Members</span>
            </div>
          </div>

          <div className="stat-pill">
            <div className="stat-pill-icon emerald">
              <IconListNumbers size={18} />
            </div>
            <div className="stat-pill-info">
              <span className="stat-pill-count">{categories.length}</span>
              <span className="stat-pill-label">Global Stages</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Section Switcher Tabs */}
      <div className="admin-tabs-nav">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <IconUserPlus size={18} />
          <span>Team Members & Accounts</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <IconListNumbers size={18} />
          <span>Category Stages</span>
        </button>
      </div>

      {/* 4. Tab 1: User & Account Management */}
      {activeTab === 'users' && (
        <div className="admin-grid-layout">
          {/* Left Form Card: Create User */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconUserPlus size={20} style={{ color: '#2563eb' }} />
                <span>Create Team Member</span>
              </h3>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '18px', marginTop: 0, lineHeight: '1.45' }}>
              Add a new user to your department. Department (<strong>{user.group || user.group_name}</strong>) and Center (<strong>{user.center}</strong>) are automatically assigned.
            </p>

            {userSuccessMsg && (
              <div className="success-message" style={{ marginBottom: '14px', fontSize: '0.84rem' }}>
                {userSuccessMsg}
              </div>
            )}
            {userErrorMsg && (
              <div className="error-message" style={{ marginBottom: '14px', fontSize: '0.84rem' }}>
                {userErrorMsg}
              </div>
            )}

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Full Name *</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Dr. Jane Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Address *</label>
                <input
                  type="email"
                  className="admin-input"
                  placeholder="name@cmti.res.in"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Initial Password *</label>
                <input
                  type="password"
                  className="admin-input"
                  placeholder="Set temporary password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Designation</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Scientist C, Project Associate, Senior Technician"
                  value={userDesignation}
                  onChange={(e) => setUserDesignation(e.target.value)}
                />
              </div>

              {/* Role Selection with Preset Dropdown + Custom Type Option */}
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <span>Account Role *</span>
                  {userRoleSelect === 'other' && (
                    <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: '600' }}>
                      (Custom Type)
                    </span>
                  )}
                </label>
                <select
                  className="admin-input"
                  value={userRoleSelect}
                  onChange={(e) => setUserRoleSelect(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="scientist">Scientist</option>
                  <option value="technical staff">Technical Staff</option>
                  <option value="gh">Group Head (GH)</option>
                  <option value="other">Other / Custom Role (Type below)...</option>
                </select>
              </div>

              {/* Custom Role Text Input when "other" is selected */}
              {userRoleSelect === 'other' && (
                <div
                  className="admin-form-group"
                  style={{
                    animation: 'profilePopIn 0.16s ease-out',
                    background: '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <label className="admin-form-label" style={{ color: '#1e40af' }}>
                    Specify Custom Role Name *
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Project Associate, Research Scholar, Lab Assistant"
                    value={customRoleText}
                    onChange={(e) => setCustomRoleText(e.target.value)}
                    required={userRoleSelect === 'other'}
                    autoFocus
                  />
                </div>
              )}

              {/* Quick Preset Selector Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '-4px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600' }}>
                  Quick Select:
                </span>
                {[
                  { id: 'scientist', label: 'Scientist' },
                  { id: 'technical staff', label: 'Technical Staff' },
                  { id: 'gh', label: 'Group Head' },
                  { id: 'other', label: 'Custom...' },
                ].map((rolePreset) => (
                  <button
                    key={rolePreset.id}
                    type="button"
                    onClick={() => setUserRoleSelect(rolePreset.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: userRoleSelect === rolePreset.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: userRoleSelect === rolePreset.id ? '#eff6ff' : '#ffffff',
                      color: userRoleSelect === rolePreset.id ? '#1d4ed8' : '#64748b',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {rolePreset.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Center</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={user.center || ''}
                    disabled
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Department</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={user.group || user.group_name || ''}
                    disabled
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={userSubmitting}
                  style={{
                    width: '100%',
                    padding: '11px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '8px',
                  }}
                >
                  {userSubmitting ? (
                    <>
                      <IconLoader2 size={18} className="animate-spin" />
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <>
                      <IconUserPlus size={18} />
                      <span>Create User Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Card: Existing Users List */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconUsers size={20} style={{ color: '#2563eb' }} />
                <span>Department Members ({groupUsers.length})</span>
              </h3>
            </div>

            {usersLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                <IconLoader2 size={24} className="animate-spin text-blue-600" />
                <p style={{ marginTop: '8px', fontSize: '0.88rem' }}>Loading users...</p>
              </div>
            ) : groupUsers.length === 0 ? (
              <p className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                No users found for this department.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Designation</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupUsers.map((u) => {
                      const isSelf = u.id === user.id;
                      const lowerRole = u.role?.toLowerCase()?.trim();
                      const isUserGh = lowerRole === 'gh';
                      const isUserTech = lowerRole === 'technical staff';
                      const isUserSci = lowerRole === 'scientist';

                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="user-avatar-mini">
                                {getInitials(u.name)}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.88rem' }}>
                                  {u.name} {isSelf && <span style={{ color: '#2563eb', fontSize: '0.75rem' }}>(You)</span>}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                              {u.designation || '—'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`detail-value role-badge ${isUserGh
                                ? 'role-gh'
                                : isUserTech
                                  ? 'role-tech'
                                  : isUserSci
                                    ? 'role-scientist'
                                    : ''
                                }`}
                            >
                              {formatRole(u.role)}
                            </span>
                          </td>
                          <td>
                            {!isSelf && (
                              <button
                                type="button"
                                className="action-icon-btn"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  color: '#dc2626',
                                  borderColor: '#fecaca',
                                  backgroundColor: '#fef2f2',
                                }}
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                title={`Delete ${u.name}`}
                              >
                                <IconTrash size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab 2: Category Stages Management */}
      {activeTab === 'categories' && (
        <div className="admin-grid-layout">
          {/* Left Form Card: Add Global Stage */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconFolderPlus size={20} style={{ color: '#2563eb' }} />
                <span>Add Global Stage</span>
              </h3>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '18px', marginTop: 0, lineHeight: '1.45' }}>
              Create standard category stages that will automatically appear across newsletter editions.
            </p>

            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Stage Name *</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Research Highlights, Patents, Workshops"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Stage Order / Sequence #</label>
                <input
                  type="number"
                  className="admin-input"
                  value={newCatStage}
                  onChange={(e) => setNewCatStage(e.target.value)}
                  min="0"
                  required
                />
              </div>

              <div style={{ marginTop: '8px' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={catSubmitting}
                  style={{
                    width: '100%',
                    padding: '11px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '8px',
                  }}
                >
                  {catSubmitting ? (
                    <>
                      <IconLoader2 size={18} className="animate-spin" />
                      <span>Adding Stage...</span>
                    </>
                  ) : (
                    <>
                      <IconPlus size={18} />
                      <span>Add Category Stage</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Card: Category Stages Table */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconListNumbers size={20} style={{ color: '#2563eb' }} />
                <span>Active Category Stages ({categories.length})</span>
              </h3>
            </div>

            {catLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                <IconLoader2 size={24} className="animate-spin text-blue-600" />
                <p style={{ marginTop: '8px', fontSize: '0.88rem' }}>Loading stages...</p>
              </div>
            ) : catError ? (
              <div className="error-message">{catError}</div>
            ) : categories.length === 0 ? (
              <p className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                No category stages defined.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>Order</th>
                      <th>Stage Name</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id}>
                        <td>
                          {editingCatId === cat.id ? (
                            <input
                              type="number"
                              className="admin-input"
                              style={{ width: '60px', padding: '4px 6px', fontSize: '0.82rem' }}
                              value={editCatStage}
                              onChange={(e) => setEditCatStage(e.target.value)}
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: '700',
                                color: '#1e40af',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              #{cat.stage_number}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingCatId === cat.id ? (
                            <input
                              type="text"
                              className="admin-input"
                              style={{ padding: '4px 8px', fontSize: '0.86rem' }}
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                            />
                          ) : (
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>
                              {cat.name}
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={cat.period_id ? 'category-badge-custom' : 'status-badge active'}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {cat.period_id ? 'Custom' : 'Global Standard'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {editingCatId === cat.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveCategoryEdit(cat.id)}
                                  className="action-icon-btn"
                                  style={{
                                    width: '30px',
                                    height: '30px',
                                    color: '#059669',
                                    borderColor: '#a7f3d0',
                                    backgroundColor: '#ecfdf5',
                                  }}
                                  title="Save stage changes"
                                >
                                  <IconCheck size={15} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCatId(null)}
                                  className="action-icon-btn"
                                  style={{ width: '30px', height: '30px' }}
                                  title="Cancel edit"
                                >
                                  <IconX size={15} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCategory(cat)}
                                  className="action-icon-btn"
                                  style={{
                                    width: '30px',
                                    height: '30px',
                                    color: '#2563eb',
                                    borderColor: '#bfdbfe',
                                    backgroundColor: '#eff6ff',
                                  }}
                                  title="Edit category stage"
                                >
                                  <IconEdit size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="action-icon-btn"
                                  style={{
                                    width: '30px',
                                    height: '30px',
                                    color: '#dc2626',
                                    borderColor: '#fecaca',
                                    backgroundColor: '#fef2f2',
                                  }}
                                  title="Delete category stage"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Customize;
