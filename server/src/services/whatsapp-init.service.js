const prisma = require('../lib/prisma');
const { fetchWithTimeout, circuitBreaker } = require('../lib/utils');

/**
 * خدمة تهيئة الواتساب لضمان الاتصال اللحظي والآلي 24/7
 * محسّنة: Circuit Breaker, null checks, error handling
 */
async function initializeWhatsApp() {
  console.log('🚀 [Init] Starting WhatsApp HA Service...');
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      console.log('ℹ️ [Init] No settings found. Skipping.');
      return;
    }
    if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      console.log('ℹ️ [Init] Evolution API not configured. Dashboard setup required.');
      return;
    }

    let evolutionUrl = settings.evolutionApiUrl;
    if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;
    evolutionUrl = evolutionUrl.replace(/\/$/, '');
    const { evolutionApiKey, evolutionInstanceName, webhookUrl } = settings;

    // 1. فحص الحالة
    console.log(`📡 [Init] Checking [${evolutionInstanceName}]...`);

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
          console.warn('⏳ [Init] Server busy (503). Will rely on watchdog.');
          circuitBreaker.recordFailure(true);
          return;
        }
        if (stateRes.status === 404) {
          console.log('📝 [Init] Instance not found. Needs manual setup via dashboard.');
          return;
        }
        console.warn(`⚠️ [Init] Unexpected response: HTTP ${stateRes.status}`);
        state = 'error';
      } else {
        state = stateData?.instance?.state || stateData?.state || 'unknown';
        circuitBreaker.recordSuccess();
      }
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        console.warn('⏳ [Init] API timeout. Relying on watchdog.');
      } else {
        console.warn(`⚠️ [Init] Cannot reach API: ${fetchErr.message}`);
      }
      circuitBreaker.recordFailure();
      return;
    }

    if (state !== 'open') {
      console.log(`🔁 [Init] State: [${state}]. Reconnecting...`);
      try {
        await fetchWithTimeout(
          `${evolutionUrl}/instance/connect/${evolutionInstanceName}`,
          { headers: { 'apikey': evolutionApiKey } },
          15000
        );
        console.log('✅ [Init] Reconnect request sent.');
      } catch (connErr) {
        console.warn(`⚠️ [Init] Reconnect failed: ${connErr.message}`);
      }
    } else {
      console.log('✅ [Init] WhatsApp session is OPEN.');
    }

    // 2. إعدادات الثبات
    if (circuitBreaker.canProceed()) {
      console.log('⚙️ [Init] Applying stability settings...');
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
        console.log('✅ [Init] Stability settings applied.');
      } catch (settingsErr) {
        console.warn('⚠️ [Init] Could not apply settings:', settingsErr.message);
      }
    }

    // 3. Webhook
    if (webhookUrl && circuitBreaker.canProceed()) {
      console.log(`🔗 [Init] Registering webhook: ${webhookUrl}`);
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
              events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED', 'MESSAGES_UPSERT']
            })
          },
          10000
        );
        if (webRes.ok) {
          console.log('✅ [Init] Webhook registered.');
        } else {
          console.warn(`⚠️ [Init] Webhook returned: HTTP ${webRes.status}`);
        }
      } catch (webhookErr) {
        console.warn('⚠️ [Init] Webhook failed:', webhookErr.message);
      }
    }

    console.log('✨ [Init] Complete.');
  } catch (err) {
    console.error('❌ [Init] Error:', err.message);
  }
}

module.exports = { initializeWhatsApp };
