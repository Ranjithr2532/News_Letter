import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  IconCalendar,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconMail,
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

  return (
    <div className="app-layout-topbar">
      {/* Top Navigation Bar */}
      <header className="app-topbar">
        <div className="topbar-left">
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

            {isGhUser && (
              <NavLink
                to="/customize"
                className={({ isActive }) =>
                  `topbar-link ${isActive ? 'active' : ''}`
                }
              >
                <IconSettings size={18} />
                <span>Admin</span>
              </NavLink>
            )}
          </nav>
        </div>

        <div className="topbar-right">
          {/* Profile Avatar Button with Hover/Click Popover */}
          <div
            className="profile-menu-container"
            ref={profileRef}
            onMouseEnter={() => setProfileOpen(true)}
            onMouseLeave={() => setProfileOpen(false)}
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
                      <span className="detail-label">Role:</span>
                      <span className="detail-value role-badge">
                        {user.role.toLowerCase() === 'gh' ? 'Group Head (GH)' : user.role}
                      </span>
                    </div>
                  )}

                  {user.designation && (
                    <div className="profile-detail-row">
                      <span className="detail-label">Designation:</span>
                      <span className="detail-value">{user.designation}</span>
                    </div>
                  )}

                  {user.center && (
                    <div className="profile-detail-row">
                      <span className="detail-label">Center:</span>
                      <span className="detail-value">{user.center}</span>
                    </div>
                  )}

                  {(user.group || user.group_name) && (
                    <div className="profile-detail-row">
                      <span className="detail-label">Group:</span>
                      <span className="detail-value group-tag">{user.group || user.group_name}</span>
                    </div>
                  )}

                  {user.type && (
                    <div className="profile-detail-row">
                      <span className="detail-label">Type:</span>
                      <span className="detail-value">{user.type}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Logout button directly in navbar */}
          <button
            onClick={handleLogout}
            className="topbar-logout-btn"
            title="Logout"
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

