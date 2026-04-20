const prisma = require('../lib/prisma');
const { fetchWithTimeout, circuitBreaker } = require('../lib/utils');

/**
 * خدمة تهيئة الواتساب لضمان الاتصال اللحظي والآلي 24/7
 * محسّنة بـ: Timeout protection, حماية من 503, إعادة هيكلة التدفق
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
    evolutionUrl = evolutionUrl.replace(/\/$/, '');
    const { evolutionApiKey, evolutionInstanceName, webhookUrl } = settings;

    // 1. فحص الحالة وتنشيط الاتصال
    console.log(`📡 Checking status for [${evolutionInstanceName}]...`);
    
    let state = 'unknown';
    try {
      const stateRes = await fetchWithTimeout(
        `${evolutionUrl}/instance/connectionState/${evolutionInstanceName}`,
        { headers: { 'apikey': evolutionApiKey } },
        15000
      );
      
      const stateText = await stateRes.text();
      let stateData;
      try {
        stateData = stateText ? JSON.parse(stateText) : {};
      } catch (e) {
        stateData = {};
      }

      if (!stateRes.ok) {
        if (stateRes.status === 503) {
          console.warn('⏳ Evolution Server Busy (503) during init. Will rely on watchdog.');
          circuitBreaker.recordFailure();
          return; // لا داعي لمتابعة التهيئة - الخادم مشغول
        }
        if (stateRes.status === 404) {
          console.log('📝 Instance not found. Will be created when user connects via dashboard.');
          return;
        }
        console.warn(`⚠️ Unexpected status response: HTTP ${stateRes.status}`);
        state = 'error';
      } else {
        state = stateData?.instance?.state || stateData?.state || 'unknown';
        circuitBreaker.recordSuccess();
      }
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        console.warn('⏳ Evolution API timeout during init check. Will rely on watchdog.');
      } else {
        console.warn(`⚠️ Could not reach Evolution API: ${fetchErr.message}`);
      }
      circuitBreaker.recordFailure();
      console.log('✨ WhatsApp Init: Skipped (server unreachable). Watchdog will retry later.');
      return;
    }
    
    if (state !== 'open') {
      console.log(`🔁 Session state is [${state}], triggering auto-reconnect...`);
      try {
        await fetchWithTimeout(
          `${evolutionUrl}/instance/connect/${evolutionInstanceName}`,
          { headers: { 'apikey': evolutionApiKey } },
          15000
        );
        console.log('✅ Reconnect request sent.');
      } catch (connErr) {
        console.warn(`⚠️ Reconnect attempt failed: ${connErr.message}. Watchdog will retry.`);
      }
    } else {
      console.log('✅ WhatsApp session is already OPEN.');
    }

    // 2. فرض إعدادات الثبات (Always Online) — فقط إذا لم يكن السيرفر مشغولاً
    if (circuitBreaker.canProceed()) {
      console.log('⚙️ Enforcing stability settings (Always Online)...');
      try {
        await fetchWithTimeout(
          `${evolutionUrl}/settings/set/${evolutionInstanceName}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify({
              alwaysOnline: true,
              readMessages: true,
              readStatus: true,
              rejectCall: false,
              groupsIgnore: true
            })
          },
          10000
        );
        console.log('✅ Stability settings applied.');
      } catch (settingsErr) {
        console.warn('⚠️ Could not apply stability settings:', settingsErr.message);
      }
    }

    // 3. تسجيل الـ Webhook تلقائياً إذا كان الرابط معروفاً
    if (webhookUrl && circuitBreaker.canProceed()) {
      console.log(`🔗 Auto-registering Webhook: ${webhookUrl}`);
      try {
        const webRes = await fetchWithTimeout(
          `${evolutionUrl}/webhook/set/${evolutionInstanceName}`,
          {
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
          },
          10000
        );
        if (webRes.ok) console.log('✅ Webhook registered successfully.');
        else console.warn(`⚠️ Webhook registration returned HTTP ${webRes.status}`);
      } catch (webhookErr) {
        console.warn('⚠️ Webhook registration failed:', webhookErr.message);
      }
    } else if (!webhookUrl) {
      console.log('⚠️ No webhookUrl found in settings. Auto-reconnect relies on watchdog only.');
    }

    console.log('✨ WhatsApp Initialization Complete.');
  } catch (err) {
    console.error('❌ WhatsApp Initialization Error:', err.message);
  }
}

module.exports = { initializeWhatsApp };
