import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBell, IconCheck, IconChecks, IconClock, IconAlertCircle } from '@tabler/icons-react';
import { useUser } from '../context/UserContext';
import api from '../api/api';

const NotificationBell = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [allNotifications, setAllNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('unread'); // 'unread' | 'read'
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      // Interval poll every 30 seconds to fetch fresh notifications dynamically
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const [listRes, countRes] = await Promise.all([
        api.get(`/notifications/?user_id=${user.id}&unread_only=false`),
        api.get(`/notifications/unread-count?user_id=${user.id}`),
      ]);
      setAllNotifications(listRes.data || []);
      setUnreadCount(countRes.data?.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleMarkRead = async (e, notifId, periodId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      await api.put(`/notifications/${notifId}/read`);
      // Update local state so item moves to Read list
      setAllNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (periodId) {
        setIsOpen(false);
        navigate(`/periods/${periodId}/categories`);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      await api.put(`/notifications/read-all?user_id=${user.id}`);
      setAllNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await handleMarkRead(null, notif.id, notif.period_id);
    } else if (notif.period_id) {
      setIsOpen(false);
      navigate(`/periods/${notif.period_id}/categories`);
    }
  };

  if (!user) return null;

  const unreadNotifications = allNotifications.filter((n) => !n.is_read);
  const readNotifications = allNotifications.filter((n) => n.is_read);
  const displayedNotifications = activeTab === 'unread' ? unreadNotifications : readNotifications;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: 'relative',
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          backgroundColor: isOpen ? '#eff6ff' : '#f8fafc',
          border: '1px solid',
          borderColor: isOpen ? '#bfdbfe' : '#e2e8f0',
          color: isOpen ? '#2563eb' : '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title={unreadCount > 0 ? `${unreadCount} unread deadline notifications` : 'Notifications'}
        aria-label="Notifications"
      >
        <IconBell size={19} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: '800',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 5px rgba(220, 38, 38, 0.4)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Drawer */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '350px',
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* Header Title & Actions */}
          <div
            style={{
              padding: '14px 16px 10px 16px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <span style={{ fontSize: '0.92rem', fontWeight: '700', color: '#0f172a' }}>
                Notifications
              </span>

              {unreadNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#2563eb',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <IconChecks size={14} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Tab Navigation: Unread vs Read */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#e2e8f0',
                borderRadius: '8px',
                padding: '3px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'unread' ? '#ffffff' : 'transparent',
                  color: activeTab === 'unread' ? '#2563eb' : '#64748b',
                  boxShadow: activeTab === 'unread' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Unread</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: activeTab === 'unread' ? '#eff6ff' : 'rgba(100,116,139,0.15)',
                    color: activeTab === 'unread' ? '#2563eb' : '#64748b',
                  }}
                >
                  {unreadNotifications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('read')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'read' ? '#ffffff' : 'transparent',
                  color: activeTab === 'read' ? '#2563eb' : '#64748b',
                  boxShadow: activeTab === 'read' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Read</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: activeTab === 'read' ? '#eff6ff' : 'rgba(100,116,139,0.15)',
                    color: activeTab === 'read' ? '#2563eb' : '#64748b',
                  }}
                >
                  {readNotifications.length}
                </span>
              </button>
            </div>
          </div>

          {/* List Content */}
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {displayedNotifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: '#64748b',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <IconCheck size={28} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '0.86rem', fontWeight: '600', color: '#334155' }}>
                  {activeTab === 'unread' ? 'All caught up!' : 'No read notifications'}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {activeTab === 'unread'
                    ? 'No pending unread notifications.'
                    : 'Dismissed notifications will appear here.'}
                </span>
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: notif.is_read ? '#f8fafc' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    opacity: notif.is_read ? 0.85 : 1,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = notif.is_read ? '#f8fafc' : '#ffffff')
                  }
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor:
                        notif.notification_type === 'GH_FINALIZE' ? '#fef3c7' : '#eff6ff',
                      color: notif.notification_type === 'GH_FINALIZE' ? '#d97706' : '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <IconAlertCircle size={18} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: '700',
                        color: '#0f172a',
                        lineHeight: '1.3',
                      }}
                    >
                      {notif.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: '#475569',
                        marginTop: '4px',
                        lineHeight: '1.4',
                      }}
                    >
                      {notif.message}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        marginTop: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <IconClock size={12} />
                      <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {!notif.is_read && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkRead(e, notif.id, null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Mark as read (Dismiss)"
                    >
                      <IconCheck size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
