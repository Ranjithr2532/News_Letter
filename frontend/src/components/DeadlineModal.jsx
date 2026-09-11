import React, { useState, useEffect } from 'react';
import { IconAlertTriangle, IconCalendar, IconX } from '@tabler/icons-react';
import { useUser } from '../context/UserContext';
import api from '../api/api';

const DeadlineModal = () => {
  const { user } = useUser();
  const [activeNotif, setActiveNotif] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const isChUser = user?.role?.toLowerCase() === 'ch';

  useEffect(() => {
    if (user?.id && !isChUser) {
      checkUnreadNotifications();
    }
  }, [user?.id, isChUser]);

  const checkUnreadNotifications = async () => {
    if (isChUser) return;
    try {
      const res = await api.get(`/notifications/?user_id=${user.id}&unread_only=true`);
      const unreadList = res.data || [];
      if (unreadList.length > 0) {
        // Show the highest priority unread deadline notification
        setActiveNotif(unreadList[0]);
        setShowModal(true);
      }
    } catch (err) {
      console.error('Failed to check unread deadline notifications:', err);
    }
  };

  // Just close the modal - does NOT mark as read, will show again next login
  const handleClose = () => {
    setShowModal(false);
  };

  // Mark as read in backend so it is NEVER shown again on future logins
  const handleDismiss = async () => {
    if (!activeNotif) return;
    setMarkingRead(true);
    try {
      await api.put(`/notifications/${activeNotif.id}/read`);
      setShowModal(false);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      setShowModal(false);
    } finally {
      setMarkingRead(false);
    }
  };

  if (isChUser || !showModal || !activeNotif) return null;

  const isGhUrgent = activeNotif.notification_type === 'GH_FINALIZE';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          animation: 'popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header - Navy Dark Slate (Matches Topbar Header Theme) */}
        <div
          style={{
            padding: '22px 26px',
            background: isGhUrgent
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderBottom: `2px solid ${isGhUrgent ? '#d97706' : '#2563eb'}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            position: 'relative',
          }}
        >
          {/* Glowing Icon Badge */}
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: isGhUrgent ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: isGhUrgent ? '#fbbf24' : '#38bdf8',
              border: `1px solid ${isGhUrgent ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: isGhUrgent ? '0 0 12px rgba(245, 158, 11, 0.2)' : '0 0 12px rgba(56, 189, 248, 0.2)',
            }}
          >
            <IconAlertTriangle size={24} />
          </div>

          <div style={{ flex: 1 }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isGhUrgent ? '#fbbf24' : '#38bdf8',
                backgroundColor: isGhUrgent ? 'rgba(245, 158, 11, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                padding: '3px 10px',
                borderRadius: '20px',
                display: 'inline-block',
                marginBottom: '8px',
                border: `1px solid ${isGhUrgent ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
              }}
            >
              {isGhUrgent ? '⚠️ Action Required' : '🔔 Submission Deadline'}
            </span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', lineHeight: '1.35' }}>
              {activeNotif.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
            title="Close popup (will show again next login)"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 26px', backgroundColor: '#ffffff' }}>
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              padding: '16px 18px',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${isGhUrgent ? '#d97706' : '#2563eb'}`,
            }}
          >
            <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: '1.6', color: '#334155', fontWeight: '500' }}>
              {activeNotif.message}
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '14px 26px 22px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            disabled={markingRead}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: '600',
              background: isGhUrgent
                ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              cursor: markingRead ? 'not-allowed' : 'pointer',
              boxShadow: isGhUrgent
                ? '0 4px 12px rgba(217, 119, 6, 0.3)'
                : '0 4px 12px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.15s ease',
              opacity: markingRead ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!markingRead) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = isGhUrgent
                  ? '0 6px 16px rgba(217, 119, 6, 0.4)'
                  : '0 6px 16px rgba(37, 99, 235, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!markingRead) {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = isGhUrgent
                  ? '0 4px 12px rgba(217, 119, 6, 0.3)'
                  : '0 4px 12px rgba(37, 99, 235, 0.3)';
              }
            }}
          >
            {markingRead ? 'Dismissing...' : 'Got it!'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeadlineModal;
