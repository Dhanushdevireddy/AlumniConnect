import { useEffect, useState } from 'react';
import { connections as connApi, sessions as sessionApi, Connection, Session } from '../api/client';
import { useAuth } from '../context/AuthContext';

function SessionCard({ session, userId, onAction }: { session: Session; userId: string; onAction: () => void }) {
  const [loading, setLoading] = useState(false);
  const start = new Date(session.slotStart);
  const end = new Date(session.slotEnd);
  const isPast = end < new Date();
  const STATUS_COLOR: Record<string,string> = { proposed: 'warning', confirmed: 'success', cancelled: 'danger', completed: 'info' };

  const act = async (fn: () => Promise<unknown>) => { setLoading(true); try { await fn(); onAction(); } catch (e) { alert(e instanceof Error ? e.message : 'Error'); } finally { setLoading(false); }};

  return (
    <div className="card session-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="session-time">{start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="session-meta" style={{ marginTop: 6 }}>
            <span> {Math.round((end.getTime() - start.getTime()) / 60000)} min</span>
            {session.meetingLink && <a href={session.meetingLink} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }}> Join Meeting</a>}
          </div>
        </div>
        <span className={`badge badge-${STATUS_COLOR[session.status] || 'default'}`}>{session.status}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {session.status === 'proposed' && session.proposedById !== userId && (
          <button className="btn btn-success btn-sm" disabled={loading} onClick={() => act(() => sessionApi.confirm(session.id))}> Confirm</button>
        )}
        {['proposed', 'confirmed'].includes(session.status) && (
          <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => act(() => sessionApi.cancel(session.id))}>Cancel</button>
        )}
        {session.status === 'confirmed' && isPast && (
          <>
            <button className="btn btn-primary btn-sm" disabled={loading} onClick={() => act(() => sessionApi.attendance(session.id, true))}> I attended</button>
            <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => act(() => sessionApi.attendance(session.id, false))}>I didn't attend</button>
          </>
        )}
      </div>
    </div>
  );
}

export function SessionsPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showPropose, setShowPropose] = useState(false);
  const [proposeForm, setProposeForm] = useState({ slotStart: '', slotEnd: '' });

  useEffect(() => { connApi.list().then(setConnections).catch(console.error); }, []);
  const loadSessions = () => { if (selectedConn) connApi.getSessions(selectedConn.id).then(setSessions).catch(console.error); };
  useEffect(() => { loadSessions(); }, [selectedConn?.id]);

  const proposeSession = async () => {
    if (!selectedConn || !proposeForm.slotStart || !proposeForm.slotEnd) return;
    try {
      await connApi.proposeSessions(selectedConn.id, { slotStart: proposeForm.slotStart, slotEnd: proposeForm.slotEnd });
      setShowPropose(false); setProposeForm({ slotStart: '', slotEnd: '' }); loadSessions();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const partner = selectedConn ? (selectedConn.studentId === user?.id ? selectedConn.alumni : selectedConn.student) : null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sessions</h1>
        <p className="page-subtitle">Schedule and manage virtual mentorship sessions</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Connection picker */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Your Connections</div>
          {connections.length === 0 ? <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>No connections yet</div> : connections.map(conn => {
            const p = conn.studentId === user?.id ? conn.alumni : conn.student;
            return <div key={conn.id} className={`connection-item ${selectedConn?.id === conn.id ? 'active' : ''}`} onClick={() => setSelectedConn(conn)}>
              <div className="avatar avatar-sm">{p?.fullName?.charAt(0)}</div>
              <span className="conn-name">{p?.fullName}</span>
            </div>;
          })}
        </div>

        {/* Session list */}
        <div>
          {!selectedConn ? (
            <div className="empty-state"><div className="empty-icon"></div><h3>Select a connection</h3><p>to view and schedule sessions</p></div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontWeight: 700, fontSize: 18 }}>Sessions with {partner?.fullName}</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowPropose(true)}>+ Propose Session</button>
              </div>
              {sessions.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}><div className="empty-icon"></div><h3>No sessions yet</h3><p>Propose a time slot to get started</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {sessions.map(s => <SessionCard key={s.id} session={s} userId={user?.id || ''} onAction={loadSessions} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Propose Modal */}
      {showPropose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 420 }}>
            <div className="card-header"><h2 style={{ fontSize: 18, fontWeight: 700 }}>Propose a Session</h2><button className="btn btn-ghost btn-sm" onClick={() => setShowPropose(false)}></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group"><label className="form-label">Start time</label><input type="datetime-local" className="form-input" value={proposeForm.slotStart} onChange={e => setProposeForm(f => ({ ...f, slotStart: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">End time</label><input type="datetime-local" className="form-input" value={proposeForm.slotEnd} onChange={e => setProposeForm(f => ({ ...f, slotEnd: e.target.value }))} /></div>
              <button className="btn btn-primary" onClick={proposeSession} style={{ justifyContent: 'center' }}>Send Proposal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
