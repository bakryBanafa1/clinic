import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Image, Paperclip, Search, MoreVertical, Phone, Video, CheckCircle, Clock, FileText, Image as ImageIcon, Video as VideoIcon, RefreshCw, ArrowDown, Download, ChevronUp } from 'lucide-react';
import api from '../../utils/api';
import './whatsappChat.css';

const CONTACTS_PAGE_SIZE = 30;
const MESSAGES_PAGE_SIZE = 50;

const WhatsAppChat = () => {
  // Contact list state
  const [conversations, setConversations] = useState([]);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsHasMore, setContactsHasMore] = useState(false);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [loadingMoreContacts, setLoadingMoreContacts] = useState(false);

  // Chat state
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Scroll control refs
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const contactsListRef = useRef(null);
  const isUserNearBottom = useRef(true);
  const previousMessagesCount = useRef(0);
  const shouldScrollToBottom = useRef(true);
  const initialLoadDone = useRef(false);

  // ===================== CONTACT LIST =====================

  const fetchConversations = useCallback(async (page = 1, append = false) => {
    try {
      if (page > 1) setLoadingMoreContacts(true);
      const data = await api.get(`/whatsapp-conversations/conversations?page=${page}&limit=${CONTACTS_PAGE_SIZE}&search=${searchQuery}`);
      
      if (append) {
        setConversations(prev => {
          const existing = new Set(prev.map(c => c.phone));
          const newContacts = (data.contacts || []).filter(c => !existing.has(c.phone));
          return [...prev, ...newContacts];
        });
      } else {
        setConversations(data.contacts || []);
      }
      setContactsHasMore(data.hasMore || false);
      setContactsTotal(data.total || 0);
      setContactsPage(page);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMoreContacts(false);
    }
  }, [searchQuery]);

  // Initial load
  useEffect(() => {
    fetchConversations(1, false);
  }, [fetchConversations]);

  // Refresh conversations every 8 seconds (less frequent for performance)
  useEffect(() => {
    const interval = setInterval(() => fetchConversations(1, false), 8000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Contacts infinite scroll handler
  const handleContactsScroll = useCallback(() => {
    const el = contactsListRef.current;
    if (!el || loadingMoreContacts || !contactsHasMore) return;

    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
    if (nearBottom) {
      fetchConversations(contactsPage + 1, true);
    }
  }, [contactsPage, contactsHasMore, loadingMoreContacts, fetchConversations]);

  // ===================== MESSAGES =====================

  const fetchMessages = useCallback(async (phone, beforeId = null) => {
    try {
      if (beforeId) setLoadingOlderMessages(true);
      const url = `/whatsapp-conversations/conversations/${phone}?limit=${MESSAGES_PAGE_SIZE}${beforeId ? `&before=${beforeId}` : ''}`;
      const data = await api.get(url);

      if (beforeId) {
        // Prepend older messages
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = (data.messages || []).filter(m => !existingIds.has(m.id));
          return [...newMsgs, ...prev];
        });
      } else {
        setMessages(data.messages || []);
        // Update contact name if available
        if (data.contactName && selectedContact) {
          setSelectedContact(prev => prev ? { ...prev, contactName: data.contactName } : prev);
        }
      }
      setMessagesHasMore(data.hasMore || false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [selectedContact]);

  // Load messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      shouldScrollToBottom.current = true;
      initialLoadDone.current = false;
      previousMessagesCount.current = 0;
      setMessages([]);
      setMessagesHasMore(false);
      fetchMessages(selectedContact.phone);

      // Refresh messages every 5 seconds
      const msgInterval = setInterval(() => {
        fetchMessages(selectedContact.phone);
      }, 5000);
      return () => clearInterval(msgInterval);
    }
  }, [selectedContact?.phone]);

  // Smart scroll: only auto-scroll in specific cases
  useEffect(() => {
    if (messages.length === 0) return;

    const prevCount = previousMessagesCount.current;
    const newCount = messages.length;
    const hasNewMessages = newCount > prevCount && prevCount > 0;
    
    // Determine if we should scroll
    let doScroll = false;

    if (shouldScrollToBottom.current) {
      // First load or contact switch
      doScroll = true;
      shouldScrollToBottom.current = false;
      initialLoadDone.current = true;
    } else if (hasNewMessages && isUserNearBottom.current) {
      // New message arrived and user is near bottom
      doScroll = true;
    }

    if (doScroll) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: prevCount === 0 ? 'instant' : 'smooth' });
      }, 50);
    }

    previousMessagesCount.current = newCount;
  }, [messages]);

  // Chat scroll handler for detecting position + loading older messages
  const handleChatScroll = useCallback(() => {
    const el = chatMessagesRef.current;
    if (!el) return;

    // Check if user is near bottom (within 150px)
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserNearBottom.current = distFromBottom < 150;

    // Load older messages when scrolling to top
    if (el.scrollTop < 100 && messagesHasMore && !loadingOlderMessages && messages.length > 0) {
      const oldScrollHeight = el.scrollHeight;
      const oldestId = messages[0]?.id;
      if (oldestId) {
        fetchMessages(selectedContact?.phone, oldestId).then(() => {
          // Preserve scroll position after prepending older messages
          requestAnimationFrame(() => {
            const newScrollHeight = el.scrollHeight;
            el.scrollTop = newScrollHeight - oldScrollHeight;
          });
        });
      }
    }
  }, [messagesHasMore, loadingOlderMessages, messages, selectedContact, fetchMessages]);

  // ===================== SEND =====================

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedContact || sending) return;

    setSending(true);
    shouldScrollToBottom.current = true; // Force scroll after sending
    try {
      let data;
      
      if (selectedFile) {
        const formData = new FormData();
        formData.append('message', newMessage.trim());
        formData.append('file', selectedFile.file);
        data = await api.post(`/whatsapp-conversations/conversations/${selectedContact.phone}/send`, formData);
      } else {
        data = await api.post(`/whatsapp-conversations/conversations/${selectedContact.phone}/send`, {
          message: newMessage.trim()
        });
      }

      setMessages(prev => [...prev, data]);
      setNewMessage('');
      setSelectedFile(null);

      // Update conversation list immediately
      setConversations(prev => {
        const lastMsgText = selectedFile ? ('📎 ' + (newMessage.trim() || selectedFile.file.name)) : newMessage.trim();
        const newConv = {
          ...selectedContact,
          lastMessage: lastMsgText,
          lastMessageAt: new Date().toISOString(),
          type: selectedFile ? selectedFile.type : 'text',
          direction: 'outgoing'
        };

        const existing = prev.find(c => c.phone === selectedContact.phone);
        if (existing) {
          return prev.map(c => c.phone === selectedContact.phone ? { ...c, ...newConv } : c);
        }
        return [newConv, ...prev];
      });

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
    setSelectedFile({ file, type });
    if (input) input.value = '';
  };

  // ===================== SCROLL TO BOTTOM BUTTON =====================

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ===================== FORMATTERS =====================

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

  // ===================== LAZY MEDIA COMPONENT =====================

  const LazyMedia = ({ msg }) => {
    const [loaded, setLoaded] = useState(false);
    const [mediaUrl, setMediaUrl] = useState(null);

    useEffect(() => {
      if (msg.rawPayload) {
        try {
          const payload = JSON.parse(msg.rawPayload);
          if (payload.mediaUrl) {
            setMediaUrl(payload.mediaUrl);
          } else if (payload.localMediaUrl) {
            setMediaUrl(payload.localMediaUrl.startsWith('/media/')
              ? `/api${payload.localMediaUrl}`
              : payload.localMediaUrl);
          }
        } catch (e) {}
      }
    }, [msg.rawPayload]);

    if (!loaded) {
      // Show placeholder
      return (
        <div className="media-placeholder" onClick={() => setLoaded(true)}>
          {msg.type === 'image' || msg.type === 'sticker' ? (
            <>
              <ImageIcon size={28} />
              <span>📷 {msg.content || 'صورة'}</span>
              <small>اضغط لعرض</small>
            </>
          ) : msg.type === 'video' ? (
            <>
              <VideoIcon size={28} />
              <span>🎬 {msg.content || 'فيديو'}</span>
              <small>اضغط لعرض</small>
            </>
          ) : msg.type === 'audio' ? (
            <>
              <span>🎵 مقطع صوتي</span>
              <small>اضغط للتشغيل</small>
            </>
          ) : (
            <>
              <FileText size={28} />
              <span>📄 {msg.content || 'ملف'}</span>
              <small>اضغط للتحميل</small>
            </>
          )}
        </div>
      );
    }

    // Loaded: show actual media
    if (msg.type === 'image' || msg.type === 'sticker') {
      return (
        <div className="media-image">
          {mediaUrl ? (
            <img src={mediaUrl} alt={msg.content || 'صورة'} loading="lazy" />
          ) : (
            <><ImageIcon size={32} /><span>{msg.content || 'صورة'}</span></>
          )}
          {msg.content && msg.content !== '[صورة]' && msg.content !== '[ملصق]' && (
            <p className="media-caption">{msg.content}</p>
          )}
        </div>
      );
    } else if (msg.type === 'video') {
      return (
        <div className="media-video">
          {mediaUrl ? (
            <video src={mediaUrl} controls preload="metadata" />
          ) : (
            <><VideoIcon size={32} /><span>{msg.content || 'فيديو'}</span></>
          )}
          {msg.content && msg.content !== '[فيديو]' && (
            <p className="media-caption">{msg.content}</p>
          )}
        </div>
      );
    } else if (msg.type === 'audio') {
      return (
        <div className="media-audio">
          {mediaUrl ? (
            <audio src={mediaUrl} controls />
          ) : (
            <span>[مقطع صوتي]</span>
          )}
        </div>
      );
    } else {
      return (
        <div className="media-file">
          <FileText size={20} />
          {mediaUrl ? (
            <a href={mediaUrl} target="_blank" rel="noreferrer" className="download-link">
              {msg.content || 'تحميل الملف'}
            </a>
          ) : (
            <span>{msg.content || 'ملف'}</span>
          )}
        </div>
      );
    }
  };

  // ===================== RENDER MESSAGE =====================

  const renderMessage = (msg, index) => {
    const isOutgoing = msg.direction === 'outgoing';
    const isMedia = ['image', 'video', 'document', 'file', 'audio', 'sticker'].includes(msg.type);

    return (
      <div key={msg.id || index} className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
        <div className="message-content">
          {isMedia ? (
            <div className="message-media">
              <LazyMedia msg={msg} />
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

  // ===================== RENDER =====================

  const getContactDisplayName = (contact) => {
    return contact?.contactName || contact?.phone || '';
  };

  const getContactInitials = (contact) => {
    if (contact?.contactName) {
      return contact.contactName.charAt(0);
    }
    return contact?.phone?.slice(-4) || '?';
  };

  return (
    <div className="whatsapp-chat-container">
      {/* Contact List Sidebar */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>المحادثات</h2>
          <div className="sidebar-header-actions">
            <span className="contacts-count">{contactsTotal}</span>
            <button className="icon-btn" onClick={() => fetchConversations(1, false)} title="تحديث">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="بحث بالاسم أو الرقم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div
          className="contacts-list"
          ref={contactsListRef}
          onScroll={handleContactsScroll}
        >
          {loading ? (
            <div className="loading">
              <RefreshCw size={24} className="spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty">
              <p>لا توجد محادثات</p>
            </div>
          ) : (
            <>
              {conversations.map((contact, index) => (
                <div
                  key={contact.phone || index}
                  className={`contact-item ${selectedContact?.phone === contact.phone ? 'active' : ''}`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="contact-avatar">
                    {getContactInitials(contact)}
                  </div>
                  <div className="contact-info">
                    <div className="contact-header">
                      <span className="contact-name">{getContactDisplayName(contact)}</span>
                      <span className="contact-time">{formatDate(contact.lastMessageAt)}</span>
                    </div>
                    {contact.contactName && (
                      <div className="contact-phone-sub">{contact.phone}</div>
                    )}
                    <div className="contact-preview">
                      {getMessageIcon(contact.type)}
                      <span>{contact.lastMessage || '...'}</span>
                    </div>
                  </div>
                </div>
              ))}
              {loadingMoreContacts && (
                <div className="loading-more">
                  <RefreshCw size={18} className="spin" />
                  <span>تحميل المزيد...</span>
                </div>
              )}
              {!contactsHasMore && conversations.length > 0 && conversations.length >= CONTACTS_PAGE_SIZE && (
                <div className="end-of-list">
                  <span>نهاية القائمة</span>
                </div>
              )}
            </>
          )}
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
                  {getContactInitials(selectedContact)}
                </div>
                <div>
                  <h3>{getContactDisplayName(selectedContact)}</h3>
                  <p>
                    {selectedContact.contactName && (
                      <span className="header-phone">{selectedContact.phone} · </span>
                    )}
                    {messages.length} رسالة
                  </p>
                </div>
              </div>
              <div className="header-actions">
                <button title="مكالمة"><Phone size={18} /></button>
                <button title="فيديو"><Video size={18} /></button>
                <button title="مزيد"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              className="chat-messages"
              ref={chatMessagesRef}
              onScroll={handleChatScroll}
            >
              {/* Load older messages indicator */}
              {loadingOlderMessages && (
                <div className="loading-older">
                  <RefreshCw size={16} className="spin" />
                  <span>تحميل رسائل أقدم...</span>
                </div>
              )}
              {messagesHasMore && !loadingOlderMessages && (
                <div className="load-older-hint">
                  <ChevronUp size={16} />
                  <span>اسحب للأعلى لتحميل رسائل أقدم</span>
                </div>
              )}

              {messages.length === 0 && !loadingOlderMessages ? (
                <div className="no-messages">
                  <p>لا توجد رسائل بعد</p>
                </div>
              ) : messages.map((msg, index) => renderMessage(msg, index))}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            {!isUserNearBottom.current && initialLoadDone.current && (
              <button className="scroll-to-bottom-btn" onClick={scrollToBottom}>
                <ArrowDown size={20} />
              </button>
            )}

            {/* Input Area */}
            <div className="chat-input-wrapper">
              {selectedFile && (
                <div className="file-preview-container">
                  <div className="file-preview">
                    {selectedFile.type === 'image' ? (
                      <img src={URL.createObjectURL(selectedFile.file)} alt="preview" />
                    ) : (
                      <div className="file-icon"><FileText size={24} /> <span>{selectedFile.file.name}</span></div>
                    )}
                    <button className="remove-file-btn" onClick={() => setSelectedFile(null)}>✕</button>
                  </div>
                </div>
              )}
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
                disabled={(!newMessage.trim() && !selectedFile) || sending}
              >
                {sending ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
              </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WhatsAppChat;
