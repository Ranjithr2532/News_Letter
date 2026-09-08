import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import './index.css';

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/welcome" element={<Welcome />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
