import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const { login, loading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try { await login(form.email, form.password); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, background: 'linear-gradient(135deg, #6366f1, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>AlumniConnect</div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your mentorship platform</p>
        </div>
        {error && <div className="toast error" style={{ marginBottom: 16 }}>{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@university.edu" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            {loading ? <span className="loading-spinner" /> : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
          No account? <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Create one</button>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const { register, loading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'student', university: '', company: '', jobTitle: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try { await register(form); }
    catch (err) { setError(err instanceof Error ? err.message : 'Registration failed'); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 900, background: 'linear-gradient(135deg, #6366f1, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>AlumniConnect</div>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Join the mentorship community</p>
        </div>
        {error && <div className="toast error" style={{ marginBottom: 16 }}>{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="Alex Johnson" required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@university.edu" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min 8 characters" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">I am a…</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {['student', 'alumni'].map(r => (
                <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${form.role === r ? 'var(--accent)' : 'var(--border)'}`, background: form.role === r ? 'var(--accent-subtle)' : 'var(--bg-input)', color: form.role === r ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  {r === 'student' ? ' Student' : ' Alumni'}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">University</label>
            <input className="form-input" placeholder="Institution Name (e.g., IIT Madras)" required value={form.university} onChange={e => setForm(f => ({ ...f, university: e.target.value }))} />
          </div>
          {form.role === 'alumni' && (
            <>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input className="form-input" placeholder="Google, Inc." value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input className="form-input" placeholder="Senior Software Engineer" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
              </div>
            </>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            {loading ? <span className="loading-spinner" /> : 'Create Account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account? <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Sign in</button>
        </p>
        {form.role === 'alumni' && <div className="toast" style={{ marginTop: 16, fontSize: 12 }}> Alumni accounts require admin verification before appearing in the directory.</div>}
      </div>
    </div>
  );
}
