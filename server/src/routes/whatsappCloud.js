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
  // Always respond 200 immediately so Meta doesn't retry
  res.status(200).send('OK');

  try {
    const body = req.body;
    console.log('📨 [Cloud Webhook] Event received:', JSON.stringify(body).substring(0, 300));

    if (body?.object !== 'whatsapp_business_account') {
      console.log('📨 [Cloud Webhook] Ignored: not a whatsapp_business_account event');
      return;
    }

    const settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      console.error('❌ [Cloud Webhook] No clinic settings found!');
      return;
    }

    // Get the clinic's display phone number for toNumber
    const clinicPhone = settings.whatsappNumber || settings.whatsappCloudPhoneId || '';

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // ===================== PROCESS INCOMING MESSAGES =====================
        if (value.messages && value.messages.length > 0) {
          const contacts = value.contacts || [];
          
          for (const message of value.messages) {
            console.log(`💬 [Cloud Webhook] Message from ${message.from}: type=${message.type}, id=${message.id}`);

            // Extract content based on message type
            let messageContent = '';
            let messageType = message.type || 'text';

            switch (message.type) {
              case 'text':
                messageContent = message.text?.body || '';
                break;
              case 'image':
                messageContent = message.image?.caption || '[صورة]';
                break;
              case 'video':
                messageContent = message.video?.caption || '[فيديو]';
                break;
              case 'audio':
                messageContent = '[رسالة صوتية]';
                break;
              case 'document':
                messageContent = message.document?.filename || '[مستند]';
                break;
              case 'location':
                messageContent = `[موقع: ${message.location?.name || message.location?.address || 'موقع'}]`;
                break;
              case 'contacts':
                messageContent = '[جهة اتصال]';
                break;
              case 'sticker':
                messageContent = '[ملصق]';
                break;
              case 'reaction':
                messageContent = message.reaction?.emoji || '[تفاعل]';
                messageType = 'reaction';
                break;
              case 'button':
                messageContent = message.button?.text || '[زر]';
                break;
              case 'interactive':
                messageContent = message.interactive?.button_reply?.title || 
                                 message.interactive?.list_reply?.title || '[تفاعلي]';
                break;
              default:
                messageContent = `[${message.type || 'رسالة'}]`;
            }

            // Get contact name from contacts array
            const contactInfo = contacts.find(c => c.wa_id === message.from);
            const contactName = contactInfo?.profile?.name || '';

            // Save message to database
            try {
              // Check if message already exists (avoid duplicates)
              const existing = await prisma.whatsAppMessage.findUnique({
                where: { messageId: message.id }
              });

              if (existing) {
                console.log(`⏭️ [Cloud Webhook] Message ${message.id} already exists, skipping`);
                continue;
              }

              const savedMsg = await prisma.whatsAppMessage.create({
                data: {
                  messageId: message.id,
                  fromNumber: message.from,
                  toNumber: clinicPhone,
                  type: messageType,
                  content: messageContent,
                  status: 'received',
                  direction: 'incoming',
                  rawPayload: JSON.stringify({
                    ...message,
                    _contactName: contactName,
                    _timestamp: message.timestamp
                  })
                }
              });
              console.log(`✅ [Cloud Webhook] Message saved: id=${savedMsg.id}, from=${message.from}, content="${messageContent.substring(0, 50)}"`);
            } catch (dbErr) {
              // Handle unique constraint error gracefully
              if (dbErr.code === 'P2002') {
                console.log(`⏭️ [Cloud Webhook] Duplicate messageId ${message.id}, skipping`);
              } else {
                console.error(`❌ [Cloud Webhook] DB save error:`, dbErr.message);
                console.error(`❌ [Cloud Webhook] Full error:`, JSON.stringify(dbErr));
              }
            }

            // Forward to N8N if enabled
            if (settings.n8nWebhookEnabled && settings.n8nWebhookUrl) {
              try {
                const n8nPayload = {
                  source: 'whatsapp_cloud',
                  timestamp: new Date().toISOString(),
                  clinic_id: settings.id,
                  clinic_name: settings.clinicName,
                  message: {
                    id: message.id,
                    from: message.from,
                    contactName: contactName,
                    type: message.type,
                    text: messageContent,
                    media: message.image || message.video || message.audio || message.document || null,
                    location: message.location || null
                  },
                  contact: contactInfo || {}
                };

                fetch(settings.n8nWebhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(n8nPayload)
                }).catch(e => console.error('❌ [Cloud Webhook] N8N forwarding error:', e.message));
              } catch (n8nErr) {
                console.error('❌ [Cloud Webhook] N8N error:', n8nErr.message);
              }
            }
          }
        }

        // ===================== HANDLE STATUS UPDATES =====================
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            console.log(`📊 [Cloud Webhook] Status: ${status.id} → ${status.status}`);

            try {
              const updated = await prisma.whatsAppMessage.updateMany({
                where: { messageId: status.id },
                data: { status: status.status }
              });
              if (updated.count > 0) {
                console.log(`✅ [Cloud Webhook] Status updated for ${status.id}`);
              }
            } catch (dbErr) {
              console.error('❌ [Cloud Webhook] Status update error:', dbErr.message);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ [Cloud Webhook] Processing error:', err.message, err.stack);
  }
});

// ============================================================
// WhatsApp Cloud API - Send Message
// ============================================================
// WhatsApp Cloud API - Send Message (requires auth)
// ============================================================

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
// WhatsApp Cloud API - Send Text Message (Public for External Systems)
// URL: POST /api/whatsapp-cloud/public/send-text?phone=9665XXXXXXX&message=Hello
// ============================================================
router.get('/public/send-text', async (req, res) => {
  try {
    const { phone, message } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب', example: '/public/send-text?phone=966500000000&message=مرحبا' });
    }

    if (!message) {
      return res.status(400).json({ error: 'نص الرسالة مطلوب', example: '/public/send-text?phone=966500000000&message=مرحبا' });
    }

    const settings = await prisma.clinicSettings.findFirst();

    if (!settings?.whatsappCloudEnabled) {
      return res.status(400).json({ error: 'WhatsApp Cloud غير مفعّل' });
    }

    const result = await sendWhatsAppCloudMessage(settings, phone, message);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        status: 'sent'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (err) {
    console.error('WhatsApp Cloud public send error:', err);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
  }
});

// ============================================================
// WhatsApp Cloud API - Send Text + Image (Public for External Systems)
// URL: POST /api/whatsapp-cloud/public/send-image?phone=9665XXXXXXX&message=Description&mediaUrl=https://...
// ============================================================
router.get('/public/send-image', async (req, res) => {
  try {
    const { phone, message, mediaUrl } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب', example: '/public/send-image?phone=966500000000&message=وصف&mediaUrl=https://...' });
    }

    if (!mediaUrl) {
      return res.status(400).json({ error: 'رابط الصورة مطلوب' });
    }

    const settings = await prisma.clinicSettings.findFirst();

    if (!settings?.whatsappCloudEnabled) {
      return res.status(400).json({ error: 'WhatsApp Cloud غير مفعّل' });
    }

    const result = await sendWhatsAppCloudMessage(settings, phone, message || '', mediaUrl);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        status: 'sent'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (err) {
    console.error('WhatsApp Cloud public send image error:', err);
    res.status(500).json({ error: 'خطأ في إرسال الصورة' });
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
