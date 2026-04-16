const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { renderTemplate, sendWhatsAppMessage } = require('../lib/utils');
const router = express.Router();

// Helper function to format Evolution URL
const formatEvolutionUrl = (url) => {
  if (!url) return '';
  let formatted = url.trim().replace(/\/$/, '');
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = 'https://' + formatted;
  }
  return formatted;
};

// دالة مساعدة لجلب البيانات بشكل آمن من Evolution API
const safeFetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (e) {
    data = { message: responseText || 'No response body' };
  }

  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

// GET: Fetch Evolution Configuration
router.get('/config', authMiddleware, async (req, res) => {
  try {
    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }
    res.json({
      evolutionApiUrl: settings.evolutionApiUrl || '',
      evolutionApiKey: settings.evolutionApiKey || '',
      evolutionInstanceName: settings.evolutionInstanceName || ''
    });
  } catch (err) {
    console.error('Error fetching Evolution config:', err);
    res.status(500).json({ error: 'خطأ في الخادم أثناء جلب الإعدادات' });
  }
});

// POST: Save Evolution Configuration
router.post('/config', authMiddleware, async (req, res) => {
  try {
    const { evolutionApiUrl, evolutionApiKey, evolutionInstanceName } = req.body;
    let settings = await prisma.clinicSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }

    const updated = await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: {
        evolutionApiUrl: formatEvolutionUrl(evolutionApiUrl),
        evolutionApiKey,
        evolutionInstanceName
      }
    });

    res.json({
      success: true,
      evolutionApiUrl: updated.evolutionApiUrl,
      evolutionApiKey: updated.evolutionApiKey,
      evolutionInstanceName: updated.evolutionInstanceName
    });
  } catch (err) {
    console.error('Error saving Evolution config:', err);
    res.status(500).json({ error: 'خطأ في حفظ الإعدادات' });
  }
});

// GET: Fetch Notification Settings
router.get('/notification-settings', authMiddleware, async (req, res) => {
  try {
    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }
    res.json({
      followupReminderEnabled: settings.followupReminderEnabled,
      followupReminderDays: settings.followupReminderDays,
      followupReminderTemplate: settings.followupReminderTemplate,
      bookingConfirmEnabled: settings.bookingConfirmEnabled,
      bookingConfirmTemplate: settings.bookingConfirmTemplate,
      bookingCancelEnabled: settings.bookingCancelEnabled,
      bookingCancelTemplate: settings.bookingCancelTemplate,
      appointmentReminderEnabled: settings.appointmentReminderEnabled,
      appointmentReminderDays: settings.appointmentReminderDays,
      appointmentReminderTemplate: settings.appointmentReminderTemplate,
      birthdayGreetingEnabled: settings.birthdayGreetingEnabled,
      birthdayGreetingTemplate: settings.birthdayGreetingTemplate,
      postVisitEnabled: settings.postVisitEnabled,
      postVisitTemplate: settings.postVisitTemplate
    });
  } catch (err) {
    console.error('Error fetching notification settings:', err);
    res.status(500).json({ error: 'خطأ في جلب إعدادات الإشعارات' });
  }
});

// POST: Save Notification Settings
router.post('/notification-settings', authMiddleware, async (req, res) => {
  try {
    const {
      followupReminderEnabled,
      followupReminderDays,
      followupReminderTemplate,
      bookingConfirmEnabled,
      bookingConfirmTemplate,
      bookingCancelEnabled,
      bookingCancelTemplate,
      appointmentReminderEnabled,
      appointmentReminderDays,
      appointmentReminderTemplate,
      birthdayGreetingEnabled,
      birthdayGreetingTemplate,
      postVisitEnabled,
      postVisitTemplate
    } = req.body;

    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }

    const updated = await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: {
        followupReminderEnabled: followupReminderEnabled ?? settings.followupReminderEnabled,
        followupReminderDays: followupReminderDays != null ? parseInt(followupReminderDays) : settings.followupReminderDays,
        followupReminderTemplate: followupReminderTemplate ?? settings.followupReminderTemplate,
        bookingConfirmEnabled: bookingConfirmEnabled ?? settings.bookingConfirmEnabled,
        bookingConfirmTemplate: bookingConfirmTemplate ?? settings.bookingConfirmTemplate,
        bookingCancelEnabled: bookingCancelEnabled ?? settings.bookingCancelEnabled,
        bookingCancelTemplate: bookingCancelTemplate ?? settings.bookingCancelTemplate,
        appointmentReminderEnabled: appointmentReminderEnabled ?? settings.appointmentReminderEnabled,
        appointmentReminderDays: appointmentReminderDays != null ? parseInt(appointmentReminderDays) : settings.appointmentReminderDays,
        appointmentReminderTemplate: appointmentReminderTemplate ?? settings.appointmentReminderTemplate,
        birthdayGreetingEnabled: birthdayGreetingEnabled ?? settings.birthdayGreetingEnabled,
        birthdayGreetingTemplate: birthdayGreetingTemplate ?? settings.birthdayGreetingTemplate,
        postVisitEnabled: postVisitEnabled ?? settings.postVisitEnabled,
        postVisitTemplate: postVisitTemplate ?? settings.postVisitTemplate
      }
    });

    res.json({ success: true, message: 'تم حفظ إعدادات الإشعارات بنجاح' });
  } catch (err) {
    console.error('Error saving notification settings:', err);
    res.status(500).json({ error: 'خطأ في حفظ إعدادات الإشعارات' });
  }
});

// POST: Send Test WhatsApp Message
router.post('/test-message', authMiddleware, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'يرجى إدخال رقم الجوال ونص الرسالة' });
    }

    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة. يرجى إعداد الاتصال أولاً.' });
    }

    const result = await sendWhatsAppMessage(settings, phone, message);
    
    if (result && result.success) {
      res.json({ success: true, message: 'تم إرسال الرسالة التجريبية بنجاح ✅' });
    } else {
      res.status(500).json({ error: 'فشل في إرسال الرسالة', details: result?.error });
    }
  } catch (err) {
    console.error('Error sending test message:', err);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة التجريبية' });
  }
});

// GET: Check Connection Status
router.get('/instance/status', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) {
      evolutionUrl = 'https://' + evolutionUrl;
    }
    const globalApiKey = settings.evolutionApiKey;
    const instanceName = settings.evolutionInstanceName;

    // Check instance connection state
    const response = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': globalApiKey
      }
    });

    if (!response.ok) {
       // If instance not found, it returns 404
       if (response.status === 404) {
         return res.json({ state: 'close', statusReason: 'Instance not found' });
       }
       throw new Error(`Evolution API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // data.instance.state => "open", "close", "connecting"
    res.json({
      state: data?.instance?.state || 'close',
      statusReason: data?.instance?.statusReason || ''
    });

  } catch (err) {
    console.error('Error checking instance status:', err);
    res.status(500).json({ error: 'فشل الاتصال بـ EvolutionAPI', details: err.message });
  }
});

// POST: Create Instance / Generate QR Code
router.post('/instance/create', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) {
      evolutionUrl = 'https://' + evolutionUrl;
    }
    const globalApiKey = settings.evolutionApiKey;
    const instanceName = settings.evolutionInstanceName;

    // الخطوة 1: التحقق أولاً هل النسخة موجودة ومتصلة؟
    try {
      const statusRes = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: { 'apikey': globalApiKey }
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const currentState = statusData?.instance?.state;
        // إذا كانت متصلة بالفعل، لا تعيد إنشاء الجلسة
        if (currentState === 'open') {
          return res.json({ qrcode: '', state: 'open' });
        }
        // إذا كانت النسخة موجودة لكن غير متصلة، حاول الاتصال مباشرة
        if (currentState === 'close' || currentState === 'connecting') {
          const connectRes = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: { 'apikey': globalApiKey }
          });
          if (connectRes.ok) {
            const connectData = await connectRes.json();
            return res.json({
              qrcode: connectData.base64 || '',
              state: connectData.base64 ? 'qr_pending' : 'connecting'
            });
          }
        }
      }
    } catch (checkErr) {
      // النسخة غير موجودة، متابعة الإنشاء
      console.log('Instance not found or check failed, creating new...');
    }

    // الخطوة 2: إنشاء نسخة جديدة
    const response = await fetch(`${evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalApiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error creating instance');
    }

    res.json({
      qrcode: data.qrcode?.base64 || '',
      state: data.instance?.status || 'connecting'
    });

  } catch (err) {
    console.error('Error creating instance:', err);
    // محاولة أخيرة: جلب QR code من الاتصال
    try {
        const settings = await prisma.clinicSettings.findFirst();
        let fallbackUrl = settings.evolutionApiUrl;
        if (!fallbackUrl.startsWith('http')) fallbackUrl = 'https://' + fallbackUrl;
        const response2 = await fetch(`${fallbackUrl}/instance/connect/${settings.evolutionInstanceName}`, {
            method: 'GET',
            headers: {
                'apikey': settings.evolutionApiKey
            }
        });
        const data2 = await response2.json();
        return res.json({
            qrcode: data2.base64 || '',
            state: 'qr_pending'
        });
    } catch(err2) {
        res.status(500).json({ error: 'فشل في إنشاء الجلسة أو جلب رمز الاستجابة السريعة', details: err.message });
    }
  }
});

// POST: Optimize Instance Settings (Keep-alive)
router.post('/instance/optimize', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) {
      evolutionUrl = 'https://' + evolutionUrl;
    }
    const globalApiKey = settings.evolutionApiKey;
    const instanceName = settings.evolutionInstanceName;

    const response = await fetch(`${evolutionUrl}/settings/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalApiKey
      },
      body: JSON.stringify({
        rejectCall: false,
        msgCall: "",
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: true,
        readStatus: true
      })
    });

    const data = await response.json();
    if (!response.ok) {
       throw new Error(data.message || 'Error optimizing instance settings');
    }

    res.json({ success: true, message: 'تم تحسين إعدادات الاتصال بنجاح وتفعيل Always Online' });
  } catch (err) {
    console.error('Error optimizing instance:', err);
    res.status(500).json({ error: 'فشل تحسين إعدادات الاتصال', details: err.message });
  }
});

// =====================================================================
// POST: Webhook Receiver — يستقبل أحداث Evolution API ويعيد الاتصال تلقائياً
// =====================================================================
router.post('/webhook', async (req, res) => {
  // نرد فوراً بـ 200 حتى لا يتأخر Evolution API
  res.json({ received: true });

  try {
    const body = req.body;
    const event = body?.event || body?.apikey; // بعض الإصدارات تختلف في البنية

    console.log(`📡 Evolution Webhook event received: ${JSON.stringify(body).substring(0, 200)}`);

    // حدث تغيير حالة الاتصال
    if (body?.event === 'connection.update' || body?.data?.state) {
      const state = body?.data?.state || body?.instance?.state;
      const instanceName = body?.instance?.instanceName || body?.data?.instance;

      console.log(`🔄 Connection state update: [${instanceName}] → ${state}`);

      if (state === 'close' || state === 'connecting') {
        // الجلسة انقطعت → نحاول إعادة الاتصال تلقائياً
        const settings = await prisma.clinicSettings.findFirst();
        if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey) return;
        if (instanceName && instanceName !== settings.evolutionInstanceName) return;

        let evolutionUrl = settings.evolutionApiUrl;
        if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;

        console.log(`🔁 Auto-reconnecting instance: ${settings.evolutionInstanceName}...`);

        // انتظر ثانيتين ثم حاول الاتصال
        await new Promise(r => setTimeout(r, 2000));

        try {
          const connectRes = await fetch(`${evolutionUrl}/instance/connect/${settings.evolutionInstanceName}`, {
            method: 'GET',
            headers: { 'apikey': settings.evolutionApiKey }
          });
          const connectData = await connectRes.json();
          if (connectRes.ok) {
            console.log(`✅ Auto-reconnect triggered. State: ${connectData?.state || 'pending'}`);
          } else {
            console.warn(`⚠️ Auto-reconnect response: ${JSON.stringify(connectData)}`);
          }
        } catch (reconnectErr) {
          console.error('❌ Auto-reconnect failed:', reconnectErr.message);
        }
      } else if (state === 'open') {
        console.log(`✅ WhatsApp session is OPEN and active for instance: ${instanceName}`);
      }
    }

    // حدث تحديث QR code
    if (body?.event === 'qrcode.updated') {
      console.log(`📷 QR Code updated for instance: ${body?.instance?.instanceName}`);
    }

  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

// POST: تسجيل Webhook URL في Evolution API
router.post('/webhook/register', authMiddleware, async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) return res.status(400).json({ error: 'يرجى إدخال رابط الـ Webhook' });

    const settings = await prisma.clinicSettings.findFirst();
    if (!settings?.evolutionApiUrl || !settings?.evolutionApiKey || !settings?.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;

    const response = await fetch(`${evolutionUrl}/webhook/set/${settings.evolutionInstanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.evolutionApiKey
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT'
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'فشل تسجيل الـ Webhook');

    // حفظ الـ Webhook URL في الإعدادات
    await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: { webhookUrl }
    });

    res.json({ success: true, message: 'تم تسجيل الـ Webhook بنجاح ✅', data });
  } catch (err) {
    console.error('Webhook register error:', err);
    res.status(500).json({ error: 'فشل تسجيل الـ Webhook', details: err.message });
  }
});

// GET: جلب إعدادات Webhook الحالية
router.get('/webhook/info', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings?.evolutionApiUrl || !settings?.evolutionApiKey || !settings?.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;

    const response = await fetch(`${evolutionUrl}/webhook/find/${settings.evolutionInstanceName}`, {
      headers: { 'apikey': settings.evolutionApiKey }
    });

    const data = await response.json();
    res.json({
      configured: response.ok,
      webhookUrl: settings.webhookUrl || '',
      evolutionData: response.ok ? data : null
    });
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب معلومات الـ Webhook', details: err.message });
  }
});

// DELETE: Logout Instance
router.delete('/instance/logout', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) {
      evolutionUrl = 'https://' + evolutionUrl;
    }
    const globalApiKey = settings.evolutionApiKey;
    const instanceName = settings.evolutionInstanceName;

    const response = await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': globalApiKey
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Evolution API Error: ${response.status}`);
    }

    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  } catch (err) {
    console.error('Error logging out instance:', err);
    res.status(500).json({ error: 'فشل في تسجيل الخروج من الواتساب', details: err.message });
  }
});
// POST: مسار البروكسي لتجربة الـ API مباشرة
router.post('/execute', authMiddleware, async (req, res) => {
  try {
    const { path, method, body } = req.body;
    const settings = await prisma.clinicSettings.findFirst();

    if (!settings?.evolutionApiUrl || !settings?.evolutionApiKey) {
      return res.status(400).json({ error: 'إعدادات EvolutionAPI غير مكتملة' });
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;
    
    // استبدال {instanceName} في المسار تلقائياً
    const finalPath = path.replace(/{instanceName}/g, settings.evolutionInstanceName || 'InstanceName');
    const fullUrl = `${evolutionUrl}${finalPath}`;

    const options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.evolutionApiKey
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    console.log(`🚀 Proxying ${method} request to: ${fullUrl}`);

    try {
      const response = await fetch(fullUrl, options);
      const responseText = await response.text();
      let data;
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        data = { message: responseText || 'Error from external server' };
        console.warn('⚠️ Proxy: Non-JSON response received:', responseText.substring(0, 100));
      }

      res.status(response.status).json(data);
    } catch (fetchErr) {
      console.error('Proxy Fetch Error:', fetchErr.message);
      res.status(502).json({ error: 'تعذر التواصل مع خادم EvolutionAPI', details: fetchErr.message });
    }
  } catch (err) {
    console.error('API Proxy Error:', err);
    res.status(500).json({ error: 'فشل تنفيذ طلب الـ API', details: err.message });
  }
});

module.exports = router;

