import React, { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, LogOut, Smartphone, AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import api from '../../utils/api';
import './whatsapp.css';

const WhatsAppConnection = () => {
  const [config, setConfig] = useState({
    evolutionApiUrl: '',
    evolutionApiKey: '',
    evolutionInstanceName: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState('close'); // close, connecting, open
  const [qrCodeData, setQrCodeData] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

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
       console.error(err);
       setConnectionState('close');
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    checkStatus();
    // Auto refresh status every 10 seconds if not fully open
    const intervalId = setInterval(() => {
      if (connectionState !== 'open') {
         checkStatus();
      }
    }, 10000);
    return () => clearInterval(intervalId);
  }, [fetchConfig, checkStatus, connectionState]);

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

  return (
    <div className="whatsapp-page fade-in">
      <div className="page-header">
        <div className="header-icon-wrapper">
          <Smartphone size={28} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">ربط الواتساب (EvolutionAPI)</h1>
          <p className="page-subtitle">قم بإعداد سيرفر الواتساب واستخرج رمز الاستجابة السريعة للاتصال.</p>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{message.text}</span>
        </div>
      )}

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
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnection;
