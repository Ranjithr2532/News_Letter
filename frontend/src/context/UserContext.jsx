import React, { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export const isDualRoleUser = (role) => {
  if (!role || typeof role !== 'string') return false;
  const lower = role.toLowerCase();
  return lower.includes('ch') && lower.includes('gh');
};

export const normalizeUser = (userData, chosenRole = null) => {
  if (!userData) return null;
  const isDual = isDualRoleUser(userData.role);
  const active = chosenRole
    ? chosenRole.toUpperCase()
    : userData.activeRole
    ? userData.activeRole.toUpperCase()
    : isDual
    ? 'CH'
    : (userData.role || 'User');

  return {
    ...userData,
    isDualRole: isDual,
    activeRole: active,
  };
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('newsletter_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        return normalizeUser(parsed);
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('newsletter_user');
      }
    }
    return null;
  });

  const login = (userData, chosenRole = null) => {
    const normalized = normalizeUser(userData, chosenRole);
    setUser(normalized);
    localStorage.setItem('newsletter_user', JSON.stringify(normalized));
  };

  const switchActiveRole = (newRole) => {
    if (!user || !user.isDualRole) return;
    const updated = normalizeUser(user, newRole);
    setUser(updated);
    localStorage.setItem('newsletter_user', JSON.stringify(updated));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('newsletter_user');
  };

  return (
    <UserContext.Provider value={{ user, login, logout, switchActiveRole }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
