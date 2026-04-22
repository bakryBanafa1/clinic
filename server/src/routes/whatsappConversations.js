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
    // Get all messages with both incoming and outgoing
    const allMessages = await prisma.whatsappMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    // Get unique contacts (from both incoming and outgoing)
    const contactsMap = new Map();

    for (const msg of allMessages) {
      // For incoming messages, the contact is fromNumber
      // For outgoing messages, the contact is toNumber
      const contactPhone = msg.direction === 'incoming' ? msg.fromNumber : msg.toNumber;

      if (contactPhone && !contactsMap.has(contactPhone)) {
        contactsMap.set(contactPhone, {
          phone: contactPhone,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          type: msg.type,
          direction: msg.direction,
          unreadCount: msg.status !== 'read' && msg.direction === 'incoming' ? 1 : 0
        });
      }
    }

    // Convert to array and sort by last message time
    const result = Array.from(contactsMap.values()).sort((a, b) =>
      new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );

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

    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }

    const settings = await prisma.clinicSettings.findFirst();
    const isFormData = req.headers['content-type']?.includes('multipart/form-data');

    let message = '';
    let mediaUrl = null;
    let fileUrl = null;

    if (isFormData) {
      // Handle FormData (file upload)
      message = req.body.message || '';
      // For now, we'll save the message without media URL
      // Media upload to CDN would need to be implemented
    } else {
      // Handle JSON body
      message = req.body.message || '';
      mediaUrl = req.body.mediaUrl || null;
    }

    if (!message && !mediaUrl && !fileUrl) {
      return res.status(400).json({ error: 'نص الرسالة أو المرفق مطلوب' });
    }

    if (!settings?.whatsappCloudEnabled) {
      // Try Evolution API if Cloud not enabled
      if (settings?.evolutionApiUrl && settings?.evolutionApiKey && settings?.evolutionInstanceName) {
        const { sendWhatsAppMessage } = require('../lib/utils');
        const result = await sendWhatsAppMessage(settings, phone, message || '', mediaUrl);

        if (result.success || result.queued) {
          const savedMsg = await prisma.whatsappMessage.create({
            data: {
              fromNumber: settings.whatsappNumber || '',
              toNumber: phone,
              type: mediaUrl ? 'image' : 'text',
              content: message || '[صورة/ملف]',
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
          content: message || '[صورة/ملف]',
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