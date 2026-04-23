import React, { useEffect, useState, useRef, useCallback } from 'react';
import { connections as connApi, createChatWebSocket, Connection, ChatMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const RECONNECT_DELAY = 5000;

export function ChatPage() {
  const { user } = useAuth();
  const [connList, setConnList] = useState<Connection[]>([]);
  const [activeConn, setActiveConn] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [presence, setPresence] = useState<Record<string, 'online' | 'offline'>>({});
  const [uploading, setUploading] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load connections
  useEffect(() => {
    connApi.list().then(setConnList).catch(console.error);
  }, []);

  // Load message history when connection selected
  useEffect(() => {
    if (!activeConn) return;
    connApi.messages(activeConn.id).then(r => setMessages(r.messages)).catch(console.error);
    connectWs(activeConn.id);
    return () => { wsRef.current?.close(); if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); };
  }, [activeConn?.id]);

  // Scroll to bottom
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const connectWs = useCallback((connectionId: string) => {
    if (wsRef.current) wsRef.current.close();
    setWsStatus('connecting');
    const ws = createChatWebSocket(connectionId);
    wsRef.current = ws;

    ws.onopen = () => { setWsStatus('connected'); if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); };
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'message') setMessages(prev => [...prev, data.data]);
      if (data.type === 'presence') setPresence(prev => ({ ...prev, [data.userId]: data.status }));
    };
    ws.onclose = () => {
      setWsStatus('disconnected');
      reconnectTimerRef.current = setTimeout(() => connectWs(connectionId), RECONNECT_DELAY);
    };
    ws.onerror = () => ws.close();
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !activeConn) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content: input.trim() }));
    } else {
      // REST fallback
      connApi.sendMessage(activeConn.id, input.trim()).then(msg => setMessages(prev => [...prev, msg]));
    }
    setInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConn) return;
    setUploading(true);
    try {
      const msg = await connApi.uploadFile(activeConn.id, file);
      setMessages(prev => [...prev, msg]);
    } catch (err) { alert('Upload failed: ' + (err instanceof Error ? err.message : err)); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const partner = activeConn ? (activeConn.studentId === user?.id ? activeConn.alumni : activeConn.student) : null;
  const partnerId = partner?.id || '';
  const isOnline = presence[partnerId] === 'online';

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', gap: 0, marginTop: -32, marginLeft: -32, marginRight: -32 }}>
      {/* Connection sidebar */}
      <div className="chat-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15 }}> Messages</div>
        {connList.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No connections yet.<br />Accept/send a mentorship request first.</div>
        ) : connList.map(conn => {
          const p = conn.studentId === user?.id ? conn.alumni : conn.student;
          const isAct = activeConn?.id === conn.id;
          return (
            <div key={conn.id} className={`connection-item ${isAct ? 'active' : ''}`} onClick={() => setActiveConn(conn)}>
              <div className="avatar avatar-sm">{p?.fullName?.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="conn-name">{p?.fullName}</div>
                {conn.isFlagged && <div style={{ fontSize: 11, color: 'var(--warning)' }}> Low engagement</div>}
              </div>
              {presence[p?.id || ''] === 'online' && <span className="presence-dot online" />}
            </div>
          );
        })}
      </div>

      {/* Chat thread */}
      <div className="chat-thread" style={{ flex: 1 }}>
        {!activeConn ? (
          <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-icon"></div>
            <h3>Select a conversation</h3>
            <p>Choose a connection from the left</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-header">
              <div className="avatar avatar-sm">{partner?.fullName?.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{partner?.fullName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
                  <span style={{ color: isOnline ? 'var(--success)' : 'var(--text-muted)' }}>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
              <span style={{ fontSize: 12, color: wsStatus === 'connected' ? 'var(--success)' : wsStatus === 'connecting' ? 'var(--warning)' : 'var(--danger)' }}>
                {wsStatus === 'connected' ? ' Live' : wsStatus === 'connecting' ? ' Connecting…' : ' Reconnecting…'}
              </span>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.map(msg => {
                const isMine = msg.senderId === user?.id;
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', gap: 8 }}>
                    {!isMine && <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>{partner?.fullName?.charAt(0)}</div>}
                    <div className={`chat-bubble ${isMine ? 'sent' : 'received'}`}>
                      {msg.messageType === 'file' ? (
                        <a href={`http://localhost:3001${msg.fileUrl}`} target="_blank" rel="noreferrer"
                           style={{ display: 'flex', alignItems: 'center', gap: 8, color: isMine ? '#fff' : 'var(--accent)' }}>
                           {msg.fileName || 'Document.pdf'}
                        </a>
                      ) : (
                        <span>{msg.content}</span>
                      )}
                      <div className="bubble-time">{formatTime(msg.sentAt)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Input bar */}
            <div className="chat-input-bar">
              <input type="file" accept=".pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach PDF">
                {uploading ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : ''}
              </button>
              <input
                className="form-input"
                placeholder="Type a message…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!input.trim()}>Send </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
