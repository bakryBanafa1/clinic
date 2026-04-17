import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, RefreshCw, LogOut, Smartphone, AlertCircle, CheckCircle2, QrCode, Bell, BookOpen, Send, Copy, Check, Search, ChevronDown, Eye, MessageSquare } from 'lucide-react';
import api from '../../utils/api';
import './whatsapp.css';

// ===================== EVOLUTION API DOCS DATA =====================
const API_DOCS = [
  {
    section: 'Instance',
    icon: '🖥️',
    endpoints: [
      { method: 'POST', path: '/instance/create', desc: 'إنشاء نسخة جديدة', body: '{\n  "instanceName": "myInstance",\n  "qrcode": true,\n  "integration": "WHATSAPP-BAILEYS"\n}' },
      { method: 'GET', path: '/instance/fetchInstances', desc: 'جلب جميع النسخ', body: null },
      { method: 'GET', path: '/instance/connectionState/{instanceName}', desc: 'حالة اتصال النسخة', body: null },
      { method: 'GET', path: '/instance/connect/{instanceName}', desc: 'الاتصال وجلب QR Code', body: null },
      { method: 'DELETE', path: '/instance/logout/{instanceName}', desc: 'تسجيل الخروج من النسخة', body: null },
      { method: 'DELETE', path: '/instance/delete/{instanceName}', desc: 'حذف النسخة بالكامل', body: null },
      { method: 'PUT', path: '/instance/restart/{instanceName}', desc: 'إعادة تشغيل النسخة', body: null },
      { method: 'POST', path: '/instance/setPresence/{instanceName}', desc: 'تعيين حالة الحضور', body: '{\n  "presence": "available"\n}' },
    ]
  },
  {
    section: 'Messages',
    icon: '💬',
    endpoints: [
      { method: 'POST', path: '/message/sendText/{instanceName}', desc: 'إرسال رسالة نصية', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "text": "مرحباً!"\n}' },
      { method: 'POST', path: '/message/sendMedia/{instanceName}', desc: 'إرسال وسائط (صورة/فيديو/ملف)', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "mediatype": "image",\n  "media": "https://example.com/image.jpg",\n  "caption": "وصف الصورة"\n}' },
      { method: 'POST', path: '/message/sendWhatsAppAudio/{instanceName}', desc: 'إرسال رسالة صوتية', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "audio": "https://example.com/audio.mp3"\n}' },
      { method: 'POST', path: '/message/sendSticker/{instanceName}', desc: 'إرسال ملصق', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "sticker": "https://example.com/sticker.webp"\n}' },
      { method: 'POST', path: '/message/sendLocation/{instanceName}', desc: 'إرسال موقع', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "latitude": 24.7136,\n  "longitude": 46.6753,\n  "name": "الرياض",\n  "address": "المملكة العربية السعودية"\n}' },
      { method: 'POST', path: '/message/sendContact/{instanceName}', desc: 'إرسال جهة اتصال', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "contact": [{\n    "fullName": "أحمد محمد",\n    "wuid": "966XXXXXXXXX",\n    "phoneNumber": "+966XXXXXXXXX"\n  }]\n}' },
      { method: 'POST', path: '/message/sendReaction/{instanceName}', desc: 'إرسال تفاعل على رسالة', body: '{\n  "key": {\n    "remoteJid": "966XXXXXXXXX@s.whatsapp.net",\n    "id": "MESSAGE_ID"\n  },\n  "reaction": "👍"\n}' },
      { method: 'POST', path: '/message/sendPoll/{instanceName}', desc: 'إرسال استطلاع رأي', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "name": "ما رأيك؟",\n  "selectableCount": 1,\n  "values": ["ممتاز", "جيد", "متوسط"]\n}' },
      { method: 'POST', path: '/message/sendList/{instanceName}', desc: 'إرسال قائمة تفاعلية', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "title": "القائمة",\n  "description": "اختر خياراً",\n  "buttonText": "عرض الخيارات",\n  "sections": [{\n    "title": "القسم 1",\n    "rows": [{"title": "خيار 1", "description": "وصف"}]\n  }]\n}' },
      { method: 'POST', path: '/message/sendButtons/{instanceName}', desc: 'إرسال أزرار تفاعلية', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "title": "العنوان",\n  "description": "الوصف",\n  "buttons": [\n    {"buttonText": {"displayText": "زر 1"}, "buttonId": "id1"},\n    {"buttonText": {"displayText": "زر 2"}, "buttonId": "id2"}\n  ]\n}' },
      { method: 'POST', path: '/message/sendTemplate/{instanceName}', desc: 'إرسال قالب رسالة معتمد', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "name": "template_name",\n  "language": "ar",\n  "components": []\n}' },
    ]
  },
  {
    section: 'Chat',
    icon: '📱',
    endpoints: [
      { method: 'POST', path: '/chat/whatsappNumbers/{instanceName}', desc: 'التحقق من أرقام الواتساب', body: '{\n  "numbers": ["966XXXXXXXXX"]\n}' },
      { method: 'POST', path: '/chat/findMessages/{instanceName}', desc: 'البحث في الرسائل', body: '{\n  "where": {\n    "key": {\n      "remoteJid": "966XXXXXXXXX@s.whatsapp.net"\n    }\n  },\n  "limit": 20\n}' },
      { method: 'PUT', path: '/chat/markMessageAsRead/{instanceName}', desc: 'تعيين رسالة كمقروءة', body: '{\n  "readMessages": [{\n    "remoteJid": "966XXXXXXXXX@s.whatsapp.net",\n    "id": "MESSAGE_ID"\n  }]\n}' },
      { method: 'PUT', path: '/chat/archiveChat/{instanceName}', desc: 'أرشفة محادثة', body: '{\n  "lastMessage": {\n    "key": {\n      "remoteJid": "966XXXXXXXXX@s.whatsapp.net"\n    }\n  },\n  "archive": true\n}' },
      { method: 'DELETE', path: '/chat/deleteMessage/{instanceName}', desc: 'حذف رسالة', body: '{\n  "remoteJid": "966XXXXXXXXX@s.whatsapp.net",\n  "messageId": "MESSAGE_ID",\n  "fromMe": true\n}' },
      { method: 'GET', path: '/chat/fetchProfilePicture/{instanceName}?number=966XXXXXXXXX', desc: 'جلب صورة البروفايل', body: null },
    ]
  },
  {
    section: 'Group',
    icon: '👥',
    endpoints: [
      { method: 'POST', path: '/group/create/{instanceName}', desc: 'إنشاء مجموعة جديدة', body: '{\n  "subject": "اسم المجموعة",\n  "participants": ["966XXXXXXXXX@s.whatsapp.net"]\n}' },
      { method: 'GET', path: '/group/fetchAllGroups/{instanceName}?getParticipants=false', desc: 'جلب جميع المجموعات', body: null },
      { method: 'GET', path: '/group/findGroupInfos/{instanceName}?groupJid=GROUP_ID', desc: 'معلومات مجموعة معينة', body: null },
      { method: 'PUT', path: '/group/updateGroupPicture/{instanceName}', desc: 'تحديث صورة المجموعة', body: '{\n  "groupJid": "GROUP_ID@g.us",\n  "image": "https://example.com/image.jpg"\n}' },
      { method: 'PUT', path: '/group/updateGroupSubject/{instanceName}', desc: 'تحديث اسم المجموعة', body: '{\n  "groupJid": "GROUP_ID@g.us",\n  "subject": "الاسم الجديد"\n}' },
      { method: 'PUT', path: '/group/updateGroupDescription/{instanceName}', desc: 'تحديث وصف المجموعة', body: '{\n  "groupJid": "GROUP_ID@g.us",\n  "description": "الوصف الجديد"\n}' },
      { method: 'GET', path: '/group/inviteCode/{instanceName}?groupJid=GROUP_ID', desc: 'جلب رابط الدعوة', body: null },
      { method: 'GET', path: '/group/revokeInviteCode/{instanceName}?groupJid=GROUP_ID', desc: 'إلغاء رابط الدعوة', body: null },
      { method: 'POST', path: '/group/sendInviteUrl/{instanceName}', desc: 'إرسال رابط دعوة للمجموعة', body: '{\n  "groupJid": "GROUP_ID@g.us",\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "description": "انضم لمجموعتنا"\n}' },
      { method: 'GET', path: '/group/findParticipants/{instanceName}?groupJid=GROUP_ID', desc: 'جلب أعضاء المجموعة', body: null },
      { method: 'PUT', path: '/group/updateParticipants/{instanceName}', desc: 'إضافة/إزالة أعضاء', body: '{\n  "groupJid": "GROUP_ID@g.us",\n  "action": "add",\n  "participants": ["966XXXXXXXXX@s.whatsapp.net"]\n}' },
      { method: 'PUT', path: '/group/updateSetting/{instanceName}', desc: 'تحديث إعدادات المجموعة', body: '{\n  "groupJid": "GROUP_ID@g.us",\n  "action": "announcement"\n}' },
      { method: 'PUT', path: '/group/toggleEphemeral/{instanceName}', desc: 'تفعيل/تعطيل الرسائل المؤقتة', body: '{\n  "groupJid": "GROUP_ID@g.us",\n  "expiration": 86400\n}' },
      { method: 'DELETE', path: '/group/leaveGroup/{instanceName}?groupJid=GROUP_ID', desc: 'مغادرة المجموعة', body: null },
    ]
  },
  {
    section: 'Profile',
    icon: '👤',
    endpoints: [
      { method: 'GET', path: '/chat/fetchProfile/{instanceName}?number=966XXXXXXXXX', desc: 'جلب معلومات البروفايل', body: null },
      { method: 'PUT', path: '/chat/updateProfileName/{instanceName}', desc: 'تحديث اسم البروفايل', body: '{\n  "name": "الاسم الجديد"\n}' },
      { method: 'PUT', path: '/chat/updateProfilePicture/{instanceName}', desc: 'تحديث صورة البروفايل', body: '{\n  "picture": "https://example.com/photo.jpg"\n}' },
      { method: 'PUT', path: '/chat/updateProfileStatus/{instanceName}', desc: 'تحديث حالة البروفايل', body: '{\n  "status": "الحالة الجديدة"\n}' },
      { method: 'GET', path: '/chat/fetchBusinessProfile/{instanceName}?number=966XXXXXXXXX', desc: 'جلب بروفايل الأعمال', body: null },
    ]
  },
  {
    section: 'Webhook',
    icon: '🔗',
    endpoints: [
      { method: 'POST', path: '/webhook/set/{instanceName}', desc: 'تعيين Webhook URL', body: '{\n  "url": "https://yourdomain.com/webhook",\n  "webhook_by_events": false,\n  "webhook_base64": true,\n  "events": [\n    "MESSAGES_UPSERT",\n    "MESSAGES_UPDATE",\n    "CONNECTION_UPDATE",\n    "QRCODE_UPDATED"\n  ]\n}' },
      { method: 'GET', path: '/webhook/find/{instanceName}', desc: 'جلب إعدادات الـ Webhook', body: null },
    ]
  },
  {
    section: 'Settings',
    icon: '⚙️',
    endpoints: [
      { method: 'POST', path: '/settings/set/{instanceName}', desc: 'تعيين إعدادات النسخة', body: '{\n  "rejectCall": false,\n  "msgCall": "لا أستطيع الرد حالياً",\n  "groupsIgnore": true,\n  "alwaysOnline": false,\n  "readMessages": false,\n  "readStatus": false\n}' },
      { method: 'GET', path: '/settings/find/{instanceName}', desc: 'جلب إعدادات النسخة', body: null },
    ]
  },
  {
    section: 'Labels',
    icon: '🏷️',
    endpoints: [
      { method: 'GET', path: '/label/fetchLabels/{instanceName}', desc: 'جلب جميع التصنيفات', body: null },
      { method: 'PUT', path: '/label/handleLabel/{instanceName}', desc: 'إضافة/إزالة تصنيف', body: '{\n  "number": "966XXXXXXXXX@s.whatsapp.net",\n  "labelId": "1",\n  "action": "add"\n}' },
    ]
  },
];

// Template variables
const TEMPLATE_VARS = [
  { key: 'اسم_المريض', label: 'اسم المريض' },
  { key: 'اسم_الطبيب', label: 'اسم الطبيب' },
  { key: 'تاريخ_الموعد', label: 'تاريخ الموعد' },
  { key: 'وقت_الموعد', label: 'وقت الموعد' },
  { key: 'اسم_العيادة', label: 'اسم العيادة' },
  { key: 'رقم_الملف', label: 'رقم الملف' },
];

const SAMPLE_DATA = {
  'اسم_المريض': 'أحمد محمد',
  'اسم_الطبيب': 'د. سارة أحمد',
  'تاريخ_الموعد': '2026-04-20',
  'وقت_الموعد': 'الصباحية',
  'اسم_العيادة': 'عيادتي',
  'رقم_الملف': 'P260401',
};

// Notification types config
const NOTIFICATION_TYPES = [
  { key: 'followupReminder', emoji: '🔔', title: 'تذكير موعد العودة/المراجعة', hasDays: true, daysLabel: 'أرسل التذكير قبل الموعد بـ' },
  { key: 'bookingConfirm', emoji: '✅', title: 'تأكيد الحجز', hasDays: false },
  { key: 'bookingCancel', emoji: '❌', title: 'إلغاء الحجز', hasDays: false },
  { key: 'appointmentReminder', emoji: '📅', title: 'تذكير الموعد العادي', hasDays: true, daysLabel: 'أرسل التذكير قبل الموعد بـ' },
  { key: 'postVisit', emoji: '🙏', title: 'شكر بعد الزيارة', hasDays: false },
];

// ===================== MAIN COMPONENT =====================
const WhatsAppConnection = () => {
  const [activeTab, setActiveTab] = useState('connection');
  const [config, setConfig] = useState({
    evolutionApiUrl: '',
    evolutionApiKey: '',
    evolutionInstanceName: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState('close');
  const [qrCodeData, setQrCodeData] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Notification state
  const [notifSettings, setNotifSettings] = useState({});
  const [notifSaving, setNotifSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  // API docs state
  const [openSections, setOpenSections] = useState({});
  const [copiedPath, setCopiedPath] = useState('');
  const [apiSearch, setApiSearch] = useState('');
  const [testOpen, setTestOpen] = useState(null); // which endpoint is expanded for testing
  const [testBodies, setTestBodies] = useState({});
  const [testResults, setTestResults] = useState({});
  const [testLoading, setTestLoading] = useState({});

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);

  // Refs for template textareas
  const templateRefs = useRef({});

  // ==================== CONNECTION TAB ====================
  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.get('/evolution/config');
      setConfig({
        evolutionApiUrl: data.evolutionApiUrl || '',
        evolutionApiKey: data.evolutionApiKey || '',
        evolutionInstanceName: data.evolutionInstanceName || ''
      });
    } catch (err) {
      console.error(err);
      showMessage('حدث خطأ أثناء جلب الإعدادات', 'error');
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const data = await api.get('/evolution/instance/status');
      setConnectionState(data.state);
      if (data.state === 'open') {
        setQrCodeData('');
      }
    } catch (err) {
      console.error('Status check error (keeping last state):', err);
      // لا نغير الحالة عند فشل الاتصال - نحتفظ بآخر حالة معروفة
    }
  }, []);

  const fetchWebhookInfo = useCallback(async () => {
    try {
      const data = await api.get('/evolution/webhook/info');
      setWebhookInfo(data);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
    } catch (err) {
      // إذا لم تكن إعدادات Evolution مكتملة نتجاهل الخطأ
    }
  }, []);

  const handleRegisterWebhook = async () => {
    if (!webhookUrl) return showMessage('أدخل رابط الـ Webhook أولاً', 'error');
    setWebhookLoading(true);
    try {
      const data = await api.post('/evolution/webhook/register', { webhookUrl });
      showMessage(data.message || 'تم تسجيل الـ Webhook بنجاح ✅');
      fetchWebhookInfo();
    } catch (err) {
      showMessage(err.message || 'فشل تسجيل الـ Webhook', 'error');
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleExecuteApi = async (ep) => {
    const epId = ep.method + ep.path;
    setTestLoading(prev => ({ ...prev, [epId]: true }));
    try {
      const body = testBodies[epId] || ep.body || '';
      const response = await api.post('/evolution/execute', {
        path: ep.path,
        method: ep.method,
        body: body ? JSON.parse(body) : null
      });
      setTestResults(prev => ({ ...prev, [epId]: response }));
      showMessage('تم تنفيذ الطلب بنجاح ✅');
    } catch (err) {
      setTestResults(prev => ({ ...prev, [epId]: { error: err.message, details: err.response?.data } }));
      showMessage(err.message || 'فشل تنفيذ الطلب', 'error');
    } finally {
      setTestLoading(prev => ({ ...prev, [epId]: false }));
    }
  };

  const toggleTest = (ep) => {
    const epId = ep.method + ep.path;
    if (testOpen === epId) {
      setTestOpen(null);
    } else {
      setTestOpen(epId);
      if (!testBodies[epId]) {
        setTestBodies(prev => ({ ...prev, [epId]: ep.body || '' }));
      }
    }
  };

  useEffect(() => {
    fetchConfig();
    checkStatus();
    fetchWebhookInfo();
    // فحص الحالة دورياً - كل 15 ثانية إذا غير متصل، كل 30 ثانية إذا متصل
    const intervalId = setInterval(() => {
      checkStatus();
    }, connectionState === 'open' ? 30000 : connectionState === 'qr_pending' ? 8000 : 15000);
    return () => clearInterval(intervalId);
  }, [fetchConfig, checkStatus, fetchWebhookInfo, connectionState]);

  // Load notification settings when tab switches
  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotifSettings();
    }
  }, [activeTab]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/evolution/config', config);
      showMessage('تم حفظ الإعدادات بنجاح');
      checkStatus();
    } catch (err) {
      showMessage(err.message || 'خطأ في الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!config.evolutionApiUrl || !config.evolutionApiKey || !config.evolutionInstanceName) {
      return showMessage('يرجى تعبئة وحفظ الإعدادات أولاً', 'error');
    }
    setLoading(true);
    try {
      const data = await api.post('/evolution/instance/create');
      if (data.qrcode) {
        setQrCodeData(data.qrcode);
        setConnectionState('qr_pending');
      } else {
        setConnectionState(data.state || 'connecting');
      }
      showMessage('تم التحديث بنجاح');
    } catch (err) {
      showMessage(err.message || 'خطأ في جلب رمز الاستجابة السريعة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج من الواتساب؟')) return;
    setLoading(true);
    try {
      await api.delete('/evolution/instance/logout');
      setConnectionState('close');
      setQrCodeData('');
      showMessage('تم تسجيل الخروج بنجاح');
    } catch (err) {
      showMessage(err.message || 'خطأ في تسجيل الخروج', 'error');
      checkStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeSession = async () => {
    setLoading(true);
    try {
      const data = await api.post('/evolution/instance/optimize');
      showMessage(data.message || 'تم تحسين استقرار الاتصال بنجاح ✅');
    } catch (err) {
      showMessage(err.message || 'فشل تحسين الاتصال', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== NOTIFICATIONS TAB ====================
  const fetchNotifSettings = async () => {
    try {
      const data = await api.get('/evolution/notification-settings');
      setNotifSettings(data);
    } catch (err) {
      console.error('Error fetching notif settings:', err);
    }
  };

  const handleNotifChange = (key, field, value) => {
    setNotifSettings(prev => ({ ...prev, [`${key}${field}`]: value }));
  };

  const insertVariable = (notifKey, varKey) => {
    const textarea = templateRefs.current[notifKey];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const fieldKey = `${notifKey}Template`;
    const currentVal = notifSettings[fieldKey] || '';
    const newVal = currentVal.substring(0, start) + `{${varKey}}` + currentVal.substring(end);
    setNotifSettings(prev => ({ ...prev, [fieldKey]: newVal }));
    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      const newPos = start + varKey.length + 2;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const renderPreview = (template) => {
    if (!template) return '';
    let result = template;
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  };

  const handleSaveNotifSettings = async () => {
    setNotifSaving(true);
    try {
      await api.post('/evolution/notification-settings', notifSettings);
      showMessage('تم حفظ إعدادات الإشعارات بنجاح ✅');
    } catch (err) {
      showMessage(err.message || 'خطأ في حفظ الإعدادات', 'error');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone) return showMessage('أدخل رقم الجوال للاختبار', 'error');
    try {
      await api.post('/evolution/test-message', {
        phone: testPhone,
        message: 'رسالة تجريبية من نظام العيادة ✅\nتم ربط الواتساب بنجاح!'
      });
      showMessage('تم إرسال الرسالة التجريبية بنجاح ✅');
    } catch (err) {
      showMessage(err.message || 'خطأ في إرسال الرسالة', 'error');
    }
  };

  // ==================== API DOCS TAB ====================
  const toggleSection = (sectionName) => {
    setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  const copyEndpoint = async (path) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(''), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const filteredDocs = apiSearch
    ? API_DOCS.map(section => ({
      ...section,
      endpoints: section.endpoints.filter(ep =>
        ep.path.toLowerCase().includes(apiSearch.toLowerCase()) ||
        ep.desc.includes(apiSearch) ||
        ep.method.toLowerCase().includes(apiSearch.toLowerCase())
      )
    })).filter(section => section.endpoints.length > 0)
    : API_DOCS;

  // ==================== RENDER ====================
  return (
    <div className="whatsapp-page fade-in">
      <div className="page-header">
        <div className="header-icon-wrapper">
          <Smartphone size={28} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">ربط الواتساب</h1>
          <p className="page-subtitle">إدارة اتصال الواتساب، إعداد الإشعارات التلقائية، وتوثيق API.</p>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="wa-tabs">
        <button className={`wa-tab-btn ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')}>
          <span className="tab-icon">⚡</span>
          <span>ربط الواتساب</span>
        </button>
        <button className={`wa-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
          <span className="tab-icon">📝</span>
          <span>نصوص الإشعارات</span>
        </button>
        <button className={`wa-tab-btn ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>
          <span className="tab-icon">📖</span>
          <span>توثيق الـ API</span>
        </button>
      </div>

      {/* ==================== TAB 1: CONNECTION ==================== */}
      {activeTab === 'connection' && (
        <div className="whatsapp-grid">
          <div className="config-card paper-card">
            <h2 className="card-title">إعدادات الاتصال بالسيرفر</h2>
            <form onSubmit={handleSaveConfig} className="settings-form">
              <div className="form-group">
                <label>رابط Evolution API</label>
                <input
                  type="url"
                  name="evolutionApiUrl"
                  className="input-field en-font"
                  placeholder="مثال: https://api.yourdomain.com"
                  value={config.evolutionApiUrl}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>

              <div className="form-group">
                <label>Global API Key</label>
                <input
                  type="password"
                  name="evolutionApiKey"
                  className="input-field en-font"
                  placeholder="مفتاح الـ API العام"
                  value={config.evolutionApiKey}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>

              <div className="form-group">
                <label>اسم النسخة (Instance Name)</label>
                <input
                  type="text"
                  name="evolutionInstanceName"
                  className="input-field en-font"
                  placeholder="ClinicInstance1"
                  value={config.evolutionInstanceName}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                {saving ? <RefreshCw className="spin" size={20} /> : <Save size={20} />}
                <span>حفظ الإعدادات</span>
              </button>
            </form>

            {/* ===== قسم Webhook للإعادة التلقائية ===== */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed #e2e8f0' }}>
              <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                🔗 إعداد Webhook (إعادة الاتصال التلقائية)
              </h3>
              <p className="text-sm text-muted mb-4" style={{ marginBottom: '0.75rem', lineHeight: '1.6' }}>
                عند تسجيل رابط الـ Webhook، سيُخبرك سيرفر Evolution API فور انقطاع الجلسة فيُعيد نظامك الاتصال تلقائياً دون تدخل يدوي.
              </p>

              {webhookInfo?.configured && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#15803d' }}>
                  ✅ Webhook مسجّل بالفعل

                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="url"
                  className="input-field en-font"
                  placeholder="https://yourserver.com/api/evolution/webhook"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  dir="ltr"
                  style={{ flex: 1, fontSize: '13px' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRegisterWebhook}
                  disabled={webhookLoading}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {webhookLoading ? <RefreshCw className="spin" size={16} /> : <span>🔗</span>}
                  <span>تسجيل</span>
                </button>
              </div>
              <p className="text-sm text-muted" style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>

              </p>
            </div>
          </div>

          <div className="status-card paper-card">
            <h2 className="card-title">حالة الربط</h2>

            <div className="status-indicator">
              <div className={`status-badge ${connectionState}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {connectionState === 'open' ? 'متصل بالواتساب' :
                    connectionState === 'connecting' ? 'جاري الاتصال...' :
                      connectionState === 'qr_pending' ? 'بانتظار المسح' : 'غير متصل'}
                </span>
              </div>
            </div>

            <div className="qr-container">
              {connectionState === 'open' ? (
                <div className="connected-state">
                  <CheckCircle2 size={64} className="text-success" />
                  <p>تم الربط بنجاح! الواتساب يعمل تلقائيًا.</p>
                  <button onClick={handleLogout} className="btn btn-danger mt-4" disabled={loading}>
                    {loading ? <RefreshCw className="spin" size={20} /> : <LogOut size={20} />}
                    <span>تسجيل الخروج وقطع الربط</span>
                  </button>
                </div>
              ) : (
                <div className="disconnected-state">
                  {qrCodeData ? (
                    <div className="qr-display">
                      <img src={qrCodeData} alt="WhatsApp QR Code" className="qr-image" />
                      <p className="mt-4 text-sm text-muted">افتح الواتساب بجوالك وقم بمسح الرمز للربط.</p>
                    </div>
                  ) : (
                    <div className="empty-qr">
                      <QrCode size={48} className="text-muted" />
                      <p className="mt-2">لا يوجد رمز QR نشط</p>
                    </div>
                  )}

                  <div className="action-buttons mt-6">
                    <button onClick={handleGenerateQR} className="btn btn-primary" disabled={loading}>
                      {loading ? <RefreshCw className="spin" size={20} /> : <RefreshCw size={20} />}
                      <span>{qrCodeData ? 'تحديث رمز QR' : 'توليد رمز QR'}</span>
                    </button>
                    <button onClick={checkStatus} className="btn btn-secondary" disabled={loading}>
                      <RefreshCw size={20} className={loading && !qrCodeData ? "spin" : ""} />
                      <span>تحديث الحالة</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {connectionState === 'open' && (
              <div className="optimize-section mt-6 p-4 paper-card" style={{ border: '1px solid #25d366', background: 'rgba(37, 211, 102, 0.05)', borderRadius: '12px' }}>
                <div className="flex items-center gap-3 mb-3" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 style={{ color: '#25d366' }} size={24} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: NOTIFICATIONS ==================== */}
      {activeTab === 'notifications' && (
        <div>
          <div className="notifications-container">
            {NOTIFICATION_TYPES.map(notif => {
              const enabledKey = `${notif.key}Enabled`;
              const templateKey = `${notif.key}Template`;
              const daysKey = `${notif.key}Days`;
              const isEnabled = notifSettings[enabledKey] !== false;

              return (
                <div key={notif.key} className={`notif-card ${!isEnabled ? 'disabled' : ''}`}>
                  <div className="notif-card-header">
                    <div className="notif-card-title">
                      <span className="notif-emoji">{notif.emoji}</span>
                      <span>{notif.title}</span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => handleNotifChange(notif.key, 'Enabled', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="notif-card-body">
                    {notif.hasDays && (
                      <div className="notif-days-row">
                        <label>{notif.daysLabel}</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          className="notif-days-input"
                          value={notifSettings[daysKey] || 1}
                          onChange={(e) => handleNotifChange(notif.key, 'Days', parseInt(e.target.value) || 1)}
                        />
                        <label>يوم</label>
                      </div>
                    )}

                    <div>
                      <textarea
                        ref={el => templateRefs.current[notif.key] = el}
                        className="notif-template-area"
                        placeholder="اكتب نص الرسالة هنا... استخدم الأزرار أدناه لإدراج المتغيرات"
                        value={notifSettings[templateKey] || ''}
                        onChange={(e) => handleNotifChange(notif.key, 'Template', e.target.value)}
                      />
                    </div>

                    <div className="var-buttons">
                      {TEMPLATE_VARS.map(v => (
                        <button
                          key={v.key}
                          type="button"
                          className="var-btn"
                          onClick={() => insertVariable(notif.key, v.key)}
                          title={`إدراج ${v.label}`}
                        >
                          {`{${v.key}}`}
                        </button>
                      ))}
                    </div>

                    {notifSettings[templateKey] && (
                      <div>
                        <div className="notif-preview-label">
                          <Eye size={13} />
                          <span>معاينة الرسالة</span>
                        </div>
                        <div className="notif-preview">
                          {renderPreview(notifSettings[templateKey])}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="notif-save-section">
            <div className="test-msg">
              <input
                type="text"
                className="test-phone-input"
                placeholder="966XXXXXXXXX"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                dir="ltr"
              />
              <button className="btn btn-secondary" onClick={handleTestMessage}>
                <Send size={16} />
                <span>رسالة تجريبية</span>
              </button>
            </div>

            <button className="btn btn-primary" onClick={handleSaveNotifSettings} disabled={notifSaving}>
              {notifSaving ? <RefreshCw className="spin" size={20} /> : <Save size={20} />}
              <span>حفظ جميع الإشعارات</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: API DOCS ==================== */}
      {activeTab === 'docs' && (
        <div className="api-docs-container">
          <div className="api-search-box">
            <Search size={18} className="text-muted" />
            <input
              type="text"
              className="api-search-input"
              placeholder="Search endpoints... (e.g. sendText, instance, group)"
              value={apiSearch}
              onChange={(e) => setApiSearch(e.target.value)}
            />
          </div>

          {filteredDocs.map(section => {
            const isOpen = openSections[section.section] !== false; // open by default
            return (
              <div key={section.section} className="api-section">
                <div className="api-section-header" onClick={() => toggleSection(section.section)}>
                  <div className="api-section-title">
                    <span>{section.icon}</span>
                    <span>{section.section}</span>
                    <span className="api-section-count">{section.endpoints.length}</span>
                  </div>
                  <span className={`api-section-toggle ${isOpen ? 'open' : ''}`}>
                    <ChevronDown size={18} />
                  </span>
                </div>

                {isOpen && (
                  <div className="api-section-body section-collapse">
                    {section.endpoints.map((ep, idx) => (
                      <div key={idx} className={`api-endpoint ${testOpen === ep.method + ep.path ? 'testing' : ''}`}>
                        <div className="api-endpoint-header">
                          <span className={`method-badge ${ep.method.toLowerCase()}`}>{ep.method}</span>
                          <span className="api-path">
                            {ep.path.replace(/{instanceName}/g, config.evolutionInstanceName || '...')}
                          </span>
                          <div className="flex gap-2" style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                            <button
                              className="api-try-btn"
                              onClick={() => toggleTest(ep)}
                              title="جرب الآن"
                            >
                              {testOpen === ep.method + ep.path ? 'إغلاق' : '⚡ تجربة'}
                            </button>
                            <button
                              className={`api-copy-btn ${copiedPath === ep.path ? 'copied' : ''}`}
                              onClick={() => copyEndpoint(ep.path)}
                              title="نسخ المسار"
                            >
                              {copiedPath === ep.path ? <><Check size={12} /> تم</> : <><Copy size={12} /> نسخ</>}
                            </button>
                          </div>
                        </div>
                        <div className="api-desc">{ep.desc}</div>

                        {testOpen === ep.method + ep.path ? (
                          <div className="api-test-panel">
                            {(ep.method === 'POST' || ep.method === 'PUT') && (
                              <div className="mb-3">
                                <label className="text-xs font-bold mb-1 block">Request Body (JSON):</label>
                                <textarea
                                  className="api-test-body en-font"
                                  value={testBodies[ep.method + ep.path]}
                                  onChange={(e) => setTestBodies(prev => ({ ...prev, [ep.method + ep.path]: e.target.value }))}
                                  placeholder="{ ... }"
                                />
                              </div>
                            )}
                            <button
                              className="btn btn-primary w-full text-sm py-1"
                              onClick={() => handleExecuteApi(ep)}
                              disabled={testLoading[ep.method + ep.path]}
                            >
                              {testLoading[ep.method + ep.path] ? <RefreshCw className="spin" size={14} /> : 'إرسال الطلب 🚀'}
                            </button>

                            {testResults[ep.method + ep.path] && (
                              <div className="api-test-result mt-3">
                                <label className="text-xs font-bold mb-1 block">Response:</label>
                                <pre className="en-font">
                                  {JSON.stringify(testResults[ep.method + ep.path], null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          ep.body && (
                            <pre className="api-body-example">{ep.body}</pre>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnection;
