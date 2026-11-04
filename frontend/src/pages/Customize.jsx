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
  IconAlertTriangle,
  IconSearch,
} from '@tabler/icons-react';

const Customize = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const currentRole = (user?.activeRole || user?.role || '').toLowerCase().trim();
  const isEditor = currentRole === 'edit' || currentRole === 'editor';
  const isAdmin = currentRole === 'admin';
  const isGhUser = currentRole === 'gh';
  const hasAdminAccess = isAdmin || isEditor;

  // When editor logs in, default role select to GH if previously scientist
  useEffect(() => {
    if (isEditor && (userRoleSelect === 'scientist' || userRoleSelect === 'technical staff')) {
      setUserRoleSelect('gh');
    }
  }, [isEditor]);

  // Role Guard: Redirect non-GH and non-Admin/Editor users immediately
  useEffect(() => {
    if (!user) {
      navigate('/');
    } else if (!hasAdminAccess && !isGhUser) {
      navigate('/periods');
    }
  }, [user, hasAdminAccess, isGhUser, navigate]);

  // Active Tab: 'users' | 'categories' | 'directory'
  const [activeTab, setActiveTab] = useState('users');

  // Ensure GH cannot stay on categories or directory tabs
  useEffect(() => {
    if (isGhUser && activeTab !== 'users') {
      setActiveTab('users');
    }
  }, [isGhUser, activeTab]);

  // Section A: User Form States
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDesignation, setUserDesignation] = useState('');
  const [userRoleSelect, setUserRoleSelect] = useState(() => (isEditor ? 'gh' : 'scientist'));
  const [customRoleText, setCustomRoleText] = useState('');
  const [adminUserCenter, setAdminUserCenter] = useState('');
  const [isCustomCenter, setIsCustomCenter] = useState(false);
  const [adminUserGroup, setAdminUserGroup] = useState('');
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  const [availableCenterGroups, setAvailableCenterGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userSuccessMsg, setUserSuccessMsg] = useState('');
  const [userErrorMsg, setUserErrorMsg] = useState('');

  // Admin / Editor Oversight: Centers, CHs & Filters
  const [allCenters, setAllCenters] = useState([]);
  const [allChs, setAllChs] = useState([]);
  const [filterCenter, setFilterCenter] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  // Users List & Pagination state
  const [groupUsers, setGroupUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Edit User Modal States
  const [editingUser, setEditingUser] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserDesignation, setEditUserDesignation] = useState('');
  const [editUserRoleSelect, setEditUserRoleSelect] = useState('scientist');
  const [editCustomRoleText, setEditCustomRoleText] = useState('');
  const [editUserCenter, setEditUserCenter] = useState('');
  const [editIsCustomCenter, setEditIsCustomCenter] = useState(false);
  const [editUserGroup, setEditUserGroup] = useState('');
  const [editIsCustomGroup, setEditIsCustomGroup] = useState(false);
  const [editAvailableGroups, setEditAvailableGroups] = useState([]);
  const [editLoadingGroups, setEditLoadingGroups] = useState(false);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  // React Confirmation Modal state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Yes, Delete',
    cancelText: 'No, Cancel',
    onConfirm: null,
  });

  const openConfirmDialog = ({ title, message, confirmText = 'Yes, Delete', cancelText = 'No, Cancel', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title: title || 'Are you sure?',
      message: message || 'Are you sure you want to proceed?',
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  useEffect(() => {
    if (user) {
      if (isAdmin || isEditor) {
        fetchCategories();
        fetchAdminMeta();
        fetchUsers('all', 'all');
      } else if (isGhUser) {
        fetchUsers();
      }
    }
  }, [user, isAdmin, isGhUser, isEditor]);

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
        setLoadingGroups(true);
        api
          .get(`/users/groups/list?center=${encodeURIComponent(centers[0])}`)
          .then((gRes) => {
            const grps = gRes.data || [];
            setAvailableCenterGroups(grps);
            if (grps.length > 0 && !adminUserGroup) {
              setAdminUserGroup(grps[0]);
            }
          })
          .catch(() => setAvailableCenterGroups([]))
          .finally(() => setLoadingGroups(false));
      }
    } catch (err) {
      console.error('Failed to fetch admin metadata:', err);
    }
  };


  const handleCenterChange = (cVal) => {
    if (cVal === '__other__') {
      setIsCustomCenter(true);
      setAdminUserCenter('');
      setAvailableCenterGroups([]);
      setIsCustomGroup(true);
      setAdminUserGroup('');
    } else {
      setIsCustomCenter(false);
      setAdminUserCenter(cVal);
      setIsCustomGroup(false);
      if (cVal) {
        setLoadingGroups(true);
        api
          .get(`/users/groups/list?center=${encodeURIComponent(cVal)}`)
          .then((res) => {
            const grps = res.data || [];
            setAvailableCenterGroups(grps);
            if (grps.length > 0) {
              setAdminUserGroup(grps[0]);
            } else {
              setAdminUserGroup('');
              setIsCustomGroup(true);
            }
          })
          .catch(() => {
            setAvailableCenterGroups([]);
            setIsCustomGroup(true);
          })
          .finally(() => setLoadingGroups(false));
      } else {
        setAvailableCenterGroups([]);
        setAdminUserGroup('');
      }
    }
  };

  const handleEditCenterChange = (cVal) => {
    if (cVal === '__other__') {
      setEditIsCustomCenter(true);
      setEditUserCenter('');
      setEditAvailableGroups([]);
      setEditIsCustomGroup(true);
      setEditUserGroup('');
    } else {
      setEditIsCustomCenter(false);
      setEditUserCenter(cVal);
      setEditIsCustomGroup(false);
      if (cVal) {
        setEditLoadingGroups(true);
        api
          .get(`/users/groups/list?center=${encodeURIComponent(cVal)}`)
          .then((res) => {
            const grps = res.data || [];
            setEditAvailableGroups(grps);
            if (grps.length > 0 && !grps.includes(editUserGroup)) {
              setEditUserGroup(grps[0]);
            }
          })
          .catch(() => setEditAvailableGroups([]))
          .finally(() => setEditLoadingGroups(false));
      } else {
        setEditAvailableGroups([]);
      }
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
    setUserPage(1);
    try {
      if (isAdmin || isEditor) {
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

  // Client-side search & role filtering on current group users
  const filteredUsers = useMemo(() => {
    let list = groupUsers;

    if (filterRole && filterRole !== 'all') {
      const fr = filterRole.toLowerCase().trim();
      list = list.filter((u) => {
        const r = (u.role || '').toLowerCase().trim();
        if (fr === 'joint director' || fr === 'jd') {
          const des = (u.designation || '').toLowerCase().trim();
          return (
            r.includes('joint director') ||
            r.includes('jd') ||
            des.includes('joint director') ||
            des.includes('jd')
          );
        }
        if (fr === 'ch') {
          return (
            !r.includes('tech') &&
            (r.includes('centre head') ||
              r.includes('center head') ||
              r === 'ch' ||
              r.includes('ch,') ||
              r.includes(', ch') ||
              r.includes('ch/') ||
              r.includes('/ ch') ||
              r.includes('(ch)'))
          );
        }
        if (fr === 'gh') {
          return (
            r.includes('group head') ||
            r === 'gh' ||
            r.includes('gh,') ||
            r.includes(', gh') ||
            r.includes('gh/') ||
            r.includes('/ gh') ||
            r.includes('(gh)')
          );
        }
        if (fr === 'edit' || fr === 'editor') {
          return r.includes('edit');
        }
        if (fr === 'scientist') {
          return r.includes('scientist');
        }
        if (fr === 'technical staff' || fr === 'tech') {
          return r.includes('tech');
        }
        if (fr === 'admin') {
          return r.includes('admin');
        }
        return r.includes(fr);
      });
    }

    if (!userSearchQuery.trim()) return list;
    const q = userSearchQuery.trim().toLowerCase();
    return list.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const desig = (u.designation || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const center = (u.center || '').toLowerCase();
      const group = (u.group || u.group_name || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        desig.includes(q) ||
        role.includes(q) ||
        center.includes(q) ||
        group.includes(q)
      );
    });
  }, [groupUsers, filterRole, userSearchQuery]);

  // Pagination calculation
  const totalUserCount = filteredUsers.length;
  const totalUserPages = Math.ceil(totalUserCount / pageSize) || 1;

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(1);
    }
  }, [userPage, totalUserPages]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, userPage, pageSize]);

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

    const assignedCenter = (isAdmin || isEditor)
      ? (adminUserCenter.trim() || user.center || 'Main')
      : user.center;

    const assignedGroup = (isAdmin || isEditor)
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
      setUserRoleSelect(isEditor ? 'gh' : 'scientist');
      setCustomRoleText('');
      setIsCustomCenter(false);
      setIsCustomGroup(false);
      if (isAdmin || isEditor) {
        if (allCenters.length > 0) {
          setAdminUserCenter(allCenters[0]);
          api
            .get(`/users/groups/list?center=${encodeURIComponent(allCenters[0])}`)
            .then((res) => {
              const grps = res.data || [];
              setAvailableCenterGroups(grps);
              if (grps.length > 0) setAdminUserGroup(grps[0]);
            })
            .catch(() => {});
        } else {
          setAdminUserCenter('');
          setAdminUserGroup('');
        }
      }
      fetchUsers(filterCenter, filterRole);
      if (isAdmin || isEditor) {
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

  // Open Edit User Modal
  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setEditUserName(u.name || '');
    setEditUserEmail(u.email || '');
    setEditUserDesignation(u.designation || '');
    const standardRoles = ['scientist', 'technical staff', 'gh', 'ch', 'joint director', 'jd', 'edit', 'editor', 'admin'];
    const r = (u.role || '').toLowerCase().trim();
    if (standardRoles.includes(r)) {
      setEditUserRoleSelect(r === 'editor' ? 'edit' : r);
      setEditCustomRoleText('');
    } else {
      setEditUserRoleSelect('other');
      setEditCustomRoleText(u.role || '');
    }
    const c = u.center || '';
    setEditUserCenter(c);
    setEditIsCustomCenter(false);
    const g = u.group || u.group_name || '';
    setEditUserGroup(g);
    setEditIsCustomGroup(false);
    setEditUserPassword('');
    setEditUserError('');
    if (c) {
      setEditLoadingGroups(true);
      api
        .get(`/users/groups/list?center=${encodeURIComponent(c)}`)
        .then((res) => {
          setEditAvailableGroups(res.data || []);
        })
        .catch(() => setEditAvailableGroups([]))
        .finally(() => setEditLoadingGroups(false));
    } else {
      setEditAvailableGroups([]);
    }
  };

  const handleCloseEditUser = () => {
    setEditingUser(null);
    setEditUserError('');
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserName.trim() || !editUserEmail.trim()) {
      setEditUserError('Full Name and Email are required.');
      return;
    }

    const effectiveRole =
      editUserRoleSelect === 'other'
        ? (editCustomRoleText.trim() || 'scientist')
        : editUserRoleSelect;

    setEditUserSubmitting(true);
    setEditUserError('');
    try {
      const payload = {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        designation: editUserDesignation.trim() || null,
        role: effectiveRole,
        center: (isAdmin || isEditor) ? (editUserCenter.trim() || null) : editingUser.center,
        group: (isAdmin || isEditor) ? (editUserGroup.trim() || null) : (editingUser.group || editingUser.group_name),
        group_name: (isAdmin || isEditor) ? (editUserGroup.trim() || null) : (editingUser.group || editingUser.group_name),
      };
      if (editUserPassword.trim()) {
        payload.password = editUserPassword.trim();
      }

      await api.put(`/users/${editingUser.id}`, payload);
      handleCloseEditUser();
      fetchUsers(filterCenter, filterRole);
      if (isAdmin || isEditor) {
        fetchAdminMeta();
      }
    } catch (err) {
      console.error('Failed to update user:', err);
      const detail = err.response?.data?.detail;
      setEditUserError(typeof detail === 'string' ? detail : 'Failed to update user.');
    } finally {
      setEditUserSubmitting(false);
    }
  };

  const handleDeleteUser = (userId, name) => {
    if (userId === user.id) {
      alert('You cannot delete your own account.');
      return;
    }
    openConfirmDialog({
      title: 'Remove User',
      message: `Are you sure you want to remove user "${name}"? This action cannot be undone.`,
      confirmText: 'Yes, Remove User',
      cancelText: 'No, Cancel',
      onConfirm: async () => {
        try {
          await api.delete(`/users/${userId}`);
          fetchUsers(filterCenter, filterRole);
          if (isAdmin || isEditor) {
            fetchAdminMeta();
          }
        } catch (err) {
          console.error('Failed to delete user:', err);
          alert('Failed to delete user.');
        }
      },
    });
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

  const handleDeleteCategory = (catId, catName) => {
    openConfirmDialog({
      title: 'Delete Category Stage',
      message: catName
        ? `Are you sure you want to delete category stage "${catName}"?`
        : 'Are you sure you want to delete this category stage?',
      confirmText: 'Yes, Delete',
      cancelText: 'No, Cancel',
      onConfirm: async () => {
        try {
          await api.delete(`/categories/${catId}`);
          fetchCategories();
        } catch (err) {
          console.error('Failed to delete stage:', err);
          alert('Failed to delete category stage.');
        }
      },
    });
  };

  if (!user || (!isAdmin && !isGhUser && !isEditor)) return null;

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
    if (lower === 'joint director' || lower === 'jd') return 'Joint Director';
    if (lower === 'ch') return 'Centre Head (CH)';
    if (lower === 'gh') return 'Group Head (GH)';
    if (lower === 'edit' || lower === 'editor') return 'Editor / Compilation Lead';
    if (lower === 'scientist') return 'Scientist';
    if (lower === 'technical staff') return 'Technical Staff';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleBadgeClass = (role) => {
    if (!role) return 'role-scientist';
    const lower = role.toLowerCase().trim();
    if (lower === 'admin') return 'role-admin';
    if (lower === 'joint director' || lower === 'jd') return 'role-ch';
    if (lower === 'ch') return 'role-ch';
    if (lower === 'gh') return 'role-gh';
    if (lower === 'edit' || lower === 'editor') return 'role-editor';
    if (lower === 'technical staff') return 'role-tech';
    return 'role-scientist';
  };

  return (
    <div className="customize-page">
      {/* 1. Back Navigation Button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/periods')}
          className="btn-back-pill"
          title="Return to Newsletter Overview"
        >
          <div className="back-icon-circle">
            <IconArrowLeft size={16} strokeWidth={2.4} />
          </div>
          <span>Back</span>
        </button>
      </div>

      {/* 2. Hero Banner */}
      <div className="admin-hero">
        <div className="admin-hero-title-group">
          <h2>
            <IconAdjustments size={26} style={{ color: '#2563eb' }} />
            <span>
              {isAdmin
                ? 'System Administration & Configuration'
                : isEditor
                  ? 'User & Category Management'
                  : 'Department Team Management'}
            </span>
          </h2>
          <p>
            {isAdmin ? (
              <>
                <span className="role-badge role-admin" style={{ padding: '3px 10px', fontSize: '0.78rem' }}>
                  <IconShield size={14} />
                  System Administrator
                </span>
                <span style={{ color: '#2563eb', fontWeight: '700' }}>• Institutional Oversight</span>
                <span>• Managing users, roles, centers, leadership, and global category stages</span>
              </>
            ) : isEditor ? (
              <>
                <span className="role-badge role-editor" style={{ padding: '3px 10px', fontSize: '0.78rem' }}>
                  <IconListNumbers size={14} />
                  Editor
                </span>
                <span>• Manage team roles, user accounts, and publication categories</span>
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

        {/* Live Counters - Admin Only */}
        {isAdmin && (
          <div className="periods-stats-strip">
            <div className="stat-pill">
              <div className="stat-pill-icon blue" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <IconBuilding size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{allCenters.length}</span>
                <span className="stat-pill-label">Centers</span>
              </div>
            </div>

            <div className="stat-pill">
              <div className="stat-pill-icon amber" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                <IconShield size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{allChs.length}</span>
                <span className="stat-pill-label">Centre Heads</span>
              </div>
            </div>

            <div className="stat-pill">
              <div className="stat-pill-icon blue">
                <IconUsers size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{groupUsers.length}</span>
                <span className="stat-pill-label">Total Users</span>
              </div>
            </div>

            <div className="stat-pill">
              <div className="stat-pill-icon emerald">
                <IconListNumbers size={18} />
              </div>
              <div className="stat-pill-info">
                <span className="stat-pill-count">{categories.length}</span>
                <span className="stat-pill-label">Category Stages</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Section Switcher Tabs (For Admin and Editor) */}
      {(isAdmin || isEditor) && (
        <div className="admin-tabs-nav">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <IconUserPlus size={18} />
            <span>User Management & Roles</span>
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
      )}

      {/* 4. Tab 1: User & Account Management (Admin, Editor & GH) */}
      {(isAdmin || isEditor || isGhUser) && activeTab === 'users' && (
        <div className="admin-grid-layout">
          {/* Left Form Card: Create User */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconUserPlus size={20} style={{ color: '#2563eb' }} />
                <span>{(isAdmin || isEditor) ? 'Create User Account (Any Role / Center)' : 'Create Team Member'}</span>
              </h3>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '18px', marginTop: 0, lineHeight: '1.45' }}>
              {(isAdmin || isEditor)
                ? 'Create a new user account and assign them to any Center, Department, and institutional Role (Centre Head, Group Head, Scientist, Staff, Admin, Editor).'
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
                  style={{ cursor: 'pointer', backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  {isEditor ? (
                    <>
                      <option value="gh">Group Head (GH)</option>
                      <option value="ch">Centre Head (CH)</option>
                      <option value="joint director">Joint Director</option>
                      <option value="other">Other (Enter details below)...</option>
                    </>
                  ) : (
                    <>
                      <option value="scientist">Scientist</option>
                      <option value="technical staff">Technical Staff</option>
                      <option value="gh">Group Head (GH)</option>
                      {isAdmin && <option value="ch">Centre Head (CH)</option>}
                      {isAdmin && <option value="joint director">Joint Director</option>}
                      {isAdmin && <option value="edit">Editor / Compilation Lead</option>}
                      {isAdmin && <option value="admin">Administration Staff</option>}
                      <option value="other">Other / Custom Role (Type below)...</option>
                    </>
                  )}
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
                    Enter Role Details *
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Project Associate, Research Scholar, Director"
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
                {(isEditor ? [
                  { id: 'gh', label: 'Group Head (GH)' },
                  { id: 'ch', label: 'Centre Head (CH)' },
                  { id: 'joint director', label: 'Joint Director' },
                  { id: 'other', label: 'Other...' },
                ] : [
                  { id: 'scientist', label: 'Scientist' },
                  { id: 'technical staff', label: 'Technical Staff' },
                  { id: 'gh', label: 'Group Head' },
                  ...(isAdmin ? [
                    { id: 'ch', label: 'Centre Head (CH)' },
                    { id: 'joint director', label: 'Joint Director' },
                    { id: 'edit', label: 'Editor' },
                    { id: 'admin', label: 'Admin' },
                  ] : []),
                  { id: 'other', label: 'Custom...' },
                ]).map((rolePreset) => (
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
                  {(isAdmin || isEditor) ? (
                    <div>
                      <select
                        className="admin-input"
                        value={isCustomCenter ? '__other__' : adminUserCenter}
                        onChange={(e) => handleCenterChange(e.target.value)}
                        style={{ cursor: 'pointer', backgroundColor: '#ffffff', color: '#0f172a', width: '100%' }}
                        required={!isCustomCenter}
                      >
                        <option value="">Select Center...</option>
                        {allCenters.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__other__">+ Enter Other Center...</option>
                      </select>
                      {isCustomCenter && (
                        <div style={{ marginTop: '6px' }}>
                          <input
                            type="text"
                            className="admin-input"
                            placeholder="Type center name..."
                            value={adminUserCenter}
                            onChange={(e) => setAdminUserCenter(e.target.value)}
                            required
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="admin-input"
                      value={user.center || ''}
                      disabled
                    />
                  )}
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <span>Department *</span>
                    {loadingGroups && (
                      <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '500', marginLeft: '6px' }}>
                        Loading...
                      </span>
                    )}
                  </label>
                  {(isAdmin || isEditor) ? (
                    <div>
                      <select
                        className="admin-input"
                        value={isCustomGroup ? '__other__' : adminUserGroup}
                        onChange={(e) => {
                          if (e.target.value === '__other__') {
                            setIsCustomGroup(true);
                            setAdminUserGroup('');
                          } else {
                            setIsCustomGroup(false);
                            setAdminUserGroup(e.target.value);
                          }
                        }}
                        disabled={!adminUserCenter || loadingGroups}
                        style={{
                          cursor: !adminUserCenter ? 'not-allowed' : 'pointer',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          width: '100%',
                        }}
                        required={!isCustomGroup}
                      >
                        <option value="">
                          {!adminUserCenter
                            ? 'Select Center first'
                            : loadingGroups
                            ? 'Loading departments...'
                            : availableCenterGroups.length === 0
                            ? 'No departments found'
                            : 'Select Department...'}
                        </option>
                        {availableCenterGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                        <option value="__other__">+ Enter Other Department...</option>
                      </select>
                      {(isCustomGroup || (adminUserCenter && !loadingGroups && availableCenterGroups.length === 0)) && (
                        <div style={{ marginTop: '6px' }}>
                          <input
                            type="text"
                            className="admin-input"
                            placeholder="Type department name..."
                            value={adminUserGroup}
                            onChange={(e) => setAdminUserGroup(e.target.value)}
                            required
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
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
                <span>{(isAdmin || isEditor) ? `All Users (${totalUserCount})` : `Department Members (${totalUserCount})`}</span>
              </h3>

              {/* Search & Filter Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Search Bar */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <IconSearch size={14} style={{ color: '#94a3b8', position: 'absolute', left: '8px', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search member / email..."
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      setUserPage(1);
                    }}
                    style={{
                      padding: '4px 8px 4px 26px',
                      fontSize: '0.78rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      width: '160px',
                      backgroundColor: '#ffffff',
                    }}
                  />
                  {userSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearchQuery('');
                        setUserPage(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: '#94a3b8',
                      }}
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>

                {/* Multi-Center & Role Filters for Admin & Editor */}
                {(isAdmin || isEditor) && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconFilter size={14} style={{ color: '#64748b' }} />
                      <select
                        value={filterCenter}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilterCenter(val);
                          setUserPage(1);
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
                        setUserPage(1);
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
                      <option value="joint director">Joint Director</option>
                      <option value="ch">Centre Head (CH)</option>
                      <option value="gh">Group Head (GH)</option>
                      <option value="edit">Editor / Compilation Lead</option>
                      <option value="scientist">Scientist</option>
                      <option value="technical staff">Technical Staff</option>
                      <option value="admin">Administrator</option>
                    </select>

                    {(filterCenter !== 'all' || filterRole !== 'all' || userSearchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterCenter('all');
                          setFilterRole('all');
                          setUserSearchQuery('');
                          setUserPage(1);
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
                  </>
                )}
              </div>
            </div>

            {usersLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                <IconLoader2 size={24} className="animate-spin text-blue-600" />
                <p style={{ marginTop: '8px', fontSize: '0.88rem' }}>Loading users...</p>
              </div>
            ) : paginatedUsers.length === 0 ? (
              <p className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                {userSearchQuery ? 'No matching members found.' : 'No users found for this filter selection.'}
              </p>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Designation</th>
                        <th>Role</th>
                        {(isAdmin || isEditor) && <th>Center</th>}
                        {(isAdmin || isEditor) && <th>Department</th>}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((u) => {
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
                            {(isAdmin || isEditor) && (
                              <td>
                                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#1e293b' }}>
                                  {u.center || '—'}
                                </span>
                              </td>
                            )}
                            {(isAdmin || isEditor) && (
                              <td>
                                <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                                  {u.group || u.group_name || '—'}
                                </span>
                              </td>
                            )}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="action-icon-btn"
                                  style={{
                                    width: '30px',
                                    height: '30px',
                                    color: '#2563eb',
                                    borderColor: '#bfdbfe',
                                    backgroundColor: '#eff6ff',
                                  }}
                                  onClick={() => handleOpenEditUser(u)}
                                  title={`Edit ${u.name} (Change Role / Details)`}
                                >
                                  <IconEdit size={14} />
                                </button>

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
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalUserCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      padding: '12px 14px',
                      borderTop: '1px solid #e2e8f0',
                      backgroundColor: '#fafbfc',
                      borderRadius: '0 0 12px 12px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Showing <strong>{Math.min((userPage - 1) * pageSize + 1, totalUserCount)}</strong> to{' '}
                      <strong>{Math.min(userPage * pageSize, totalUserCount)}</strong> of{' '}
                      <strong>{totalUserCount}</strong> members
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>Rows:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setUserPage(1);
                          }}
                          style={{
                            padding: '3px 6px',
                            fontSize: '0.76rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                          disabled={userPage === 1}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: userPage === 1 ? '#f8fafc' : '#ffffff',
                            color: userPage === 1 ? '#cbd5e1' : '#334155',
                            cursor: userPage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                          }}
                        >
                          Prev
                        </button>

                        {Array.from({ length: totalUserPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalUserPages || Math.abs(p - userPage) <= 1)
                          .map((p, idx, arr) => (
                            <React.Fragment key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span style={{ padding: '0 3px', color: '#94a3b8', fontSize: '0.78rem' }}>…</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setUserPage(p)}
                                style={{
                                  minWidth: '28px',
                                  height: '28px',
                                  padding: '0 6px',
                                  borderRadius: '6px',
                                  border: userPage === p ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                  backgroundColor: userPage === p ? '#2563eb' : '#ffffff',
                                  color: userPage === p ? '#ffffff' : '#334155',
                                  cursor: 'pointer',
                                  fontSize: '0.76rem',
                                  fontWeight: userPage === p ? '700' : '600',
                                }}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          ))}

                        <button
                          type="button"
                          onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                          disabled={userPage === totalUserPages}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: userPage === totalUserPages ? '#f8fafc' : '#ffffff',
                            color: userPage === totalUserPages ? '#cbd5e1' : '#334155',
                            cursor: userPage === totalUserPages ? 'not-allowed' : 'pointer',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab 2: Category Stages Management (Admin & Editor Only) */}
      {(isAdmin || isEditor) && activeTab === 'categories' && (
        <div className="admin-grid-layout">
          {/* Left Form Card: Add Category */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconFolderPlus size={20} style={{ color: '#2563eb' }} />
                <span>Add Category</span>
              </h3>
            </div>

            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Category Name *</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Research Highlight, Workshops, etc.."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Display Order</label>
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
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <IconPlus size={18} />
                      <span>Add Category</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Card: Categories Table */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <IconListNumbers size={20} style={{ color: '#2563eb' }} />
                <span>Categories ({categories.length})</span>
              </h3>
            </div>

            {catLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                <IconLoader2 size={24} className="animate-spin text-blue-600" />
                <p style={{ marginTop: '8px', fontSize: '0.88rem' }}>Loading categories...</p>
              </div>
            ) : catError ? (
              <div className="error-message">{catError}</div>
            ) : categories.length === 0 ? (
              <p className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                No categories defined.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>Order</th>
                      <th>Category Name</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Edit</th>
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
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
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

      {/* Edit User & Role Modal */}
      {editingUser && (
        <div
          className="modal-backdrop"
          onClick={handleCloseEditUser}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.22)',
              boxSizing: 'border-box',
              animation: 'profilePopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
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
                  <IconEdit size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '700' }}>
                    Edit User & Role
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                    Updating profile for {editingUser.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditUser}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <IconX size={20} />
              </button>
            </div>

            {editUserError && (
              <div className="error-message" style={{ marginBottom: '14px', fontSize: '0.84rem' }}>
                {editUserError}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Full Name *</label>
                <input
                  type="text"
                  className="admin-input"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Address *</label>
                <input
                  type="email"
                  className="admin-input"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Designation</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Scientist C, Centre Head, Project Associate"
                  value={editUserDesignation}
                  onChange={(e) => setEditUserDesignation(e.target.value)}
                />
              </div>

              {/* Role Selection */}
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <span>Account Role *</span>
                  {editUserRoleSelect === 'other' && (
                    <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: '600' }}>
                      (Custom Type)
                    </span>
                  )}
                </label>
                <select
                  className="admin-input"
                  value={editUserRoleSelect}
                  onChange={(e) => setEditUserRoleSelect(e.target.value)}
                  style={{ cursor: 'pointer', backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  {isEditor ? (
                    <>
                      <option value="gh">Group Head (GH)</option>
                      <option value="ch">Centre Head (CH)</option>
                      <option value="joint director">Joint Director</option>
                      {!['gh', 'ch', 'joint director', 'other'].includes(editUserRoleSelect) && (
                        <option value={editUserRoleSelect}>
                          {formatRole(editUserRoleSelect)} (Current)
                        </option>
                      )}
                      <option value="other">Other (Enter details below)...</option>
                    </>
                  ) : (
                    <>
                      <option value="scientist">Scientist</option>
                      <option value="technical staff">Technical Staff</option>
                      <option value="gh">Group Head (GH)</option>
                      {isAdmin && <option value="ch">Centre Head (CH)</option>}
                      {isAdmin && <option value="joint director">Joint Director</option>}
                      {isAdmin && <option value="edit">Editor / Compilation Lead</option>}
                      {isAdmin && <option value="admin">Administration Staff</option>}
                      <option value="other">Other / Custom Role...</option>
                    </>
                  )}
                </select>
              </div>

              {editUserRoleSelect === 'other' && (
                <div
                  className="admin-form-group"
                  style={{
                    background: '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <label className="admin-form-label" style={{ color: '#1e40af' }}>
                    Enter Role Details *
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Project Associate, Research Scholar, Director"
                    value={editCustomRoleText}
                    onChange={(e) => setEditCustomRoleText(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Center *</label>
                  {(isAdmin || isEditor) ? (
                    <div>
                      <select
                        className="admin-input"
                        value={editIsCustomCenter ? '__other__' : editUserCenter}
                        onChange={(e) => handleEditCenterChange(e.target.value)}
                        style={{ cursor: 'pointer', backgroundColor: '#ffffff', color: '#0f172a', width: '100%' }}
                        required={!editIsCustomCenter}
                      >
                        <option value="">Select Center...</option>
                        {allCenters.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__other__">+ Enter Other Center...</option>
                      </select>
                      {editIsCustomCenter && (
                        <div style={{ marginTop: '6px' }}>
                          <input
                            type="text"
                            className="admin-input"
                            placeholder="Type center name..."
                            value={editUserCenter}
                            onChange={(e) => setEditUserCenter(e.target.value)}
                            required
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="admin-input"
                      value={editUserCenter}
                      disabled
                    />
                  )}
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <span>Department *</span>
                    {editLoadingGroups && (
                      <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '500', marginLeft: '6px' }}>
                        Loading...
                      </span>
                    )}
                  </label>
                  {(isAdmin || isEditor) ? (
                    <div>
                      <select
                        className="admin-input"
                        value={editIsCustomGroup ? '__other__' : editUserGroup}
                        onChange={(e) => {
                          if (e.target.value === '__other__') {
                            setEditIsCustomGroup(true);
                            setEditUserGroup('');
                          } else {
                            setEditIsCustomGroup(false);
                            setEditUserGroup(e.target.value);
                          }
                        }}
                        disabled={!editUserCenter || editLoadingGroups}
                        style={{
                          cursor: !editUserCenter ? 'not-allowed' : 'pointer',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          width: '100%',
                        }}
                        required={!editIsCustomGroup}
                      >
                        <option value="">
                          {!editUserCenter
                            ? 'Select Center first'
                            : editLoadingGroups
                            ? 'Loading departments...'
                            : editAvailableGroups.length === 0
                            ? 'No departments found'
                            : 'Select Department...'}
                        </option>
                        {editAvailableGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                        <option value="__other__">+ Enter Other Department...</option>
                      </select>
                      {(editIsCustomGroup || (editUserCenter && !editLoadingGroups && editAvailableGroups.length === 0)) && (
                        <div style={{ marginTop: '6px' }}>
                          <input
                            type="text"
                            className="admin-input"
                            placeholder="Type department name..."
                            value={editUserGroup}
                            onChange={(e) => setEditUserGroup(e.target.value)}
                            required
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="admin-input"
                      value={editUserGroup}
                      disabled
                    />
                  )}
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  <span>Reset Password (Optional)</span>
                </label>
                <input
                  type="password"
                  className="admin-input"
                  placeholder="Leave empty to keep current password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleCloseEditUser}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={editUserSubmitting}
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {editUserSubmitting ? (
                    <>
                      <IconLoader2 size={18} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <IconCheck size={18} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* React Confirmation Dialog Modal */}
      {confirmDialog.isOpen && (
        <div
          className="modal-backdrop"
          onClick={closeConfirmDialog}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '430px',
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.22), 0 0 1px 1px rgba(0,0,0,0.06)',
              boxSizing: 'border-box',
              animation: 'profilePopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Warning Icon Badge */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <IconAlertTriangle size={28} strokeWidth={2.2} />
            </div>

            {/* Title */}
            <h3
              style={{
                margin: '0 0 8px 0',
                color: '#0f172a',
                fontSize: '1.2rem',
                fontWeight: '700',
              }}
            >
              {confirmDialog.title}
            </h3>

            {/* Message */}
            <p
              style={{
                margin: '0 0 24px 0',
                color: '#64748b',
                fontSize: '0.92rem',
                lineHeight: '1.5',
                padding: '0 8px',
              }}
            >
              {confirmDialog.message}
            </p>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                width: '100%',
              }}
            >
              <button
                type="button"
                onClick={closeConfirmDialog}
                style={{
                  flex: '1',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                {confirmDialog.cancelText}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (confirmDialog.onConfirm) {
                    await confirmDialog.onConfirm();
                  }
                  closeConfirmDialog();
                }}
                style={{
                  flex: '1',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customize;