import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Periods from './pages/Periods';
import Categories from './pages/Categories';
import Entries from './pages/Entries';
import Customize from './pages/Customize';
import './index.css';

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Public Route - Login */}
          <Route path="/" element={<Login />} />

          {/* Authenticated Routes wrapped in Layout */}
          <Route element={<Layout />}>
            <Route path="/periods" element={<Periods />} />
            <Route path="/categories/:periodId" element={<Categories />} />
            <Route path="/entries/:periodId/:categoryId" element={<Entries />} />
            <Route path="/customize" element={<Customize />} />
            <Route path="/admin" element={<Navigate to="/customize" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
