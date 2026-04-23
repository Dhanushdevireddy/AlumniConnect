import { useEffect, useState } from 'react';
import { requests as requestsApi, MentorshipRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR: Record<string, string> = { pending: 'warning', accepted: 'success', declined: 'danger', withdrawn: 'default' };

export function RequestsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<MentorshipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const load = () => { requestsApi.list().then(setList).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const doAction = async (
    action: () => Promise<unknown>,
    successMsg: string,
    requestId?: string,
    optimisticStatus?: string
  ) => {
    // Optimistically update status in local state immediately for instant feedback
    if (requestId && optimisticStatus) {
      setList(prev => prev.map(r => r.id === requestId ? { ...r, status: optimisticStatus } : r));
    }
    try {
      await action();
      showToast(' ' + successMsg);
      load(); // background re-fetch to sync with server
    } catch (err) {
      // Revert optimistic update on failure
      if (requestId) load();
      showToast(' ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{user?.role === 'student' ? 'My Requests' : 'Mentorship Requests'}</h1>
        <p className="page-subtitle">{user?.role === 'student' ? 'Track your sent mentorship requests' : 'Review and respond to incoming requests'}</p>
      </div>

      {loading ? <div className="empty-state"><span className="loading-spinner" /></div> :
       list.length === 0 ? (
        <div className="empty-state"><div className="empty-icon"></div><h3>No requests yet</h3><p>{user?.role === 'student' ? 'Browse the alumni directory to send your first request' : 'Incoming requests will appear here'}</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {list.map(req => {
            const person = user?.role === 'student' ? req.alumni : req.student;
            return (
              <div key={req.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div className="avatar avatar-md">{person?.fullName?.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{person?.fullName}</span>
                      {user?.role === 'student' && (req.alumni as any)?.alumniProfile && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                          {(req.alumni as any).alumniProfile.jobTitle} @ {(req.alumni as any).alumniProfile.company}
                        </span>
                      )}
                    </div>
                    <span className={`badge badge-${STATUS_COLOR[req.status]}`}>{req.status}</span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>{req.message}</p>
                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {user?.role === 'alumni' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => doAction(() => requestsApi.accept(req.id), 'Request accepted!', req.id, 'accepted')}> Accept</button>
                          <button className="btn btn-danger btn-sm" onClick={() => doAction(() => requestsApi.decline(req.id), 'Request declined', req.id, 'declined')}>✗ Decline</button>
                        </>
                      )}
                      {user?.role === 'student' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => doAction(() => requestsApi.withdraw(req.id), 'Request withdrawn', req.id, 'withdrawn')}>Withdraw</button>
                      )}
                    </div>
                  )}
                  {req.status === 'accepted' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}> Connected! Head to Chat to start your mentorship journey.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {toast && <div className="toast-container"><div className={`toast ${toast.startsWith('') ? 'success' : 'error'}`}>{toast}</div></div>}
    </div>
  );
}
