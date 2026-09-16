import React, { useState, useEffect, useMemo } from 'react';
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
  IconBuilding,
  IconMail,
  IconLoader2,
  IconX,
  IconFilter,
  IconAdjustments,
  IconRotateClockwise,
  IconFolderPlus,
} from '@tabler/icons-react';

const Customize = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isGhUser = user?.role?.toLowerCase() === 'gh';

  // Role Guard: Redirect non-GH and non-Admin users immediately
  useEffect(() => {
    if (!user) {
      navigate('/');
    } else if (!isAdmin && !isGhUser) {
      navigate('/periods');
    }
  }, [user, isAdmin, isGhUser, navigate]);

  // Active Tab: 'users' | 'categories' | 'directory'
  const [activeTab, setActiveTab] = useState('users');

  // Section A: User Form States
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDesignation, setUserDesignation] = useState('');
  const [userRoleSelect, setUserRoleSelect] = useState('scientist');
  const [customRoleText, setCustomRoleText] = useState('');
  const [adminUserCenter, setAdminUserCenter] = useState('');
  const [adminUserGroup, setAdminUserGroup] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userSuccessMsg, setUserSuccessMsg] = useState('');
  const [userErrorMsg, setUserErrorMsg] = useState('');

  // Admin Oversight: Centers, CHs & Filters
  const [allCenters, setAllCenters] = useState([]);
  const [allChs, setAllChs] = useState([]);
  const [filterCenter, setFilterCenter] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  // Users List state
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
    if (user && (isAdmin || isGhUser)) {
      fetchCategories();
      fetchUsers('all', 'all');
      if (isAdmin) {
        fetchAdminMeta();
      }
    }
  }, [user, isAdmin, isGhUser]);

  const fetchAdminMeta = async () => {
    try {
      const [cRes, chRes] = await Promise.all([
        api.get('/users/centers/list'),
        api.get('/users/chs/list'),
      ]);
      const centers = cRes.data || [];
      setAllCenters(centers);
      setAllChs(chRes.data || []);
      if (centers.length > 0 && !adminUserCenter) {
        setAdminUserCenter(centers[0]);
      }
    } catch (err) {
      console.error('Failed to fetch admin metadata:', err);
    }
  };

  const chMapByCenter = useMemo(() => {
    const map = {};
    allChs.forEach((ch) => {
      if (ch.center) map[ch.center] = ch;
    });
    return map;
  }, [allChs]);

  const fetchUsers = async (center = filterCenter, role = filterRole) => {
    setUsersLoading(true);
    try {
      if (isAdmin) {
        let url = '/users/?';
        const params = [];
        if (center && center !== 'all') {
          params.push(`center=${encodeURIComponent(center)}`);
        }
        if (role && role !== 'all') {
          params.push(`role=${encodeURIComponent(role)}`);
        }
        url += params.join('&');
        const res = await api.get(url);
        setGroupUsers(res.data || []);
      } else {
        const userGroup = user?.group || user?.group_name;
        if (!userGroup) return;
        const res = await api.get(`/users/?group=${encodeURIComponent(userGroup)}`);
        setGroupUsers(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCategories = async () => {
    setCatLoading(true);
    setCatError('');
    try {
      const res = await api.get('/categories/');
      setCategories(res.data || []);
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

    const assignedCenter = isAdmin
      ? (adminUserCenter.trim() || user.center || 'Main')
      : user.center;

    const assignedGroup = isAdmin
      ? (adminUserGroup.trim() || 'General')
      : (user.group || user.group_name || 'General');

    setUserSubmitting(true);
    try {
      await api.post('/users/', {
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword.trim(),
        designation: userDesignation.trim() || null,
        role: effectiveRole,
        center: assignedCenter,
        group: assignedGroup,
        group_name: assignedGroup,
      });

      setUserSuccessMsg(`User "${userName.trim()}" (${formatRole(effectiveRole)}) created successfully!`);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserDesignation('');
      setUserRoleSelect('scientist');
      setCustomRoleText('');
      if (isAdmin) {
        setAdminUserGroup('');
      }
      fetchUsers(filterCenter, filterRole);
      if (isAdmin) {
        fetchAdminMeta();
      }
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
      fetchUsers(filterCenter, filterRole);
      if (isAdmin) {
        fetchAdminMeta();
      }
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

  if (!user || (!isAdmin && !isGhUser)) return null;

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatRole = (role) => {
    if (!role) return 'Scientist';
    const lower = role.toLowerCase().trim();
    if (lower === 'admin') return 'System Administrator';
    if (lower === 'ch') return 'Centre Head (CH)';
    if (lower === 'gh') return 'Group Head (GH)';
    if (lower === 'scientist') return 'Scientist';
    if (lower === 'technical staff') return 'Technical Staff';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleBadgeClass = (role) => {
    if (!role) return 'role-scientist';
    const lower = role.toLowerCase().trim();
    if (lower === 'admin') return 'role-admin';
    if (lower === 'ch') return 'role-ch';
    if (lower === 'gh') return 'role-gh';
    if (lower === 'technical staff') return 'role-tech';
    return 'role-scientist';
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
            <span>{isAdmin ? 'System Administration & Configuration' : 'Admin & Configuration'}</span>
          </h2>
          <p>
            {isAdmin ? (
              <>
                <span className="role-badge role-admin" style={{ padding: '3px 10px', fontSize: '0.78rem' }}>
                  <IconShield size={14} />
                  System Administrator
                </span>
                <span style={{ color: '#2563eb', fontWeight: '700' }}>• Institutional Oversight</span>
                <span>• Managing users, centers, leadership, and global category stages</span>
              </>
            ) : (
              <>
                <span>Department:</span>
                <span className="group-badge-hero">
                  <IconUsers size={13} />
                  {user.group || user.group_name || 'General'}
                </span>
                <span>• Center:</span>
                <strong style={{ color: '#0f172a' }}>{user.center || 'Main'}</strong>
                <span>• Role:</span>
                <span className="detail-value role-badge role-gh">Group Head (GH)</span>
              </>
            )}
          </p>
        </div>

        {/* Live Counters */}
        <div className="periods-stats-strip">
          {isAdmin && (
            <div className="stat-pill">
              <div className="stat-pill-icon blue" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <IconBuilding size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{allCenters.length}</span>
                <span className="stat-pill-label">Centers</span>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="stat-pill">
              <div className="stat-pill-icon amber" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                <IconShield size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{allChs.length}</span>
                <span className="stat-pill-label">Centre Heads</span>
              </div>
            </div>
          )}

          <div className="stat-pill">
            <div className="stat-pill-icon blue">
              <IconUsers size={18} />
            </div>
            <div className="stat-pill-info">
              <span className="stat-pill-count">{groupUsers.length}</span>
              <span className="stat-pill-label">{isAdmin ? 'Total Users' : 'Team Members'}</span>
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
          <span>{isAdmin ? 'User Management & Roles' : 'Team Members & Accounts'}</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <IconListNumbers size={18} />
          <span>Category Stages</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setActiveTab('directory')}
          >
            <IconBuilding size={18} />
            <span>Centers & Leadership Directory</span>
          </button>
        )}
      </div>

      {/* 4. Tab 1: User & Account Management */}
      {activeTab === 'users' && (
        <div className="admin-grid-layout">
          {/* Left Form Card: Create User */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconUserPlus size={20} style={{ color: '#2563eb' }} />
                <span>{isAdmin ? 'Create User Account (Any Role / Center)' : 'Create Team Member'}</span>
              </h3>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '18px', marginTop: 0, lineHeight: '1.45' }}>
              {isAdmin
                ? 'Create a new user account and assign them to any Center, Department, and institutional Role (Centre Head, Group Head, Scientist, Staff, Admin).'
                : <>Add a new user to your department. Department (<strong>{user.group || user.group_name}</strong>) and Center (<strong>{user.center}</strong>) are automatically assigned.</>}
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
                  placeholder="e.g. Scientist C, Centre Head, Project Associate"
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
                  {isAdmin && <option value="ch">Centre Head (CH)</option>}
                  {isAdmin && <option value="admin">System Administrator</option>}
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
                  ...(isAdmin ? [{ id: 'ch', label: 'Centre Head (CH)' }, { id: 'admin', label: 'Admin' }] : []),
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
                  <label className="admin-form-label">Center *</label>
                  {isAdmin ? (
                    <input
                      type="text"
                      className="admin-input"
                      list="admin-center-datalist"
                      placeholder="e.g. Main, Manufacturing, Automation"
                      value={adminUserCenter}
                      onChange={(e) => setAdminUserCenter(e.target.value)}
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      className="admin-input"
                      value={user.center || ''}
                      disabled
                    />
                  )}
                  {isAdmin && (
                    <datalist id="admin-center-datalist">
                      {allCenters.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  )}
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Department *</label>
                  {isAdmin ? (
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="e.g. Design, Electronics, Materials"
                      value={adminUserGroup}
                      onChange={(e) => setAdminUserGroup(e.target.value)}
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      className="admin-input"
                      value={user.group || user.group_name || ''}
                      disabled
                    />
                  )}
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
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
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
            <div className="admin-card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <h3 className="admin-card-title">
                <IconUsers size={20} style={{ color: '#2563eb' }} />
                <span>{isAdmin ? `All Users (${groupUsers.length})` : `Department Members (${groupUsers.length})`}</span>
              </h3>

              {/* Admin Multi-Center & Role Filter Controls */}
              {isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <IconFilter size={14} style={{ color: '#64748b' }} />
                    <select
                      value={filterCenter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilterCenter(val);
                        fetchUsers(val, filterRole);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        color: '#1e293b',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value="all">All Centers ({allCenters.length})</option>
                      {allCenters.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={filterRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterRole(val);
                      fetchUsers(filterCenter, val);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      color: '#1e293b',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="all">All Roles</option>
                    <option value="ch">Centre Head (CH)</option>
                    <option value="gh">Group Head (GH)</option>
                    <option value="scientist">Scientist</option>
                    <option value="technical staff">Technical Staff</option>
                    <option value="admin">Administrator</option>
                  </select>

                  {(filterCenter !== 'all' || filterRole !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCenter('all');
                        setFilterRole('all');
                        fetchUsers('all', 'all');
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        fontWeight: '600',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <IconRotateClockwise size={12} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {usersLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                <IconLoader2 size={24} className="animate-spin text-blue-600" />
                <p style={{ marginTop: '8px', fontSize: '0.88rem' }}>Loading users...</p>
              </div>
            ) : groupUsers.length === 0 ? (
              <p className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                No users found for this filter selection.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Designation</th>
                      <th>Role</th>
                      {isAdmin && <th>Center</th>}
                      {isAdmin && <th>Department</th>}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupUsers.map((u) => {
                      const isSelf = u.id === user.id;

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
                            <span className={`detail-value role-badge ${getRoleBadgeClass(u.role)}`}>
                              {formatRole(u.role)}
                            </span>
                          </td>
                          {isAdmin && (
                            <td>
                              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#1e293b' }}>
                                {u.center || '—'}
                              </span>
                            </td>
                          )}
                          {isAdmin && (
                            <td>
                              <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                                {u.group || u.group_name || '—'}
                              </span>
                            </td>
                          )}
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

      {/* 6. Tab 3: Centers & Leadership Directory (Admin Only) */}
      {isAdmin && activeTab === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                  Institutional Centers & Assigned Centre Heads
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                  Overview of all {allCenters.length} active centers in CMTI and their respective leadership assignments.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  color: '#2563eb',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  padding: '4px 12px',
                  borderRadius: '16px',
                }}
              >
                {allChs.length} Centre Heads Active
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
              {allCenters.map((cName) => {
                const chUser = chMapByCenter[cName];
                const centerMembers = groupUsers.filter((u) => u.center === cName);
                const distinctDepts = new Set(
                  groupUsers
                    .filter((u) => u.center === cName && (u.group || u.group_name))
                    .map((u) => (u.group || u.group_name).trim())
                );

                return (
                  <div
                    key={cName}
                    style={{
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconBuilding size={20} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>
                            {cName}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Center
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: '700',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {distinctDepts.size} {distinctDepts.size === 1 ? 'Dept' : 'Depts'}
                      </span>
                    </div>

                    {/* Centre Head Box */}
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                        Centre Head (CH)
                      </span>
                      {chUser ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: '#fffbeb',
                              color: '#b45309',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.74rem',
                              fontWeight: '700',
                              border: '1px solid #fde68a',
                            }}
                          >
                            {getInitials(chUser.name)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '0.84rem', color: '#0f172a' }}>
                              {chUser.name}
                            </strong>
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              {chUser.email}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          ⚠️ No Centre Head assigned to this center
                        </span>
                      )}
                    </div>

                    {/* Quick Filter Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCenter(cName);
                        setActiveTab('users');
                        fetchUsers(cName, filterRole);
                      }}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <IconUsers size={14} />
                      <span>View Center Members ({centerMembers.length})</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customize;
