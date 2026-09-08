import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const Welcome = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="welcome-container">
      <div className="welcome-card">
        <h1>Welcome, {user.name}!</h1>
        <p className="user-details">
          <strong>Role:</strong> {user.role} | <strong>Group:</strong> {user.group_name}
        </p>
        {user.designation && (
          <p className="user-subdetail">
            <strong>Designation:</strong> {user.designation} {user.center ? `(${user.center})` : ''}
          </p>
        )}
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </div>
  );
};

export default Welcome;
