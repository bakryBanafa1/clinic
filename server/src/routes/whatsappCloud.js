const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { renderTemplate, sendWhatsAppCloudMessage, cleanPhoneNumber, fetchWithTimeout } = require('../lib/utils');
const crypto = require('crypto');
const router = express.Router();

// ============================================================
// WhatsApp Cloud API - Settings Endpoints
// ============================================================

// GET: Fetch WhatsApp Cloud Settings
router.get('/cloud-settings', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      return res.json({
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
    }

    res.json({
      whatsappCloudEnabled: settings.whatsappCloudEnabled || false,
      whatsappCloudApiKey: settings.whatsappCloudApiKey || '',
      whatsappCloudPhoneId: settings.whatsappCloudPhoneId || '',
      whatsappCloudAppId: settings.whatsappCloudAppId || '',
      whatsappCloudAppSecret: settings.whatsappCloudAppSecret || '',
      whatsappCloudWebhookUrl: settings.whatsappCloudWebhookUrl || '',
      whatsappCloudWebhookVerifyToken: settings.whatsappCloudWebhookVerifyToken || '',
      whatsappCloudWebhookEndpoint: settings.whatsappCloudWebhookEndpoint || '/api/whatsapp-cloud/webhook',
      n8nWebhookUrl: settings.n8nWebhookUrl || '',
      n8nWebhookEnabled: settings.n8nWebhookEnabled || false
    });
  } catch (err) {
    console.error('Error fetching WhatsApp Cloud settings:', err);
    res.status(500).json({ error: 'خطأ في جلب الإعدادات' });
  }
});

// POST: Save WhatsApp Cloud Settings
router.post('/cloud-settings', authMiddleware, async (req, res) => {
  try {
    const {
      whatsappCloudEnabled,
      whatsappCloudApiKey,
      whatsappCloudPhoneId,
      whatsappCloudAppId,
      whatsappCloudAppSecret,
      whatsappCloudWebhookUrl,
      whatsappCloudWebhookVerifyToken,
      whatsappCloudWebhookEndpoint,
      n8nWebhookUrl,
      n8nWebhookEnabled
    } = req.body;

    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }

    const updated = await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: {
        whatsappCloudEnabled: whatsappCloudEnabled ?? false,
        whatsappCloudApiKey: whatsappCloudApiKey || null,
        whatsappCloudPhoneId: whatsappCloudPhoneId || null,
        whatsappCloudAppId: whatsappCloudAppId || null,
        whatsappCloudAppSecret: whatsappCloudAppSecret || null,
        whatsappCloudWebhookUrl: whatsappCloudWebhookUrl || null,
        whatsappCloudWebhookVerifyToken: whatsappCloudWebhookVerifyToken || null,
        whatsappCloudWebhookEndpoint: whatsappCloudWebhookEndpoint || '/api/whatsapp-cloud/webhook',
        n8nWebhookUrl: n8nWebhookUrl || null,
        n8nWebhookEnabled: n8nWebhookEnabled ?? false
      }
    });

    res.json({ success: true, message: 'تم حفظ إعدادات WhatsApp Cloud بنجاح' });
  } catch (err) {
    console.error('Error saving WhatsApp Cloud settings:', err);
    res.status(500).json({ error: 'خطأ في حفظ الإعدادات' });
  }
});

// ============================================================
// WhatsApp Cloud API - Test Connection
// ============================================================

// POST: Test WhatsApp Cloud API Connection
router.post('/cloud-test', authMiddleware, async (req, res) => {
  try {
    const { apiKey, phoneId, appId } = req.body;

    if (!apiKey || !phoneId) {
      return res.status(400).json({ error: 'API Key و Phone ID مطلوبان للاختبار' });
    }

    // Test by fetching phone number info
    const url = `https://graph.facebook.com/v18.0/${phoneId}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }, 15000);

    const data = await response.json();

    if (response.ok) {
      res.json({
        success: true,
        message: 'الاتصال ناجح!',
        phoneInfo: {
          display_phone_number: data.display_phone_number,
          verified_name: data.verified_name,
          quality_rating: data.quality_rating,
          status: data.status
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: data.error?.message || 'فشل الاتصال بـ WhatsApp Cloud API',
        details: data.error
      });
    }
  } catch (err) {
    console.error('WhatsApp Cloud test error:', err);
    res.status(500).json({
      success: false,
      error: 'خطأ في الاتصال بـ WhatsApp Cloud API',
      details: err.message
    });
  }
});

// POST: Test N8N Webhook
router.post('/n8n-test', authMiddleware, async (req, res) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'رابط N8N Webhook مطلوب' });
    }

    // Send test payload to N8N
    const testPayload = {
      test: true,
      source: 'clinic_system',
      timestamp: new Date().toISOString(),
      message: {
        from: '966500000000',
        body: 'رسالة تجريبية من نظام العيادة',
        type: 'text'
      }
    };

    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    }, 15000);

    if (response.ok) {
      res.json({ success: true, message: 'تم الاتصال بـ N8N بنجاح!' });
    } else {
      const text = await response.text();
      res.status(400).json({
        success: false,
        error: `فشل الاتصال (HTTP ${response.status})`,
        details: text.substring(0, 200)
      });
    }
  } catch (err) {
    console.error('N8N webhook test error:', err);
    res.status(500).json({
      success: false,
      error: 'خطأ في الاتصال بـ N8N',
      details: err.message
    });
  }
});

// ============================================================
// WhatsApp Cloud API - Webhook Verification
// ============================================================

// GET: Webhook Verification (Meta calls this to verify the webhook)
router.get('/webhook', async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    const verifyToken = settings?.whatsappCloudWebhookVerifyToken || '';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('📨 WhatsApp Cloud Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  } catch (err) {
    console.error('Webhook verification error:', err);
    res.status(500).send('Error');
  }
});

// ============================================================
// WhatsApp Cloud API - Webhook Receiver
// ============================================================

// POST: Webhook Receiver (Meta sends messages here)
router.post('/webhook', async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();

    // Always respond 200 quickly to acknowledge receipt
    res.status(200).send('OK');

    console.log('📨 WhatsApp Cloud Webhook received:', JSON.stringify(req.body, null, 2));

    // Check if this is a webhook verification request
    if (req.body.object === 'whatsapp_business_account') {
      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        // Process incoming messages
        for (const message of value.messages) {
          console.log('💬 Processing message:', message);

          // Forward to N8N if enabled
          if (settings?.n8nWebhookEnabled && settings?.n8nWebhookUrl) {
            try {
              const n8nPayload = {
                source: 'whatsapp_cloud',
                timestamp: new Date().toISOString(),
                clinic_id: settings.id,
                clinic_name: settings.clinicName,
                message: {
                  id: message.id,
                  from: message.from,
                  type: message.type,
                  text: message.text?.body || '',
                  media: message.image ? {
                    id: message.image.id,
                    mime_type: message.image.mime_type,
                    sha256: message.image.sha256
                  } : null,
                  location: message.location ? {
                    latitude: message.location.latitude,
                    longitude: message.location.longitude,
                    name: message.location.name,
                    address: message.location.address
                  } : null
                },
                contact: value.contacts?.[0] || {}
              };

              // Forward to N8N (fire and forget)
              fetch(settings.n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(n8nPayload)
              }).catch(e => console.error('N8N forwarding error:', e));

            } catch (n8nErr) {
              console.error('Error forwarding to N8N:', n8nErr);
            }
          }

          // Save message to database if needed
          try {
            await prisma.whatsappMessage.create({
              data: {
                messageId: message.id,
                fromNumber: message.from,
                type: message.type,
                content: message.text?.body || (message.image ? '[صورة]' : '[وسائط]'),
                status: 'received',
                direction: 'incoming',
                rawPayload: JSON.stringify(message)
              }
            });
          } catch (dbErr) {
            // Ignore duplicate message errors
            if (!dbErr.code === 'P2002') {
              console.error('Error saving message:', dbErr);
            }
          }
        }
      }

      // Handle status updates (delivered, read, etc.)
      if (value?.statuses) {
        for (const status of value.statuses) {
          console.log('📊 Message status update:', status);

          // Update message status in database
          try {
            await prisma.whatsappMessage.updateMany({
              where: { messageId: status.id },
              data: { status: status.status }
            });
          } catch (dbErr) {
            console.error('Error updating message status:', dbErr);
          }
        }
      }
    }

  } catch (err) {
    console.error('Webhook receiver error:', err);
    // Already sent 200 OK above, so just log
  }
});

// ============================================================
// WhatsApp Cloud API - Send Message
// ============================================================

// POST: Send message via WhatsApp Cloud API
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { phone, message, mediaUrl, templateName } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    }

    const settings = await prisma.clinicSettings.findFirst();

    if (!settings?.whatsappCloudEnabled) {
      return res.status(400).json({ error: 'WhatsApp Cloud غير مفعّل' });
    }

    const result = await sendWhatsAppCloudMessage(settings, phone, message, mediaUrl, templateName);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        message: 'تم إرسال الرسالة بنجاح'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (err) {
    console.error('WhatsApp Cloud send error:', err);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
  }
});

// ============================================================
// WhatsApp Cloud API - Message Templates (GET from Meta)
// ============================================================

// GET: Fetch registered templates from Meta
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();

    if (!settings?.whatsappCloudEnabled || !settings?.whatsappCloudApiKey) {
      return res.status(400).json({ error: 'WhatsApp Cloud غير مفعّل أو مفقود' });
    }

    // Get WABA ID from Phone ID
    const phoneResponse = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/${settings.whatsappCloudPhoneId}`,
      { headers: { 'Authorization': `Bearer ${settings.whatsappCloudApiKey}` } },
      15000
    );
    const phoneData = await phoneResponse.json();

    if (!phoneData.verified_name) {
      return res.status(400).json({ error: 'فشل جلب معلومات رقم الهاتف' });
    }

    const wabaId = phoneData.verified_name === settings.whatsappCloudPhoneId
      ? settings.whatsappCloudPhoneId
      : phoneData.id;

    // Fetch templates
    const templatesResponse = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/${wabaId}/message_templates?fields=name,status,category,language,components`,
      { headers: { 'Authorization': `Bearer ${settings.whatsappCloudApiKey}` } },
      15000
    );
    const templatesData = await templatesResponse.json();

    if (templatesData.error) {
      return res.status(400).json({ error: templatesData.error.message });
    }

    res.json({
      success: true,
      templates: templatesData.data || [],
      phoneInfo: {
        display_phone_number: phoneData.display_phone_number,
        verified_name: phoneData.verified_name,
        quality_rating: phoneData.quality_rating
      }
    });
  } catch (err) {
    console.error('WhatsApp Cloud templates error:', err);
    res.status(500).json({ error: 'خطأ في جلب القوالب' });
  }
});

// ============================================================
// WhatsApp Cloud API - Phone Number Verification
// ============================================================

// POST: Verify Phone Number
router.post('/verify-phone', authMiddleware, async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();

    if (!settings?.whatsappCloudEnabled || !settings?.whatsappCloudApiKey) {
      return res.status(400).json({ error: 'WhatsApp Cloud غير مفعّل' });
    }

    // Test by fetching phone number info
    const url = `https://graph.facebook.com/v18.0/${settings.whatsappCloudPhoneId}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${settings.whatsappCloudApiKey}`,
        'Content-Type': 'application/json'
      }
    }, 15000);

    const data = await response.json();

    if (response.ok) {
      res.json({
        success: true,
        connected: true,
        phoneInfo: {
          display_phone_number: data.display_phone_number,
          verified_name: data.verified_name,
          quality_rating: data.quality_rating,
          status: data.status,
          code_verification_status: data.code_verification_status,
          past_analytics: data.past_analytics
        }
      });
    } else {
      res.json({
        success: false,
        connected: false,
        error: data.error?.message || 'فشل التحقق'
      });
    }
  } catch (err) {
    console.error('WhatsApp Cloud phone verification error:', err);
    res.status(500).json({
      success: false,
      connected: false,
      error: err.message
    });
  }
});

module.exports = router;
