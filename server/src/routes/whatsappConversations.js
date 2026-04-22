const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { cleanPhoneNumber } = require('../lib/utils');
const router = express.Router();

// ============================================================
// WhatsApp Conversations - Get all contacts with messages
// ============================================================

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    // Get distinct contacts from messages
    const messages = await prisma.whatsappMessage.findMany({
      where: {
        direction: 'incoming'
      },
      select: {
        fromNumber: true
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    // Get unique contacts with latest message
    const contactsMap = new Map();
    for (const msg of messages) {
      if (!contactsMap.has(msg.fromNumber)) {
        contactsMap.set(msg.fromNumber, {
          phone: msg.fromNumber,
          lastMessage: null,
          lastMessageAt: null,
          unreadCount: 0
        });
      }
    }

    // Get full contact info and last message
    const contacts = await prisma.whatsappMessage.findMany({
      where: {
        fromNumber: { in: Array.from(contactsMap.keys()) }
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    const result = [];
    const seen = new Set();

    for (const msg of messages) {
      if (!seen.has(msg.fromNumber)) {
        seen.add(msg.fromNumber);
        result.push({
          phone: msg.fromNumber,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          type: msg.type,
          direction: 'incoming'
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'خطأ في جلب المحادثات' });
  }
});

// ============================================================
// Get messages for a specific contact
// ============================================================

router.get('/conversations/:phone', authMiddleware, async (req, res) => {
  try {
    const phone = cleanPhoneNumber(req.params.phone);
    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }

    const messages = await prisma.whatsappMessage.findMany({
      where: {
        OR: [
          { fromNumber: phone },
          { toNumber: phone }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'خطأ في جلب الرسائل' });
  }
});

// ============================================================
// Send message via WhatsApp Cloud (for chat interface)
// ============================================================

router.post('/conversations/:phone/send', authMiddleware, async (req, res) => {
  try {
    const phone = cleanPhoneNumber(req.params.phone);
    const { message, mediaUrl } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }

    if (!message && !mediaUrl) {
      return res.status(400).json({ error: 'نص الرسالة أو المرفق مطلوب' });
    }

    const settings = await prisma.clinicSettings.findFirst();

    if (!settings?.whatsappCloudEnabled) {
      // Try Evolution API if Cloud not enabled
      if (settings?.evolutionApiUrl && settings?.evolutionApiKey && settings?.evolutionInstanceName) {
        const { sendWhatsAppMessage } = require('../lib/utils');
        const result = await sendWhatsAppMessage(settings, phone, message || '', mediaUrl);

        if (result.success || result.queued) {
          // Save to database
          const savedMsg = await prisma.whatsappMessage.create({
            data: {
              fromNumber: settings.whatsappNumber || '',
              toNumber: phone,
              type: mediaUrl ? 'image' : 'text',
              content: message || '[صورة]',
              status: 'sent',
              direction: 'outgoing',
              rawPayload: JSON.stringify({ queued: result.queued })
            }
          });
          return res.json(savedMsg);
        } else {
          return res.status(400).json({ error: result.error });
        }
      }
      return res.status(400).json({ error: 'WhatsApp غير مفعّل' });
    }

    // Use WhatsApp Cloud API
    const { sendWhatsAppCloudMessage } = require('../lib/utils');
    const result = await sendWhatsAppCloudMessage(settings, phone, message || '', mediaUrl);

    if (result.success) {
      const savedMsg = await prisma.whatsappMessage.create({
        data: {
          fromNumber: settings.whatsappCloudPhoneId || '',
          toNumber: phone,
          type: mediaUrl ? 'image' : 'text',
          content: message || '[صورة]',
          status: 'sent',
          direction: 'outgoing',
          rawPayload: JSON.stringify({ messageId: result.messageId })
        }
      });
      res.json(savedMsg);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
  }
});

// ============================================================
// Mark messages as read
// ============================================================

router.put('/conversations/:phone/read', authMiddleware, async (req, res) => {
  try {
    const phone = cleanPhoneNumber(req.params.phone);

    await prisma.whatsappMessage.updateMany({
      where: { fromNumber: phone },
      data: { status: 'read' }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking as read:', err);
    res.status(500).json({ error: 'خطأ' });
  }
});

module.exports = router;