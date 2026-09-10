import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  IconCalendar,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconMail,
  IconBriefcase,
  IconBuilding,
  IconUsersGroup,
  IconShield,
} from '@tabler/icons-react';

const Layout = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const isGhUser = user.role?.toLowerCase() === 'gh';

  // Compute initials (e.g., "VITHUN S N" -> "VN" or "VS")
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

  const lowerUserRole = user.role?.toLowerCase()?.trim();
  const isUserTech = lowerUserRole === 'technical staff';
  const isUserSci = lowerUserRole === 'scientist';

  return (
    <div className="app-layout-topbar">
      {/* Top Navigation Bar */}
      <header className="app-topbar">
        <div className="topbar-left">
          {/* Brand Logo & Title */}
          <div
            className="topbar-brand"
            onClick={() => navigate('/periods')}
            title="CMTI Newsletter Portal"
            role="button"
            tabIndex={0}
          >
            <div className="brand-logo-card">
              <img
                src="/cmti.png"
                alt="CMTI"
                className="brand-logo-img"
              />
            </div>
            <div className="brand-text">
              <span className="brand-title">
                CMTI <span className="brand-highlight">Newsletter</span>
              </span>
              <span className="brand-subtitle">Activity & Publication Portal</span>
            </div>
          </div>

          <div className="topbar-divider" />

          {/* Navigation Links */}
          <nav className="topbar-nav">
            <NavLink
              to="/periods"
              className={({ isActive }) =>
                `topbar-link ${isActive ? 'active' : ''}`
              }
            >
              <IconCalendar size={18} />
              <span>Newsletters</span>
            </NavLink>
          </nav>
        </div>

        <div className="topbar-right">
          {/* Profile Avatar Button with Hover/Click Popover */}
          <div
            className="profile-menu-container"
            ref={profileRef}
          >
            <button
              type="button"
              className={`profile-avatar-btn ${profileOpen ? 'active' : ''}`}
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label="User Profile"
              title={user.name}
            >
              <div className="avatar-circle">
                {getInitials(user.name)}
              </div>
              <div className="profile-btn-info">
                <span className="profile-btn-name">{user.name}</span>
                <span className="profile-btn-role">
                  {formatRole(user.role)}
                </span>
              </div>
              <IconChevronDown
                size={14}
                className={`chevron-icon ${profileOpen ? 'rotated' : ''}`}
              />
            </button>

            {/* Hover/Click Popover Details Card */}
            {profileOpen && (
              <div className="profile-dropdown-card">
                <div className="profile-card-header">
                  <div className="profile-card-avatar">
                    {getInitials(user.name)}
                  </div>
                  <div className="profile-card-user">
                    <h4 className="profile-card-name">{user.name}</h4>
                    {user.email && (
                      <p className="profile-card-email">
                        <IconMail size={13} />
                        <span>{user.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="profile-card-body">
                  {user.role && (
                    <div className="profile-detail-row">
                      <span className="detail-label">
                        <IconShield size={14} />
                        <span>Role:</span>
                      </span>
                      <span
                        className={`detail-value role-badge ${
                          isGhUser
                            ? 'role-gh'
                            : isUserTech
                            ? 'role-tech'
                            : isUserSci
                            ? 'role-scientist'
                            : ''
                        }`}
                      >
                        {formatRole(user.role)}
                      </span>
                    </div>
                  )}

                  {user.designation && (
                    <div className="profile-detail-row">
                      <span className="detail-label">
                        <IconBriefcase size={14} />
                        <span>Designation:</span>
                      </span>
                      <span className="detail-value">{user.designation}</span>
                    </div>
                  )}

                  {user.center && (
                    <div className="profile-detail-row">
                      <span className="detail-label">
                        <IconBuilding size={14} />
                        <span>Center:</span>
                      </span>
                      <span className="detail-value">{user.center}</span>
                    </div>
                  )}

                  {(user.group || user.group_name) && (
                    <div className="profile-detail-row">
                      <span className="detail-label">
                        <IconUsersGroup size={14} />
                        <span>Group:</span>
                      </span>
                      <span className="detail-value group-tag">
                        {user.group || user.group_name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="profile-card-footer">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="profile-logout-btn"
                  >
                    <IconLogout size={15} />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Admin Settings Icon Button Beside Logout (Group Head Only) */}
          {isGhUser && (
            <NavLink
              to="/customize"
              className={({ isActive }) =>
                `topbar-admin-btn ${isActive ? 'active' : ''}`
              }
              title="Admin & Settings"
              aria-label="Admin Settings"
            >
              <IconSettings size={18} />
            </NavLink>
          )}

          <div className="topbar-divider-small" />

          {/* Logout button directly in navbar */}
          <button
            onClick={handleLogout}
            className="topbar-logout-btn"
            title="Sign out"
            aria-label="Logout"
          >
            <IconLogout size={18} />
          </button>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="app-content-area">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

