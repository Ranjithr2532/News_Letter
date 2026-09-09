import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { IconCalendar, IconSettings, IconLogout } from '@tabler/icons-react';

const Layout = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  // Determine top bar dynamic title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/periods')) {
      return 'Newsletters';
    }
    if (path.startsWith('/categories')) {
      return location.state?.periodTitle
        ? `Categories — ${location.state.periodTitle}`
        : 'Categories';
    }
    if (path.startsWith('/entries')) {
      const catName = location.state?.categoryName || 'Entries';
      const pTitle = location.state?.periodTitle;
      return pTitle ? `${catName} — ${pTitle}` : catName;
    }
    if (path.startsWith('/customize') || path.startsWith('/admin')) {
      return 'Admin & Customization';
    }
    return 'Newsletter Builder';
  };

  const isGhUser = user.role?.toLowerCase() === 'gh';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span>Newsletter Builder</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/periods"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <IconCalendar size={20} />
            <span>Newsletters</span>
          </NavLink>

          {isGhUser && (
            <NavLink
              to="/customize"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <IconSettings size={20} />
              <span>Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button onClick={handleLogout} className="sidebar-link logout-btn">
            <IconLogout size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <h2 className="top-bar-title">{getPageTitle()}</h2>
          </div>
          <div className="top-bar-right">
            <span className="user-chip">
              {user.name} · {user.role?.toLowerCase()}
            </span>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
