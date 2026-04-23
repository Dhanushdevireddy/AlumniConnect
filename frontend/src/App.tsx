import { useState, useEffect } from 'react';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { AlumniDirectoryPage } from './pages/AlumniDirectoryPage';
import { RequestsPage } from './pages/RequestsPage';
import { ChatPage } from './pages/ChatPage';
import { SessionsPage } from './pages/SessionsPage';
import { NotificationsPage, AdminDashboardPage } from './pages/AdminPages';
import { notifications as notifApi } from './api/client';

type Page = 'directory' | 'requests' | 'chat' | 'sessions' | 'notifications' | 'admin';

function Sidebar({ current, setPage, notifCount }: { current: Page; setPage: (p: Page) => void; notifCount: number }) {
  const { user, logout } = useAuth();
  const studentItems: [Page, string, string][] = [
    ['directory', '', 'Alumni Directory'],
    ['requests', '', 'My Requests'],
    ['chat', '', 'Messages'],
    ['sessions', '', 'Sessions'],
    ['notifications', '', 'Notifications'],
  ];
  const alumniItems: [Page, string, string][] = [
    ['requests', '', 'Requests'],
    ['chat', '', 'Messages'],
    ['sessions', '', 'Sessions'],
    ['notifications', '', 'Notifications'],
  ];
  const adminItems: [Page, string, string][] = [
    ['admin', '', 'Admin Dashboard'],
    ['notifications', '', 'Notifications'],
  ];

  const items = user?.role === 'admin' ? adminItems : user?.role === 'alumni' ? alumniItems : studentItems;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">AlumniConnect</div>
      <div style={{ padding: '0 20px 20px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{user?.fullName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`badge badge-${user?.role === 'admin' ? 'danger' : user?.role === 'alumni' ? 'success' : 'info'}`} style={{ fontSize: 11 }}>{user?.role}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map(([page, icon, label]) => (
          <button key={page} className={`nav-item ${current === page ? 'active' : ''}`} onClick={() => setPage(page)}>
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
            {page === 'notifications' && notifCount > 0 && (
              <span style={{ marginLeft: 'auto', background: 'var(--danger)', color: '#fff', borderRadius: 999, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{notifCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', padding: '12px 24px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}>Sign out</button>
      </div>
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(true);
  const [page, setPage] = useState<Page>(() => {
    const u = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;
    if (!u) return 'directory';
    if (u.role === 'admin') return 'admin';
    if (u.role === 'alumni') return 'requests';
    return 'directory';
  });
  const [notifCount, setNotifCount] = useState(0);

  // Navigate intelligently upon login
  useEffect(() => {
    if (user) {
      if (user.role === 'admin' && page !== 'admin' && page !== 'notifications') setPage('admin');
      else if (user.role === 'alumni' && page === 'directory') setPage('requests');
    }
  }, [user]);

  // Poll notification count every 30s
  useEffect(() => {
    if (!user) return;
    const fetch = () => notifApi.list().then(items => setNotifCount(items.filter((n: { isDigested: boolean }) => !n.isDigested).length)).catch(() => {});
    fetch();
    const iv = setInterval(fetch, 30000);
    return () => clearInterval(iv);
  }, [user]);

  if (!user) {
    return showLogin
      ? <LoginPage onSwitch={() => setShowLogin(false)} />
      : <RegisterPage onSwitch={() => setShowLogin(true)} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'directory': return <AlumniDirectoryPage navigate={(p) => setPage(p as Page)} />;
      case 'requests': return <RequestsPage />;
      case 'chat': return <ChatPage />;
      case 'sessions': return <SessionsPage />;
      case 'notifications': return <NotificationsPage />;
      case 'admin': return <AdminDashboardPage />;
      default: return null;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar current={page} setPage={setPage} notifCount={notifCount} />
      <main className="main-content">{renderPage()}</main>
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
