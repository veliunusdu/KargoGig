"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: 'ride_update' | 'payment' | 'promotion' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  icon: string;
  action?: {
    label: string;
    href: string;
  };
}

export default function NotificationsPage() {
  const supabase = createSupabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  // Mock notifications data
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'ride_update',
      title: 'Driver Arrived',
      message: 'Your driver has arrived at the pickup location',
      read: false,
      createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
      icon: '🚗',
      action: {
        label: 'View Ride',
        href: '/track/ride-123'
      }
    },
    {
      id: '2',
      type: 'payment',
      title: 'Payment Successful',
      message: 'Your payment of $45.00 was processed successfully',
      read: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      icon: '💳',
      action: {
        label: 'View Receipt',
        href: '/payments'
      }
    },
    {
      id: '3',
      type: 'ride_update',
      title: 'Ride Completed',
      message: 'Your ride to Ankara Gar has been completed. Thanks for riding with us!',
      read: true,
      createdAt: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
      icon: '✅'
    },
    {
      id: '4',
      type: 'promotion',
      title: 'Special Offer: 20% Off',
      message: 'Get 20% off your next 3 rides. Valid until end of month!',
      read: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
      icon: '🎉',
      action: {
        label: 'Book Now',
        href: '/book'
      }
    },
    {
      id: '5',
      type: 'system',
      title: 'Account Verified',
      message: 'Your account has been successfully verified',
      read: true,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
      icon: '🔐'
    },
    {
      id: '6',
      type: 'ride_update',
      title: 'Driver Assigned',
      message: 'Ahmed has been assigned as your driver',
      read: true,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
      icon: '👤',
      action: {
        label: 'View Details',
        href: '/rides/ride-122'
      }
    }
  ]);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setLoading(false);
    }
    checkAuth();
  }, [supabase]);

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'ride_update': return '#3b82f6';
      case 'payment': return '#10b981';
      case 'promotion': return '#f59e0b';
      case 'system': return '#6366f1';
      default: return '#6b7280';
    }
  };

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'ride_update': return 'Ride Update';
      case 'payment': return 'Payment';
      case 'promotion': return 'Promotion';
      case 'system': return 'System';
      default: return 'Notification';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleDelete = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: 20 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="/" style={{ fontSize: 24, textDecoration: 'none' }}>←</a>
              <h1 style={{ fontSize: 28, fontWeight: 700 }}>Notifications</h1>
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  border: '1px solid #3b82f6',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '8px 20px',
                backgroundColor: filter === 'all' ? '#3b82f6' : 'white',
                color: filter === 'all' ? 'white' : '#374151',
                border: `1px solid ${filter === 'all' ? '#3b82f6' : '#d1d5db'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              style={{
                padding: '8px 20px',
                backgroundColor: filter === 'unread' ? '#3b82f6' : 'white',
                color: filter === 'unread' ? 'white' : '#374151',
                border: `1px solid ${filter === 'unread' ? '#3b82f6' : '#d1d5db'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 60,
            backgroundColor: 'white',
            borderRadius: 12,
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No {filter === 'unread' ? 'unread' : ''} notifications</h3>
            <p style={{ color: '#666', fontSize: 14 }}>
              {filter === 'unread' ? 'You\'re all caught up!' : 'Check back later for updates'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  backgroundColor: notification.read ? 'white' : '#eff6ff',
                  padding: 16,
                  borderRadius: 12,
                  border: `1px solid ${notification.read ? '#e5e7eb' : '#bfdbfe'}`,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* Icon */}
                  <div style={{
                    fontSize: 32,
                    flexShrink: 0,
                    width: 48,
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: notification.read ? '#f3f4f6' : 'white',
                    borderRadius: 8
                  }}>
                    {notification.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                          {notification.title}
                        </h3>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: getTypeColor(notification.type),
                          backgroundColor: `${getTypeColor(notification.type)}15`,
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>
                          {getTypeLabel(notification.type)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(notification.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          color: '#9ca3af',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 18
                        }}
                      >
                        ×
                      </button>
                    </div>

                    <p style={{ color: '#374151', fontSize: 14, marginBottom: 8, lineHeight: 1.5 }}>
                      {notification.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {formatTime(notification.createdAt)}
                      </span>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'white',
                              color: '#3b82f6',
                              border: '1px solid #3b82f6',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            Mark as read
                          </button>
                        )}
                        {notification.action && (
                          <a
                            href={notification.action.href}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              textDecoration: 'none',
                              display: 'inline-block'
                            }}
                          >
                            {notification.action.label}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
