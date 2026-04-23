import { useEffect, useState } from 'react';
import { alumni as alumniApi, requests as requestsApi, AlumniProfile } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function AlumniDirectoryPage({ navigate: _navigate }: { navigate?: (page: string, params?: Record<string,string>) => void }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<AlumniProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', company: '', availability: '' });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [toastMsg, setToastMsg] = useState('');
  const [requestingId, setRequestingId] = useState('');
  const [showRequestModal, setShowRequestModal] = useState<AlumniProfile | null>(null);
  const [requestForm, setRequestForm] = useState({ message: '', goals: '' });

  const fetchAlumni = async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = { page: String(page), limit: '12' };
      if (filters.search) params.search = filters.search;
      if (filters.company) params.company = filters.company;
      if (filters.availability) params.availability = filters.availability;
      const res = await alumniApi.list(params);
      setProfiles(res.data);
      setTotal(res.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAlumni(); }, [filters, page]);

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const sendRequest = async () => {
    if (!showRequestModal || !requestForm.message) return;
    setRequestingId(showRequestModal.userId);
    try {
      await requestsApi.submit({ alumniId: showRequestModal.userId, message: requestForm.message, goals: requestForm.goals });
      toast(' Mentorship request sent!');
      setShowRequestModal(null);
      setRequestForm({ message: '', goals: '' });
    } catch (err) { toast(' ' + (err instanceof Error ? err.message : 'Failed')); }
    finally { setRequestingId(''); }
  };

  const scoreColor = (score: number) => score > 0.7 ? 'var(--success)' : score > 0.4 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Alumni Directory</h1>
        <p className="page-subtitle">Discover verified mentors ranked by compatibility — {total} mentors available</p>
      </div>

      <div className="filter-bar">
        <input className="form-input" placeholder=" Search by name…" value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} />
        <input className="form-input" placeholder="Company" value={filters.company} onChange={e => { setFilters(f => ({ ...f, company: e.target.value })); setPage(1); }} />
        <select className="form-select" style={{ width: 160 }} value={filters.availability} onChange={e => { setFilters(f => ({ ...f, availability: e.target.value })); setPage(1); }}>
          <option value="">All availability</option>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {loading ? (
        <div className="empty-state"><span className="loading-spinner" /></div>
      ) : profiles.length === 0 ? (
        <div className="empty-state"><div className="empty-icon"></div><h3>No mentors found</h3><p>Try adjusting your filters</p></div>
      ) : (
        <div className="grid-3">
          {profiles.map(profile => (
            <div key={profile.id} className="card alumni-card" onClick={() => setShowRequestModal(profile)}>
              <div className="alumni-card-header">
                <div className="avatar avatar-md">{profile.user.fullName.charAt(0)}</div>
                <div className="alumni-info">
                  <div className="alumni-name">{profile.user.fullName}</div>
                  <div className="alumni-title">{profile.jobTitle || 'Professional'}</div>
                  <div className="alumni-company">{profile.company}</div>
                </div>
                <span className={`badge badge-${profile.availabilityStatus === 'available' ? 'success' : profile.availabilityStatus === 'busy' ? 'warning' : 'danger'}`}>
                  {profile.availabilityStatus}
                </span>
              </div>

              {profile.bio && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{profile.bio}</p>}

              <div className="alumni-tags">
                {profile.domainTags?.slice(0, 3).map(t => <span key={t.id} className="tag">{t.name}</span>)}
                {(profile.domainTags?.length || 0) > 3 && <span className="tag">+{profile.domainTags.length - 3}</span>}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Relevance score</span><span>{(profile.rankingScore * 100).toFixed(0)}%</span>
                </div>
                <div className="score-bar">
                  <div className="score-fill" style={{ width: `${profile.rankingScore * 100}%`, background: scoreColor(profile.rankingScore) }} />
                </div>
              </div>

              <div className="alumni-meta">
                <span> {profile.sessionsConducted} sessions</span>
                <span> {(profile.responseRate * 100).toFixed(0)}% response</span>
                <span> {(profile.profileCompletenessScore * 100).toFixed(0)}% profile</span>
              </div>

              {user?.role === 'student' && (
                <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} disabled={requestingId === profile.userId} onClick={e => { e.stopPropagation(); setShowRequestModal(profile); }}>
                  {requestingId === profile.userId ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : ' Request Mentorship'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Page {page}</span>
          <button className="btn btn-ghost btn-sm" disabled={profiles.length < 12} onClick={() => setPage(p => p + 1)}>Next </button>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Request Mentorship</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRequestModal(null)}> Close</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px', background: 'var(--bg-input)', borderRadius: 10 }}>
              <div className="avatar avatar-md">{showRequestModal.user.fullName.charAt(0)}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{showRequestModal.user.fullName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{showRequestModal.jobTitle} @ {showRequestModal.company}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Your message *</label>
                <textarea className="form-textarea" placeholder="Hi! I'm a 2nd year M.Tech student interested in…" value={requestForm.message} onChange={e => setRequestForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Goals (optional)</label>
                <input className="form-input" placeholder="Career guidance in AI/ML, resume review…" value={requestForm.goals} onChange={e => setRequestForm(f => ({ ...f, goals: e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={sendRequest} disabled={!requestForm.message || requestingId === showRequestModal.userId} style={{ justifyContent: 'center' }}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && <div className="toast-container"><div className={`toast ${toastMsg.startsWith('') ? 'success' : 'error'}`}>{toastMsg}</div></div>}
    </div>
  );
}
