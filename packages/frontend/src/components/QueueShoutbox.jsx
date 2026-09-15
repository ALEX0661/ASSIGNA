import { useState, useEffect, useRef } from 'react'
import { getQueueMessages, postQueueMessage } from '../services/api'

export function QueueShoutbox({ queueId, currentProgram, role = "coordinator", userName = "" }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!queueId) return
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [queueId])

  async function loadMessages() {
    try {
      const msgs = await getQueueMessages(queueId)
      setMessages(msgs || [])
    } catch (e) {
      if (e.message !== 'Not authenticated') {
        console.error("Failed to load messages", e)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return
    
    setSending(true)
    const text = input.trim()
    setInput('')
    
    try {
      const optMsg = {
        id: 'temp-' + Date.now(),
        message: text,
        sender: role === 'admin' ? 'Admin' : currentProgram || userName || 'Coordinator',
        role: role,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, optMsg])
      
      await postQueueMessage(queueId, text, optMsg.sender)
      await loadMessages()
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  if (!queueId) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 400, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--hover)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Queue Chatter
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg)' }}>
        {loading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 20 }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 20 }}>No messages yet. Say hi!</div>
        ) : (
          messages.map(m => {
            const isMe = m.sender === (role === 'admin' ? 'Admin' : currentProgram || userName || 'Coordinator') || (m.id && m.id.startsWith('temp-'))
            const isAdmin = m.role === 'admin' || m.sender === 'Admin'
            return (
              <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 4, textAlign: isMe ? 'right' : 'left', fontWeight: isAdmin ? 700 : 500 }}>
                  {m.sender} {isAdmin && <span style={{ color: 'var(--blue, #3B82F6)', background: 'var(--blue-soft, #DBEAFE)', padding: '1px 4px', borderRadius: 4, marginLeft: 4 }}>Admin</span>}
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 12, background: isMe ? 'var(--meadow-soft, #E6F0EB)' : '#fff', border: isMe ? '1px solid var(--meadow-border, #C1D8CD)' : '1px solid var(--border)', color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.4 }}>
                  {m.message}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', padding: 12, borderTop: '1px solid var(--border)', background: '#fff', gap: 8 }}>
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 20, outline: 'none', fontSize: 13, fontFamily: 'inherit' }}
        />
        <button type="submit" disabled={!input.trim() || sending} style={{ background: 'var(--meadow, #1B4D3E)', color: '#fff', border: 'none', borderRadius: 20, padding: '0 16px', fontWeight: 600, fontSize: 13, cursor: input.trim() && !sending ? 'pointer' : 'default', opacity: input.trim() && !sending ? 1 : 0.6 }}>
          Send
        </button>
      </form>
    </div>
  )
}
