import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUser } from '../context/UserContext';
import { IconLock, IconMail, IconKey, IconCheck, IconX, IconLoader2, IconArrowLeft } from '@tabler/icons-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot / Reset Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const { login } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/users/login', { email, password });
      login(response.data);
      navigate('/periods');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgotModal = () => {
    setForgotEmail(email || '');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setForgotStep(1);
    setShowForgotModal(true);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/users/request-otp', { email: forgotEmail });
      setForgotSuccess(res.data?.message || 'OTP sent successfully to your email!');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Failed to send OTP. Please verify your email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setForgotError('Please enter the 6-digit OTP received in your email.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/users/verify-otp', {
        email: forgotEmail,
        otp: otpCode.trim(),
      });
      setForgotSuccess(res.data?.message || 'OTP verified successfully!');
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Invalid or expired OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      setForgotError('Password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/users/update-password', {
        email: forgotEmail,
        new_password: newPassword,
      });
      setForgotSuccess(res.data?.message || 'Password reset successfully!');
      setForgotStep(4);
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Failed to update password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>CMTI Newsletter</h2>
        <h3>Login</h3>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={handleOpenForgotModal}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.84rem',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '0',
                textDecoration: 'underline',
              }}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>

      {/* Forgot / Reset Password Modal */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
              }}
            >
              <IconX size={18} />
            </button>

            {/* Modal Header */}
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                }}
              >
                <IconKey size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                Reset Password
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                {forgotStep === 1 && 'Enter your registered email to receive a 6-digit OTP.'}
                {forgotStep === 2 && `Enter the 6-digit OTP sent to ${forgotEmail}.`}
                {forgotStep === 3 && 'Enter your new password below.'}
                {forgotStep === 4 && 'Your password has been reset successfully!'}
              </p>
            </div>

            {/* Error Message */}
            {forgotError && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: '600',
                  marginBottom: '16px',
                }}
              >
                {forgotError}
              </div>
            )}

            {/* STEP 1: Enter Email */}
            {forgotStep === 1 && (
              <form onSubmit={handleRequestOtp}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. yourname@cmti.res.in"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.92rem',
                    fontWeight: '700',
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    opacity: forgotLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.28)',
                  }}
                >
                  {forgotLoading ? (
                    <>
                      <IconLoader2 size={18} className="animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <span>Send OTP Code</span>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Verify OTP */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOtp}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Enter 6-Digit OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '2px solid #2563eb',
                      fontSize: '1.3rem',
                      letterSpacing: '8px',
                      textAlign: 'center',
                      fontWeight: '800',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.92rem',
                    fontWeight: '700',
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    opacity: forgotLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.28)',
                  }}
                >
                  {forgotLoading ? (
                    <>
                      <IconLoader2 size={18} className="animate-spin" />
                      <span>Verifying OTP...</span>
                    </>
                  ) : (
                    <span>Verify OTP</span>
                  )}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <IconArrowLeft size={14} />
                    <span>Change Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={forgotLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Enter New Password */}
            {forgotStep === 3 && (
              <form onSubmit={handleUpdatePassword}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.92rem',
                    fontWeight: '700',
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    opacity: forgotLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.28)',
                  }}
                >
                  {forgotLoading ? (
                    <>
                      <IconLoader2 size={18} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Set New Password</span>
                  )}
                </button>
              </form>
            )}

            {/* STEP 4: Success Screen */}
            {forgotStep === 4 && (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <IconCheck size={32} strokeWidth={3} />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  Password Reset Complete!
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                  You can now log in to the portal using your new password.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.92rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
