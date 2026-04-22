import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, Paperclip, Search, MoreVertical, Phone, Video, CheckCircle, Clock, FileText, Image as ImageIcon, Video as VideoIcon, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import './whatsappChat.css';

const WhatsAppChat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Refresh conversations every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.phone);
      // Refresh messages every 3 seconds
      const msgInterval = setInterval(() => {
        fetchMessages(selectedContact.phone);
      }, 3000);
      return () => clearInterval(msgInterval);
    }
  }, [selectedContact]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const data = await api.get('/whatsapp-conversations/conversations');
      setConversations(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (phone) => {
    try {
      const data = await api.get(`/whatsapp-conversations/conversations/${phone}`);
      setMessages(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact || sending) return;

    setSending(true);
    try {
      const data = await api.post(`/whatsapp-conversations/conversations/${selectedContact.phone}/send`, {
        message: newMessage.trim()
      });

      setMessages(prev => [...prev, data]);
      setNewMessage('');

      // Update conversation list immediately
      setConversations(prev => {
        const existing = prev.find(c => c.phone === selectedContact.phone);
        const newConv = {
          phone: selectedContact.phone,
          lastMessage: newMessage.trim(),
          lastMessageAt: new Date().toISOString(),
          type: 'text',
          direction: 'outgoing'
        };

        if (existing) {
          return prev.map(c => c.phone === selectedContact.phone ? newConv : c);
        }
        return [newConv, ...prev];
      });

      // Refresh messages
      fetchMessages(selectedContact.phone);
    } catch (err) {
      console.error(err);
      alert(err.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e, type = 'file') => {
    const input = type === 'image' ? imageInputRef.current : fileInputRef.current;
    if (!input?.files?.length || !selectedContact) return;

    const file = input.files[0];
    setSending(true);

    try {
      const formData = new FormData();
      formData.append('message', file.name);
      formData.append('mediaUrl', ''); // Will need file upload to CDN

      const data = await api.post(`/whatsapp-conversations/conversations/${selectedContact.phone}/send`, formData);

      setMessages(prev => [...prev, data]);

      // Update conversation
      setConversations(prev => {
        const newConv = {
          phone: selectedContact.phone,
          lastMessage: '📎 ' + file.name,
          lastMessageAt: new Date().toISOString(),
          type: type === 'image' ? 'image' : 'file',
          direction: 'outgoing'
        };

        const existing = prev.find(c => c.phone === selectedContact.phone);
        if (existing) {
          return prev.map(c => c.phone === selectedContact.phone ? newConv : c);
        }
        return [newConv, ...prev];
      });

      fetchMessages(selectedContact.phone);
    } catch (err) {
      console.error(err);
      alert(err.message || 'فشل إرسال المرفق');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'اليوم';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'أمس';
    } else {
      return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
    }
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'image': return <ImageIcon size={14} />;
      case 'video': return <VideoIcon size={14} />;
      case 'document':
      case 'file': return <FileText size={14} />;
      default: return null;
    }
  };

  const renderMessage = (msg, index) => {
    const isOutgoing = msg.direction === 'outgoing';
    const isMedia = ['image', 'video', 'document', 'file'].includes(msg.type);

    return (
      <div key={msg.id || index} className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
        <div className="message-content">
          {isMedia ? (
            <div className="message-media">
              {msg.type === 'image' ? (
                <div className="media-image">
                  <ImageIcon size={32} />
                  <span>{msg.content || 'صورة'}</span>
                </div>
              ) : (
                <div className="media-file">
                  <FileText size={20} />
                  <span>{msg.content || 'ملف'}</span>
                </div>
              )}
            </div>
          ) : (
            <p>{msg.content}</p>
          )}

          <div className="message-meta">
            <span className="time">{formatTime(msg.createdAt)}</span>
            {isOutgoing && (
              <span className="status">
                {msg.status === 'read' ? <CheckCircle size={12} className="read" /> :
                 msg.status === 'delivered' ? <CheckCircle size={12} /> :
                 <Clock size={12} />}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const filteredConversations = conversations.filter(c =>
    c.phone.includes(searchQuery)
  );

  return (
    <div className="whatsapp-chat-container">
      {/* Contact List Sidebar */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>المحادثات</h2>
          <button className="icon-btn" onClick={fetchConversations} title="تحديث">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="contacts-list">
          {loading ? (
            <div className="loading">
              <RefreshCw size={24} className="spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="empty">
              <p>لا توجد محادثات</p>
            </div>
          ) : filteredConversations.map((contact, index) => (
            <div
              key={contact.phone || index}
              className={`contact-item ${selectedContact?.phone === contact.phone ? 'active' : ''}`}
              onClick={() => setSelectedContact(contact)}
            >
              <div className="contact-avatar">
                {contact.phone.slice(-4)}
              </div>
              <div className="contact-info">
                <div className="contact-header">
                  <span className="contact-name">{contact.phone}</span>
                  <span className="contact-time">{formatDate(contact.lastMessageAt)}</span>
                </div>
                <div className="contact-preview">
                  {getMessageIcon(contact.type)}
                  <span>{contact.lastMessage || '...'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-main">
        {!selectedContact ? (
          <div className="no-chat-selected">
            <div className="icon">💬</div>
            <h3>اختر محادثة للبدء</h3>
            <p>اختر جهة اتصال من القائمة لعرض المحادثة</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="header-info">
                <div className="contact-avatar small">
                  {selectedContact.phone.slice(-4)}
                </div>
                <div>
                  <h3>{selectedContact.phone}</h3>
                  <p>{messages.length} رسالة</p>
                </div>
              </div>
              <div className="header-actions">
                <button title="مكالمة"><Phone size={18} /></button>
                <button title="فيديو"><Video size={18} /></button>
                <button title="مزيد"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>لا توجد رسائل بعد</p>
                </div>
              ) : messages.map((msg, index) => renderMessage(msg, index))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chat-input">
              <div className="input-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileSelect(e, 'file')}
                  style={{ display: 'none' }}
                />
                <button onClick={() => fileInputRef.current?.click()} title="مرفق">
                  <Paperclip size={20} />
                </button>

                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  onChange={(e) => handleFileSelect(e, 'image')}
                  style={{ display: 'none' }}
                />
                <button onClick={() => imageInputRef.current?.click()} title="صورة">
                  <Image size={20} />
                </button>
              </div>

              <div className="input-field">
                <input
                  type="text"
                  placeholder="اكتب رسالة..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
              </div>

              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WhatsAppChat;
