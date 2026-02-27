"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'preferences' | 'security'>('profile');

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  
  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/login";
          return;
        }
        setUser(user);
        
        // Mock loading user data
        setName(user.user_metadata?.name || "");
        setPhone(user.user_metadata?.phone || "");
        setAddress(user.user_metadata?.address || "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [supabase]);

  const handleSaveProfile = async () => {
    setSaving(true);
    // Mock save - in real app, update via API
    setTimeout(() => {
      setSaving(false);
      alert("Profile updated successfully!");
    }, 1000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: 20 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontSize: 24, textDecoration: 'none' }}>←</a>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Settings</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 24 }}>
          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setActiveSection('profile')}
              style={{
                padding: '12px 16px',
                backgroundColor: activeSection === 'profile' ? '#eff6ff' : 'white',
                color: activeSection === 'profile' ? '#3b82f6' : '#374151',
                border: `1px solid ${activeSection === 'profile' ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              <span style={{ fontSize: 18 }}>👤</span>
              Profile Information
            </button>
            <button
              onClick={() => setActiveSection('preferences')}
              style={{
                padding: '12px 16px',
                backgroundColor: activeSection === 'preferences' ? '#eff6ff' : 'white',
                color: activeSection === 'preferences' ? '#3b82f6' : '#374151',
                border: `1px solid ${activeSection === 'preferences' ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              <span style={{ fontSize: 18 }}>🔔</span>
              Notifications
            </button>
            <button
              onClick={() => setActiveSection('security')}
              style={{
                padding: '12px 16px',
                backgroundColor: activeSection === 'security' ? '#eff6ff' : 'white',
                color: activeSection === 'security' ? '#3b82f6' : '#374151',
                border: `1px solid ${activeSection === 'security' ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              <span style={{ fontSize: 18 }}>🔒</span>
              Security
            </button>
          </div>

          {/* Main Content */}
          <div>
            {/* Profile Information Section */}
            {activeSection === 'profile' && (
              <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Profile Information</h2>
                
                {/* Profile Picture */}
                <div style={{ marginBottom: 24, textAlign: 'center' }}>
                  <div style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    backgroundColor: '#e5e7eb',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                    marginBottom: 12
                  }}>
                    👤
                  </div>
                  <button style={{
                    padding: '8px 16px',
                    backgroundColor: 'white',
                    color: '#3b82f6',
                    border: '1px solid #3b82f6',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}>
                    Change Photo
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14,
                        backgroundColor: '#f9fafb',
                        color: '#6b7280'
                      }}
                    />
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      Email cannot be changed
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+90 555 123 4567"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                      Address
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter your address"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14,
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: saving ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Preferences Section */}
            {activeSection === 'preferences' && (
              <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Notification Preferences</h2>
                
                <div style={{ display: 'grid', gap: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Email Notifications</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>Receive updates via email</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 50, height: 28 }}>
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: emailNotifications ? '#3b82f6' : '#cbd5e1',
                        borderRadius: 24,
                        transition: '0.3s'
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '""',
                          height: 20,
                          width: 20,
                          left: emailNotifications ? 26 : 4,
                          bottom: 4,
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.3s'
                        }} />
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>SMS Notifications</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>Get text messages for important updates</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 50, height: 28 }}>
                      <input
                        type="checkbox"
                        checked={smsNotifications}
                        onChange={(e) => setSmsNotifications(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: smsNotifications ? '#3b82f6' : '#cbd5e1',
                        borderRadius: 24,
                        transition: '0.3s'
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '""',
                          height: 20,
                          width: 20,
                          left: smsNotifications ? 26 : 4,
                          bottom: 4,
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.3s'
                        }} />
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Push Notifications</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>Receive push notifications on your device</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 50, height: 28 }}>
                      <input
                        type="checkbox"
                        checked={pushNotifications}
                        onChange={(e) => setPushNotifications(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: pushNotifications ? '#3b82f6' : '#cbd5e1',
                        borderRadius: 24,
                        transition: '0.3s'
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '""',
                          height: 20,
                          width: 20,
                          left: pushNotifications ? 26 : 4,
                          bottom: 4,
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.3s'
                        }} />
                      </span>
                    </label>
                  </div>

                  <div style={{ paddingTop: 4 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                    >
                      <option value="en">English</option>
                      <option value="tr">Türkçe</option>
                      <option value="de">Deutsch</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Security Section */}
            {activeSection === 'security' && (
              <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Security Settings</h2>
                
                <div style={{ display: 'grid', gap: 16 }}>
                  <button style={{
                    padding: '16px 20px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Change Password</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>Update your password</div>
                    </div>
                    <span>→</span>
                  </button>

                  <button style={{
                    padding: '16px 20px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Two-Factor Authentication</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>Add an extra layer of security</div>
                    </div>
                    <span>→</span>
                  </button>

                  <button style={{
                    padding: '16px 20px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Active Sessions</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>Manage your active sessions</div>
                    </div>
                    <span>→</span>
                  </button>

                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginTop: 8 }}>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: '100%',
                        padding: '12px 24px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
