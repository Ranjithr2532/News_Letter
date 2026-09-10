import React, { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('newsletter_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('newsletter_user');
      }
    }
    return null;
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('newsletter_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('newsletter_user');
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
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
