import React, { useState, useEffect, useCallback } from 'react';
import { Save, CheckCircle, XCircle, AlertCircle, ExternalLink, RefreshCw, Send, Link2, Shield, Zap, Globe, Eye, EyeOff } from 'lucide-react';
import api from '../../utils/api';

const WhatsAppCloudPage = () => {
  const [activeTab, setActiveTab] = useState('setup');
  const [settings, setSettings] = useState({
    whatsappCloudEnabled: false,
    whatsappCloudApiKey: '',
    whatsappCloudPhoneId: '',
    whatsappCloudAppId: '',
    whatsappCloudAppSecret: '',
    whatsappCloudWebhookUrl: '',
    whatsappCloudWebhookVerifyToken: '',
    whatsappCloudWebhookEndpoint: '/api/whatsapp-cloud/webhook',
    n8nWebhookUrl: '',
    n8nWebhookEnabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Test states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [n8nTesting, setN8nTesting] = useState(false);
  const [n8nTestResult, setN8nTestResult] = useState(null);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Show/hide secrets
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // دالة إظهار الرسائل
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 6000);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.get('/whatsapp-cloud/cloud-settings');
      setSettings(data);
    } catch (err) {
      console.error(err);
      showMessage('حدث خطأ في جلب الإعدادات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/whatsapp-cloud/cloud-settings', settings);
      showMessage('تم حفظ الإعدادات بنجاح ✅');
    } catch (err) {
      showMessage(err.message || 'خطأ في الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post('/whatsapp-cloud/cloud-test', {
        apiKey: settings.whatsappCloudApiKey,
        phoneId: settings.whatsappCloudPhoneId,
        appId: settings.whatsappCloudAppId
      });
      setTestResult({ success: true, data: result });
      showMessage('الاتصال ناجح! ✅');
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      showMessage(err.message || 'فشل الاتصال ❌', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleTestN8N = async () => {
    if (!settings.n8nWebhookUrl) {
      showMessage('أدخل رابط N8N أولاً', 'error');
      return;
    }
    setN8nTesting(true);
    setN8nTestResult(null);
    try {
      const result = await api.post('/whatsapp-cloud/n8n-test', {
        webhookUrl: settings.n8nWebhookUrl
      });
      setN8nTestResult({ success: true });
      showMessage('تم الاتصال بـ N8N بنجاح! ✅');
    } catch (err) {
      setN8nTestResult({ success: false, error: err.message });
      showMessage(err.message || 'فشل الاتصال بـ N8N ❌', 'error');
    } finally {
      setN8nTesting(false);
    }
  };

  const handleVerifyPhone = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const result = await api.post('/whatsapp-cloud/verify-phone');
      setVerificationResult(result);
      if (result.success) {
        showMessage('رقم الواتساب متصل ومُفعّل! ✅');
      }
    } catch (err) {
      setVerificationResult({ success: false, error: err.message });
      showMessage(err.message || 'فشل التحقق', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      showMessage(`تم نسخ: ${label}`);
    });
  };

  const fullWebhookUrl = `${window.location.origin}${settings.whatsappCloudWebhookEndpoint}`;

  if (loading) {
    return (
      <div className="flex-center p-8">
        <RefreshCw className="spin" size={32} />
      </div>
    );
  }

  return (
    <div className="whatsapp-cloud-page animate-fade-in pb-8">
      <div className="page-header mb-6">
        <div className="flex items-center gap-4">
          <div className="page-icon-wrapper" style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <h1 className="page-title">WhatsApp Cloud API</h1>
            <p className="page-subtitle">إعدادت WhatsApp Business API من Meta مع دعم N8N</p>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
          {message.type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
          <span className="font-bold">{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="wa-tabs mb-6">
        <button className={`wa-tab-btn ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}>
          <span className="tab-icon">⚙️</span>
          <span>إعدادات الربط</span>
        </button>
        <button className={`wa-tab-btn ${activeTab === 'n8n' ? 'active' : ''}`} onClick={() => setActiveTab('n8n')}>
          <span className="tab-icon">🔗</span>
          <span>N8N Webhook</span>
        </button>
        <button className={`wa-tab-btn ${activeTab === 'webhook' ? 'active' : ''}`} onClick={() => setActiveTab('webhook')}>
          <span className="tab-icon">🌐</span>
          <span>إعداد Webhook</span>
        </button>
        <button className={`wa-tab-btn ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>
          <span className="tab-icon">📖</span>
          <span>دليل الربط</span>
        </button>
      </div>

      {/* ==================== Tab 1: Setup ==================== */}
      {activeTab === 'setup' && (
        <div className="whatsapp-grid">
          {/* Main Settings */}
          <div className="config-card paper-card">
            <h2 className="card-title flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              إعدادات WhatsApp Cloud API
            </h2>

            <div className="flex gap-3 items-center mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                name="whatsappCloudEnabled"
                id="whatsappCloudEnabled"
                checked={settings.whatsappCloudEnabled}
                onChange={handleChange}
                className="w-5 h-5"
              />
              <label htmlFor="whatsappCloudEnabled" className="font-bold cursor-pointer">
                تفعيل WhatsApp Cloud API
              </label>
            </div>

            {settings.whatsappCloudEnabled && (
              <div className="settings-form space-y-4">
                {/* App ID */}
                <div className="form-group">
                  <label className="form-label">
                    <span className="flex items-center gap-2">
                      <Zap size={16} />
                      Meta App ID
                    </span>
                  </label>
                  <input
                    type="text"
                    name="whatsappCloudAppId"
                    value={settings.whatsappCloudAppId}
                    onChange={handleChange}
                    className="form-input en-font"
                    placeholder="1234567890123456"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted mt-1">تجده في Meta for Developers → Your App → Settings → Basic</p>
                </div>

                {/* App Secret */}
                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Shield size={16} />
                    Meta App Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      name="whatsappCloudAppSecret"
                      value={settings.whatsappCloudAppSecret}
                      onChange={handleChange}
                      className="form-input en-font pr-10"
                      placeholder="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">تجده في Meta for Developers → Settings → Basic → App Secret</p>
                </div>

                {/* Access Token */}
                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Zap size={16} />
                    Access Token (User Access Token أو System User Access Token)
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      name="whatsappCloudApiKey"
                      value={settings.whatsappCloudApiKey}
                      onChange={handleChange}
                      className="form-input en-font pr-10"
                      placeholder="EAAxxxxxxxxxxxxxxx..."
                      dir="ltr"
                    />
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    احصل عليه من: Meta for Developers → WhatsApp → API Setup → Temporary access token
                    <br/>
                    أو أنشئ System User في Meta Business Suite
                  </p>
                </div>

                {/* Phone ID */}
                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Zap size={16} />
                    Phone Number ID (معرف رقم الواتساب)
                  </label>
                  <input
                    type="text"
                    name="whatsappCloudPhoneId"
                    value={settings.whatsappCloudPhoneId}
                    onChange={handleChange}
                    className="form-input en-font"
                    placeholder="123456789012345"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted mt-1">تجده في Meta for Developers → WhatsApp → API Setup → Phone Number ID</p>
                </div>

                {/* Webhook URL */}
                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Globe size={16} />
                    رابط Webhook الخاص بك (للتسجيل في Meta)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={fullWebhookUrl}
                      readOnly
                      className="form-input en-font flex-1"
                      dir="ltr"
                    />
                    <button
                      className="btn-secondary"
                      onClick={() => copyToClipboard(fullWebhookUrl, 'Webhook URL')}
                    >
                      نسخ
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    ⚠️ هذا هو رابط استقبال رسائل Webhook من Meta. سجّله في Meta for Developers بعد الربط.
                  </p>
                </div>

                {/* Verify Token */}
                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Shield size={16} />
                    Webhook Verify Token (اختياري للتأمين)
                  </label>
                  <input
                    type="text"
                    name="whatsappCloudWebhookVerifyToken"
                    value={settings.whatsappCloudWebhookVerifyToken}
                    onChange={handleChange}
                    className="form-input en-font"
                    placeholder="my_secret_verify_token_12345"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted mt-1">أنشئ كلمة مرور عشوائية لاستخدامها في التحقق من Webhook</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
                <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
              </button>

              {settings.whatsappCloudEnabled && (
                <button
                  className="btn-secondary flex items-center gap-2"
                  onClick={handleTestConnection}
                  disabled={testing || !settings.whatsappCloudApiKey || !settings.whatsappCloudPhoneId}
                >
                  {testing ? <RefreshCw className="spin" size={18} /> : <Zap size={18} />}
                  <span>اختبار الاتصال</span>
                </button>
              )}
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 font-bold mb-2">
                  {testResult.success ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                  {testResult.success ? 'نجاح!' : 'فشل'}
                </div>
                {testResult.success && testResult.data?.phoneInfo && (
                  <div className="text-sm space-y-1">
                    <p><strong>رقم الواتساب:</strong> {testResult.data.phoneInfo.display_phone_number}</p>
                    <p><strong>الاسم المُوثّق:</strong> {testResult.data.phoneInfo.verified_name}</p>
                    <p><strong>تقييم الجودة:</strong> {testResult.data.phoneInfo.quality_rating || 'غير متوفر'}</p>
                    <p><strong>الحالة:</strong> {testResult.data.phoneInfo.status}</p>
                  </div>
                )}
                {!testResult.success && (
                  <p className="text-sm text-red-600">{testResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Quick Status */}
          {settings.whatsappCloudEnabled && (
            <div className="status-card paper-card">
              <h2 className="card-title flex items-center gap-2">
                <CheckCircle size={20} className="text-green-600" />
                حالة الربط
              </h2>

              <div className="space-y-4">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${settings.whatsappCloudApiKey ? 'bg-green-50' : 'bg-red-50'}`}>
                  {settings.whatsappCloudApiKey ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                  <div>
                    <p className="font-bold">Access Token</p>
                    <p className="text-xs text-muted">{settings.whatsappCloudApiKey ? 'تم توفيره ✓' : 'مفقود ✗'}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${settings.whatsappCloudPhoneId ? 'bg-green-50' : 'bg-red-50'}`}>
                  {settings.whatsappCloudPhoneId ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                  <div>
                    <p className="font-bold">Phone ID</p>
                    <p className="text-xs text-muted">{settings.whatsappCloudPhoneId ? 'تم توفيره ✓' : 'مفقود ✗'}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${settings.whatsappCloudAppId ? 'bg-green-50' : 'bg-yellow-50'}`}>
                  {settings.whatsappCloudAppId ? <CheckCircle className="text-green-600" size={20} /> : <AlertCircle className="text-yellow-600" size={20} />}
                  <div>
                    <p className="font-bold">App ID</p>
                    <p className="text-xs text-muted">{settings.whatsappCloudAppId ? 'تم توفيره ✓' : 'اختياري'}</p>
                  </div>
                </div>

                <button
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                  onClick={handleVerifyPhone}
                  disabled={verifying}
                >
                  {verifying ? <RefreshCw className="spin" size={18} /> : <Zap size={18} />}
                  <span>{verifying ? 'جاري التحقق...' : 'التحقق من رقم الواتساب'}</span>
                </button>

                {verificationResult && (
                  <div className={`mt-4 p-4 rounded-lg ${verificationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className="font-bold text-center">{verificationResult.success ? '✅ الرقم متصل ومُفعّل' : '❌ ' + verificationResult.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== Tab 2: N8N Webhook ==================== */}
      {activeTab === 'n8n' && (
        <div className="whatsapp-grid">
          <div className="config-card paper-card lg:col-span-2">
            <h2 className="card-title flex items-center gap-2">
              <Link2 size={20} className="text-primary" />
              إعداد N8N Webhook لتحويل الرسائل
            </h2>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
              <h3 className="font-bold flex items-center gap-2 mb-2">
                <AlertCircle size={18} className="text-blue-600" />
                كيف يعمل؟
              </h3>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>عند استلام رسالة على الواتساب Cloud API، يتم تحويلها تلقائياً لـ N8N</li>
                <li>N8N يعالج الرسالة (مثلاً: استقبال طلبات الحجز، ردود تلقائية، إلخ)</li>
                <li>N8N يعيد توجيهها للأنظمة الخارجية مثل AI Bot أو CRM</li>
              </ol>
            </div>

            <div className="form-group mb-4">
              <label className="form-label flex items-center gap-2">
                <input
                  type="checkbox"
                  name="n8nWebhookEnabled"
                  checked={settings.n8nWebhookEnabled}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <span className="font-bold">تفعيل تحويل الرسائل لـ N8N</span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">رابط N8N Webhook</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="n8nWebhookUrl"
                  value={settings.n8nWebhookUrl}
                  onChange={handleChange}
                  className="form-input en-font flex-1"
                  placeholder="https://your-n8n.com/webhook/abc123"
                  dir="ltr"
                />
                <button
                  className="btn-secondary"
                  onClick={() => copyToClipboard(settings.n8nWebhookUrl, 'N8N URL')}
                  disabled={!settings.n8nWebhookUrl}
                >
                  نسخ
                </button>
              </div>
              <p className="text-xs text-muted mt-1">
                أنشئ Webhook في N8N واحصل على الرابط من there. عند استلام رسالة، ستجد البيانات بهذا الشكل:
              </p>
            </div>

            {/* Sample Payload */}
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="font-bold mb-2 text-sm">مثال على البيانات المرسلة لـ N8N:</p>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto en-font" dir="ltr">{`{
  "source": "whatsapp_cloud",
  "timestamp": "2026-04-22T10:30:00.000Z",
  "clinic_id": 1,
  "clinic_name": "عيادة الأمل",
  "message": {
    "id": "wamid.xxx...",
    "from": "966500000000",
    "type": "text",
    "text": "مرحباً، أريد حجز موعد"
  },
  "contact": {
    "wa_id": "966500000000",
    "profile": { "name": "أحمد" }
  }
}`}</pre>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
                <span>{saving ? 'جاري الحفظ...' : 'حفظ N8N'}</span>
              </button>

              <button
                className="btn-secondary flex items-center gap-2"
                onClick={handleTestN8N}
                disabled={n8nTesting || !settings.n8nWebhookUrl}
              >
                {n8nTesting ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
                <span>اختبار N8N</span>
              </button>
            </div>

            {/* N8N Test Result */}
            {n8nTestResult && (
              <div className={`mt-4 p-4 rounded-lg ${n8nTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 font-bold">
                  {n8nTestResult.success ? <CheckCircle className="text-green-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                  {n8nTestResult.success ? 'تم الاتصال بـ N8N بنجاح!' : 'فشل الاتصال'}
                </div>
                {!n8nTestResult.success && (
                  <p className="text-sm text-red-600 mt-2">{n8nTestResult.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== Tab 3: Webhook Setup ==================== */}
      {activeTab === 'webhook' && (
        <div className="whatsapp-grid">
          <div className="config-card paper-card lg:col-span-2">
            <h2 className="card-title flex items-center gap-2">
              <Globe size={20} className="text-primary" />
              إعداد Webhook في Meta for Developers
            </h2>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <h3 className="font-bold flex items-center gap-2 mb-2 text-amber-700">
                ⚠️ خطوات مهمة قبل البدء
              </h3>
              <ol className="text-sm space-y-2 text-amber-800">
                <li>1. تأكد من حفظ إعدادات WhatsApp Cloud أولاً (تبويب "إعدادات الربط")</li>
                <li>2. أنشئ رابط Webhook (احفظ الرابط أدناه)</li>
                <li>3. اذهب إلى Meta for Developers → WhatsApp → Configuration → Webhooks</li>
                <li>4. اضغط "Edit" وأدخل رابط Webhook + Verify Token</li>
                <li>5. اختر events: messages, message_deliveries, message_reads, conversations</li>
              </ol>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">رابط Webhook الخاص بك</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fullWebhookUrl}
                  readOnly
                  className="form-input en-font flex-1 bg-green-50 border-green-200"
                  dir="ltr"
                />
                <button
                  className="btn-primary"
                  onClick={() => copyToClipboard(fullWebhookUrl, 'Webhook URL')}
                >
                  نسخ
                </button>
              </div>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Verify Token (المرجع)</label>
              <input
                type="text"
                value={settings.whatsappCloudWebhookVerifyToken || '(لم يتم تحديده)'}
                readOnly
                className="form-input en-font bg-gray-50"
                dir="ltr"
              />
              <p className="text-xs text-muted mt-1">استخدم هذا القيمة عند إعداد Webhook في Meta</p>
            </div>

            {/* Setup Instructions */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-bold mb-4">📋 خطوات الإعداد في Meta:</h3>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <span className="bg-primary-100 text-primary-700 font-bold px-2 py-1 rounded flex-shrink-0">1</span>
                  <div>
                    <p className="font-bold">اذهب إلى Meta for Developers</p>
                    <p className="text-muted">https://developers.facebook.com</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="bg-primary-100 text-primary-700 font-bold px-2 py-1 rounded flex-shrink-0">2</span>
                  <div>
                    <p className="font-bold">اختر تطبيق WhatsApp</p>
                    <p className="text-muted">من قائمة التطبيقات → WhatsApp → API Setup</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="bg-primary-100 text-primary-700 font-bold px-2 py-1 rounded flex-shrink-0">3</span>
                  <div>
                    <p className="font-bold">اضغط على "Edit" في قسم Webhooks</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="bg-primary-100 text-primary-700 font-bold px-2 py-1 rounded flex-shrink-0">4</span>
                  <div>
                    <p className="font-bold">أدخل البيانات:</p>
                    <ul className="text-muted mt-1 space-y-1">
                      <li>• Callback URL: <code className="bg-gray-200 px-1 rounded">{fullWebhookUrl}</code></li>
                      <li>• Verify Token: <code className="bg-gray-200 px-1 rounded">{settings.whatsappCloudWebhookVerifyToken || '(استخدم أي كلمة)'}</code></li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="bg-primary-100 text-primary-700 font-bold px-2 py-1 rounded flex-shrink-0">5</span>
                  <div>
                    <p className="font-bold">اشترك في الـ Webhook Fields:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['messages', 'message_deliveries', 'message_reads'].map(field => (
                        <span key={field} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">{field}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Tab 4: Guide ==================== */}
      {activeTab === 'guide' && (
        <div className="whatsapp-grid">
          <div className="config-card paper-card lg:col-span-2">
            <h2 className="card-title flex items-center gap-2">
              <ExternalLink size={20} className="text-primary" />
              دليل شامل لربط WhatsApp Cloud API
            </h2>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <a href="https://business.facebook.com/latest" target="_blank" rel="noopener noreferrer" className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition">
                <p className="font-bold text-blue-700">Meta Business Suite</p>
                <p className="text-xs text-muted">business.facebook.com</p>
              </a>
              <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition">
                <p className="font-bold text-purple-700">Meta for Developers</p>
                <p className="text-xs text-muted">developers.facebook.com</p>
              </a>
            </div>

            {/* Step by Step Guide */}
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full">1</span>
                  إنشاء تطبيق في Meta
                </h3>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>اذهب إلى <a href="https://developers.facebook.com" target="_blank" className="text-primary underline">Meta for Developers</a></li>
                  <li>اضغط "Create App"</li>
                  <li>اختر نوع "Business" ثم "Next"</li>
                  <li>أدخل اسم التطبيق (مثل: Clinic WhatsApp)</li>
                  <li>اختر Business Account وادخل Email</li>
                  <li>بعد الإنشاء، من Dashboard أضف منتج "WhatsApp"</li>
                </ol>
              </div>

              {/* Step 2 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full">2</span>
                  ربط رقم الواتساب
                </h3>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>في قسم WhatsApp API Setup، اضغط "Add Phone Number"</li>
                  <li>أدخل رقم الواتساب (يجب أن يكون WhatsApp Business)</li>
                  <li>تحقق من الرقم عبر كود SMS أو المكالمة</li>
                  <li>بعد التحقق، ستحصل على:
                    <ul className="ml-6 mt-2 space-y-1">
                      <li>• <strong>Phone Number ID:</strong> (مثال: 123456789012345)</li>
                      <li>• <strong>WhatsApp Business Account ID:</strong> (مثال: 987654321098765)</li>
                    </ul>
                  </li>
                </ol>
              </div>

              {/* Step 3 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full">3</span>
                  الحصول على Access Token
                </h3>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <p className="text-sm text-amber-800">
                    <strong>⚠️ مهم:</strong> للحصول على Access Token دائم، أنشئ System User في Meta Business Suite:
                  </p>
                </div>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>اذهب إلى Meta Business Suite → Settings → Business Settings</li>
                  <li>من القائمة الجانبية: Users → System Users</li>
                  <li>اضغط "Add" وأنشئ System User باسم (مثل: Clinic Bot)</li>
                  <li>امنحه دور "Admin" أو "Developer"</li>
                  <li>اضغط "Generate Token"</li>
                  <li>اختر التطبيق + صلاحية <code className="bg-gray-100 px-1 rounded">whatsapp_business_management</code></li>
                  <li>احفظ الـ Token (لا يُعرض مرة أخرى!)</li>
                </ol>
              </div>

              {/* Step 4 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full">4</span>
                  إعداد Webhook
                </h3>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>من Meta for Developers → WhatsApp → Configuration</li>
                  <li>اضغط "Edit" في قسم Webhooks</li>
                  <li>أدخل:
                    <ul className="ml-6 mt-2 space-y-1">
                      <li>• <strong>Callback URL:</strong> <code className="bg-gray-100 px-1 rounded break-all">{fullWebhookUrl}</code></li>
                      <li>• <strong>Verify Token:</strong> أي كلمة مرور عشوائية (سجلها لاستخدامها لاحقاً)</li>
                    </ul>
                  </li>
                  <li>اضغط "Verify and Save"</li>
                  <li>اشترك في الـ Webhook Fields:
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['messages', 'message_deliveries', 'message_reads', 'message_acks'].map(f => (
                        <span key={f} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">{f}</span>
                      ))}
                    </div>
                  </li>
                </ol>
              </div>

              {/* Step 5 - N8N */}
              <div className="border border-gray-200 rounded-lg p-4 bg-purple-50">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span className="bg-purple-200 text-purple-700 px-3 py-1 rounded-full">5</span>
                  إعداد N8N لتحويل الرسائل
                </h3>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>أنشئ Workflow جديد في N8N</li>
                  <li>أضف Node: "Webhook" (اختر POST)</li>
                  <li>انسخ رابط Webhook من N8N</li>
                  <li>الصقه في إعدادات N8N Webhook في هذه الصفحة</li>
                  <li>عند استلام رسالة من WhatsApp Cloud، ستجد البيانات:
                    <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto en-font" dir="ltr">{`{
  "source": "whatsapp_cloud",
  "message": { "from": "...", "text": "..." },
  ...
}`}</pre>
                  </li>
                  <li>يمكنك الآن معالجة الرسالة في N8N (AI, Database, etc.)</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppCloudPage;
