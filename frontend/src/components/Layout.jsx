import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { IconCalendar, IconSettings, IconLogout, IconNews } from '@tabler/icons-react';

const Layout = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  const isGhUser = user.role?.toLowerCase() === 'gh';

  return (
    <div className="app-layout-topbar">
      {/* Top Navigation Bar */}
      <header className="app-topbar">
        <div className="topbar-left">
          {/* <div className="topbar-logo" onClick={() => navigate('/periods')}>
            <IconNews size={22} className="logo-icon" />
            <span>Newsletter Builder</span>
          </div> */}

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
          <div className="user-info-badge">
            <span className="user-name">{user.name}</span>
            {user.role && <span className="user-role">{user.role.toLowerCase()}</span>}
            {(user.group || user.group_name) && (
              <span className="user-group-tag">{user.group || user.group_name}</span>
            )}
          </div>

          <button onClick={handleLogout} className="topbar-logout-btn" title="Logout">
            <IconLogout size={18} />
            <span></span>
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

