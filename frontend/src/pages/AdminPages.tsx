import { useEffect, useState } from 'react';
import { admin as adminApi, notifications as notifApi, AdminMetrics, VerificationRecord, Connection, DomainTag, NotificationEvent } from '../api/client';

// ── Notifications Page ────────────────────────────────────────────────────────
export function NotificationsPage() {
  const [items, setItems] = useState<NotificationEvent[]>([]);
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notifApi.list().then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  const markAll = async () => {
    await notifApi.markAllRead();
    setItems(prev => prev.map(n => ({ ...n, isDigested: true })));
  };

  const toggleOne = async (n: NotificationEvent) => {
    try {
      const updated = await notifApi.toggleRead(n.id);
      setItems(prev => prev.map(x => x.id === n.id ? updated : x));
    } catch (e) { console.error(e); }
  };

  const updateCadence = async (c: 'daily' | 'weekly') => { await notifApi.updatePreferences(c); setCadence(c); };

  // Build a human-readable label from eventType + senderName payload
  function buildLabel(n: NotificationEvent): string {
    const name = n.payload?.senderName as string | undefined;
    switch (n.eventType) {
      case 'new_message':      return name ? `New message from ${name}` : 'New message';
      case 'request_received': return name ? `Mentorship request from ${name}` : 'Request received';
      case 'request_accepted': return 'Your request was accepted';
      case 'request_declined': return name ? `${name} declined your request` : 'Request declined';
      case 'session_proposed': return name ? `${name} proposed a session` : 'Session proposed';
      case 'session_confirmed':return 'Session confirmed';
      case 'session_reminder': return 'Upcoming session reminder';
      case 'connection_flagged': return 'A connection was flagged';
      case 're_engagement_nudge': return 'Reconnect with your mentor/mentee';
      default: return n.eventType.replace(/_/g, ' ');
    }
  }

  const unreadCount = items.filter(n => !n.isDigested).length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount} unread · {items.length} total</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
            {(['daily', 'weekly'] as const).map(c => (
              <button key={c} onClick={() => updateCadence(c)}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: cadence === c ? 'var(--accent)' : 'transparent', color: cadence === c ? '#fff' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {c}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={markAll} disabled={unreadCount === 0}>Mark all read</button>
        </div>
      </div>

      {loading ? <div className="empty-state"><span className="loading-spinner" /></div> :
       items.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">—</div><h3>All caught up!</h3><p>No notifications yet</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(n => (
            <div key={n.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', opacity: n.isDigested ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: n.isDigested ? 400 : 700 }}>{buildLabel(n)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              <button
                onClick={() => toggleOne(n)}
                title={n.isDigested ? 'Mark as unread' : 'Mark as read'}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {n.isDigested ? 'Mark unread' : 'Mark read'}
              </button>
              {!n.isDigested && <span className="badge badge-info" style={{ fontSize: 11, flexShrink: 0 }}>unread</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Admin Dashboard ──────────────────────────────────────────────────────────
export function AdminDashboardPage() {
  const [tab, setTab] = useState<'metrics' | 'verification' | 'flagged' | 'domains'>('metrics');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [queue, setQueue] = useState<VerificationRecord[]>([]);
  const [flagged, setFlagged] = useState<Connection[]>([]);
  const [domains, setDomains] = useState<DomainTag[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [rejectId, setRejectId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const refreshMetrics = () => adminApi.metrics().then(setMetrics).catch(console.error);

  useEffect(() => {
    refreshMetrics();
    adminApi.verificationQueue().then(setQueue).catch(console.error);
    adminApi.flaggedConnections().then(setFlagged).catch(console.error);
    adminApi.domains().then(setDomains).catch(console.error);
  }, []);

  const advance = async (id: string) => {
    try { const r = await adminApi.advance(id); alert(`Pipeline result: ${JSON.stringify(r)}`); adminApi.verificationQueue().then(setQueue); }
    catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
  };

  const reject = async (id: string) => {
    try { await adminApi.reject(id, rejectReason || 'Rejected by admin'); setRejectId(''); setRejectReason(''); adminApi.verificationQueue().then(setQueue); }
    catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
  };

  const createDomain = async () => {
    if (!newDomain.trim()) return;
    await adminApi.createDomain(newDomain.trim()); setNewDomain(''); adminApi.domains().then(setDomains);
  };

  const STAGES = ['format_check', 'document_check', 'admin_review'];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Platform management and oversight</p>
        </div>
        <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 13 }}>Admin only</span>
      </div>

      <div className="tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex' }}>
          {([['metrics', 'Metrics'], ['verification', 'Verification'], ['flagged', 'Flagged'], ['domains', 'Domains']] as const).map(([k, label]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`}
              onClick={() => { setTab(k as typeof tab); if (k === 'metrics') refreshMetrics(); }}>{label}</button>
          ))}
        </div>
        {tab === 'metrics' && (
          <button className="btn btn-ghost btn-sm" onClick={refreshMetrics} style={{ marginBottom: 2 }}>Refresh</button>
        )}
      </div>

      {/* Metrics Tab */}
      {tab === 'metrics' && metrics && (
        <div>
          <div className="grid-stats" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Users', value: metrics.totalUsers, icon: '' },
              { label: 'Alumni Mentors', value: metrics.totalAlumni, icon: '' },
              { label: 'Students', value: metrics.totalStudents, icon: '' },
              { label: 'Active Connections', value: metrics.totalConnections, icon: '' },
              { label: 'Sessions Completed', value: metrics.totalSessionsCompleted, icon: '' },
              { label: 'Pending Requests', value: metrics.pendingRequests, icon: '' },
              { label: 'Flagged Connections', value: metrics.flaggedConnections, icon: '' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Active Mentors by Domain</div>
            {metrics.activeMentorsByDomain.map(d => (
              <div key={d.tag} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 13, width: 160, color: 'var(--text-secondary)', flexShrink: 0 }}>{d.tag}</span>
                <div className="score-bar" style={{ flex: 1 }}>
                  <div className="score-fill" style={{ width: `${Math.min((d.count / (metrics.totalAlumni || 1)) * 100, 100)}%`, background: 'var(--accent)' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, width: 30 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Tab */}
      {tab === 'verification' && (
        <div>
          {queue.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"></div><h3>Queue empty</h3><p>All registrations resolved</p></div>
          ) : queue.map(record => (
            <div key={record.id} className="verification-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="avatar avatar-md">{record.alumniProfile?.user?.fullName?.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{record.alumniProfile?.user?.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.alumniProfile?.user?.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.alumniProfile?.jobTitle} @ {record.alumniProfile?.company}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div className="pipeline-stages">
                  {STAGES.map(s => (
                    <span key={s} className={`pipeline-stage ${record.stage === s ? 'current' : STAGES.indexOf(s) < STAGES.indexOf(record.stage) ? 'done' : 'pending'}`}>
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-success btn-sm" onClick={() => advance(record.id)}>Advance </button>
                  {rejectId === record.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input" placeholder="Reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: 160, fontSize: 12, padding: '4px 10px' }} />
                      <button className="btn btn-danger btn-sm" onClick={() => reject(record.id)}>Confirm Reject</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setRejectId('')}>Cancel</button>
                    </div>
                  ) : <button className="btn btn-danger btn-sm" onClick={() => setRejectId(record.id)}>Reject</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flagged Tab */}
      {tab === 'flagged' && (
        <div>
          {flagged.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"></div><h3>No flagged connections</h3><p>All connections are healthy</p></div>
          ) : flagged.map(c => (
            <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="avatar avatar-sm">{c.student?.fullName?.charAt(0)}</div>
                <span style={{ fontWeight: 600 }}>{c.student?.fullName}</span>
                <span style={{ color: 'var(--text-muted)' }}></span>
                <div className="avatar avatar-sm">{c.alumni?.fullName?.charAt(0)}</div>
                <span style={{ fontWeight: 600 }}>{c.alumni?.fullName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="health-score" style={{ width: 160 }}>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${c.healthScore * 100}%`, background: 'var(--danger)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{(c.healthScore * 100).toFixed(0)}%</span>
                </div>
                <span className="badge badge-danger"> Flagged</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Domains Tab */}
      {tab === 'domains' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input className="form-input" placeholder="New domain tag name…" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && createDomain()} style={{ maxWidth: 280 }} />
            <button className="btn btn-primary" onClick={createDomain}>+ Add Tag</button>
          </div>
          <div className="grid-3">
            {domains.map(d => (
              <div key={d.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <span className={`badge badge-${d.status === 'active' ? 'success' : 'default'}`} style={{ marginTop: 4 }}>{d.status}</span>
                </div>
                {d.status === 'active' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => adminApi.updateDomain(d.id, { status: 'deprecated' }).then(() => adminApi.domains().then(setDomains))}>Deprecate</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
