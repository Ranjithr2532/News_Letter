import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const Sidebar = ({ activePage }) => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  if (!user) return null;

  const isGH = user.role?.toLowerCase() === 'gh';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-header">
          <h2>Newsletter Builder</h2>
          <span>{isGH ? 'Group Head Portal' : 'Scientist Portal'}</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-btn ${activePage === 'periods' ? 'active' : ''}`}
            onClick={() => navigate('/periods')}
          >
            <span>📅</span> Newsletter Periods
          </button>

          {isGH && (
            <button
              className={`sidebar-btn ${activePage === 'customize' ? 'active' : ''}`}
              onClick={() => navigate('/customize')}
            >
              <span>⚙️</span> Customization
            </button>
          )}
        </nav>
      </div>

      <div className="sidebar-user">
        <div className="user-info-card">
          <span className="user-info-name">{user.name}</span>
          <span className="user-info-role">
            {user.role?.toUpperCase()} ({user.designation || 'Staff'})
          </span>
          <span className="user-info-group">
            {user.center} | {user.group_name}
          </span>
        </div>
        <button onClick={handleLogout} className="sidebar-logout-btn">
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
