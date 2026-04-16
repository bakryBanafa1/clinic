const prisma = require('../lib/prisma');

/**
 * خدمة تهيئة الواتساب لضمان الاتصال اللحظي والآلي 24/7
 */
async function initializeWhatsApp() {
  console.log('🚀 Initializing WhatsApp High-Availability Service...');
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      console.log('ℹ️ WhatsApp Init: Configuration missing. Dashboard setup required.');
      return;
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;
    const { evolutionApiKey, evolutionInstanceName, webhookUrl } = settings;

    // 1. فحص الحالة وتنشيط الاتصال
    console.log(`📡 Checking status for [${evolutionInstanceName}]...`);
    const stateRes = await fetch(`${evolutionUrl}/instance/connectionState/${evolutionInstanceName}`, {
      headers: { 'apikey': evolutionApiKey }
    });
    
    let stateData;
    const stateText = await stateRes.text();
    try {
      stateData = stateText ? JSON.parse(stateText) : {};
    } catch (e) {
      stateData = { state: 'error', message: stateText };
    }

    const state = stateData?.instance?.state || stateData?.state;
    
    if (state !== 'open') {
      console.log(`🔁 Session state is [${state}], triggering auto-reconnect...`);
      await fetch(`${evolutionUrl}/instance/connect/${evolutionInstanceName}`, {
        headers: { 'apikey': evolutionApiKey }
      });
    } else {
      console.log('✅ WhatsApp session is already OPEN.');
    }

    // 2. فرض إعدادات الثبات (Always Online)
    console.log('⚙️ Enforcing stability settings (Always Online)...');
    await fetch(`${evolutionUrl}/settings/set/${evolutionInstanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
      body: JSON.stringify({
        alwaysOnline: true,
        readMessages: true,
        readStatus: true,
        rejectCall: false,
        groupsIgnore: true
      })
    });

    // 3. تسجيل الـ Webhook تلقائياً إذا كان الرابط معروفاً
    if (webhookUrl) {
      console.log(`🔗 Auto-registering Webhook: ${webhookUrl}`);
      const webRes = await fetch(`${evolutionUrl}/webhook/set/${evolutionInstanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
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
      if (webRes.ok) console.log('✅ Webhook registered successfully.');
    } else {
      console.log('⚠️ No webhookUrl found in settings. Auto-reconnect might be delayed.');
    }

    console.log('✨ WhatsApp Initialization Complete.');
  } catch (err) {
    console.error('❌ WhatsApp Initialization Error:', err.message);
  }
}

module.exports = { initializeWhatsApp };
