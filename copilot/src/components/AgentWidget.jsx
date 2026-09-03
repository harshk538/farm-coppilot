import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Bot, X, Send, Paperclip, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

// The "do everything from one command" assistant — a floating chat bubble
// available on every page. Unlike a normal FAQ chatbot, this one can
// actually DO things on the farmer's behalf: fetch a soil report, diagnose
// an attached photo, and (after an explicit confirm step) place a real
// order — all from one plain-language message, in the farmer's own
// language. See server/routes/agent.js for how it's wired up.

export default function AgentWidget({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! Tell me what you need — for example \"make my soil report\" or send a photo of a crop problem." },
  ]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null); // { file, previewUrl }
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage({ file, previewUrl: URL.createObjectURL(file) });
    e.target.value = '';
  };

  const send = async () => {
    if (!input.trim() && !image) return;
    const userMsg = { role: 'user', text: input.trim() || '(photo attached)', imagePreview: image?.previewUrl || null };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    const attachedImage = image;
    setImage(null);
    setLoading(true);

    try {
      const form = new FormData();
      form.append('message', userMsg.text);
      form.append('userId', user?.id || '');
      form.append('history', JSON.stringify(nextMessages.map(m => ({ role: m.role, text: m.text }))));
      if (attachedImage) form.append('image', attachedImage.file);

      const res = await axios.post(`${API_BASE_URL}/api/agent/chat`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const replyText = res.data?.success ? res.data.reply : (res.data?.message || 'Something went wrong. Please try again.');
      setMessages(m => [...m, { role: 'assistant', text: replyText }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', text: 'Could not reach the assistant. Please check your connection and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(139,92,246,0.4)',
        }}
      >
        {open ? <X size={24} color="#fff" /> : <Bot size={26} color="#fff" />}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 1000,
          width: 360, maxWidth: 'calc(100vw - 32px)', height: 480, maxHeight: 'calc(100vh - 140px)',
          background: '#131316', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} color="#a78bfa" />
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Farm Copilot Assistant</div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                {m.imagePreview && (
                  <img src={m.imagePreview} alt="attached" style={{ width: 120, borderRadius: 8, marginBottom: 6, display: 'block' }} />
                )}
                <div style={{
                  padding: '8px 12px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)',
                  color: '#eee',
                  border: m.role === 'user' ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#999', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Working on it…
              </div>
            )}
          </div>

          {image && (
            <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={image.previewUrl} alt="preview" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
              <span style={{ color: '#aaa', fontSize: 12 }}>Photo attached</span>
              <button onClick={() => setImage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          )}

          <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', padding: 6 }}
              aria-label="Attach photo"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type or ask anything…"
              rows={1}
              style={{
                flex: 1, resize: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 13.5, outline: 'none', maxHeight: 80,
              }}
            />
            <button
              onClick={send}
              disabled={loading || (!input.trim() && !image)}
              style={{
                background: '#8b5cf6', border: 'none', borderRadius: 10, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                opacity: loading || (!input.trim() && !image) ? 0.5 : 1,
              }}
              aria-label="Send"
            >
              <Send size={16} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
