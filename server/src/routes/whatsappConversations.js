const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { cleanPhoneNumber } = require('../lib/utils');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads/whatsapp');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'wa-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploadWhatsApp = multer({ storage });

const router = express.Router();

// ============================================================
// Helper: مطابقة أرقام الهاتف مع أسماء المرضى
// ============================================================
async function matchContactNames(phones) {
  if (!phones || phones.length === 0) return {};

  const patients = await prisma.patient.findMany({
    where: { phone: { not: null } },
    select: { phone: true, name: true }
  });

  const nameMap = {};
  for (const phone of phones) {
    const cleanedPhone = cleanPhoneNumber(phone);
    const match = patients.find(p => {
      const cleanedPatient = cleanPhoneNumber(p.phone);
      return cleanedPatient && (cleanedPatient === cleanedPhone || cleanedPatient === phone || p.phone === phone);
    });
    if (match) nameMap[phone] = match.name;
  }
  return nameMap;
}

// ============================================================
// WhatsApp Conversations - Get paginated contacts with messages
// Supports: ?page=1&limit=30&search=...
// ============================================================

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const search = (req.query.search || '').trim();

    // Get recent messages grouped by contact (efficient: only grab what's needed)
    const allMessages = await prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        fromNumber: true,
        toNumber: true,
        content: true,
        createdAt: true,
        type: true,
        direction: true,
        status: true
      }
    });

    // Build unique contacts map
    const contactsMap = new Map();

    for (const msg of allMessages) {
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

    // Match contact names from patients
    const phones = Array.from(contactsMap.keys());
    const nameMap = await matchContactNames(phones);

    for (const [phone, contact] of contactsMap) {
      if (nameMap[phone]) {
        contact.contactName = nameMap[phone];
      }
    }

    // Convert to array and sort by last message time
    let result = Array.from(contactsMap.values()).sort((a, b) =>
      new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );

    // Apply search filter (search by name or phone)
    if (search) {
      result = result.filter(c =>
        c.phone.includes(search) ||
        (c.contactName && c.contactName.includes(search))
      );
    }

    const total = result.length;
    const hasMore = page * limit < total;

    // Paginate
    const startIdx = (page - 1) * limit;
    const paginated = result.slice(startIdx, startIdx + limit);

    res.json({
      contacts: paginated,
      total,
      page,
      hasMore
    });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'خطأ في جلب المحادثات' });
  }
});

// ============================================================
// Get paginated messages for a specific contact
// Supports: ?limit=50&before=<messageId>
// ============================================================

router.get('/conversations/:phone', authMiddleware, async (req, res) => {
  try {
    const rawPhone = req.params.phone;
    const cleaned = cleanPhoneNumber(rawPhone);
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before ? parseInt(req.query.before) : null;

    if (!rawPhone && !cleaned) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }

    // Search using both raw and cleaned phone to handle format differences
    const phoneVariants = [...new Set([rawPhone, cleaned].filter(Boolean))];

    const where = {
      OR: phoneVariants.flatMap(p => [
        { fromNumber: p },
        { toNumber: p }
      ])
    };

    // If cursor provided, load messages older than that ID
    if (before) {
      where.id = { lt: before };
    }

    // Get total count for this conversation
    const totalCount = await prisma.whatsAppMessage.count({
      where: {
        OR: phoneVariants.flatMap(p => [
          { fromNumber: p },
          { toNumber: p }
        ])
      }
    });

    // Get messages (newest first, then reverse for display)
    const messages = await prisma.whatsAppMessage.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit
    });

    // Reverse to chronological order for display
    messages.reverse();

    const hasMore = before
      ? messages.length === limit
      : totalCount > limit;
    const oldestId = messages.length > 0 ? messages[0].id : null;

    // Get contact name
    const nameMap = await matchContactNames(phoneVariants);
    const contactName = nameMap[rawPhone] || nameMap[cleaned] || null;

    res.json({
      messages,
      total: totalCount,
      hasMore,
      oldestId,
      contactName
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'خطأ في جلب الرسائل' });
  }
});

// ============================================================
// Send message via WhatsApp Cloud (for chat interface)
// ============================================================

router.post('/conversations/:phone/send', authMiddleware, uploadWhatsApp.single('file'), async (req, res) => {
  try {
    const rawPhone = req.params.phone;
    const phone = cleanPhoneNumber(rawPhone);

    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }

    // Use raw phone for DB storage (to match webhook fromNumber format)
    // Use cleaned phone for actual API calls
    const dbPhone = rawPhone;

    const settings = await prisma.clinicSettings.findFirst();

    let message = req.body.message || '';
    let mediaUrl = req.body.mediaUrl || null;

    if (req.file) {
      // Construct public URL for the uploaded file
      mediaUrl = `${req.protocol}://${req.get('host')}/uploads/whatsapp/${req.file.filename}`;
    }

    if (!message && !mediaUrl) {
      return res.status(400).json({ error: 'نص الرسالة أو المرفق مطلوب' });
    }

    // Get sender name from auth
    const senderName = req.user?.name || '';

    if (!settings?.whatsappCloudEnabled) {
      // Try Evolution API if Cloud not enabled
      if (settings?.evolutionApiUrl && settings?.evolutionApiKey && settings?.evolutionInstanceName) {
        const { sendWhatsAppMessage } = require('../lib/utils');
        const result = await sendWhatsAppMessage(settings, phone, message || '', mediaUrl);

        if (result.success || result.queued) {
          const savedMsg = await prisma.whatsAppMessage.create({
            data: {
              fromNumber: settings.whatsappNumber || '',
              toNumber: dbPhone,
              type: mediaUrl ? 'image' : 'text',
              content: message || '[صورة/ملف]',
              status: 'sent',
              direction: 'outgoing',
              rawPayload: JSON.stringify({ queued: result.queued, senderName, mediaUrl })
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
      const savedMsg = await prisma.whatsAppMessage.create({
        data: {
          messageId: result.messageId || null,
          fromNumber: settings.whatsappNumber || settings.whatsappCloudPhoneId || '',
          toNumber: dbPhone,
          type: mediaUrl ? 'image' : 'text',
          content: message || '[صورة/ملف]',
          status: 'sent',
          direction: 'outgoing',
          rawPayload: JSON.stringify({ messageId: result.messageId, senderName, mediaUrl })
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
    const rawPhone = req.params.phone;
    const cleaned = cleanPhoneNumber(rawPhone);
    const phoneVariants = [...new Set([rawPhone, cleaned].filter(Boolean))];

    await prisma.whatsAppMessage.updateMany({
      where: {
        fromNumber: { in: phoneVariants },
        direction: 'incoming'
      },
      data: { status: 'read' }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking as read:', err);
    res.status(500).json({ error: 'خطأ' });
  }
});

// ============================================================
// Debug endpoint - show recent messages in DB
// ============================================================

router.get('/debug/recent', authMiddleware, async (req, res) => {
  try {
    const messages = await prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        messageId: true,
        fromNumber: true,
        toNumber: true,
        type: true,
        content: true,
        status: true,
        direction: true,
        createdAt: true
      }
    });

    const totalCount = await prisma.whatsAppMessage.count();
    const incomingCount = await prisma.whatsAppMessage.count({ where: { direction: 'incoming' } });
    const outgoingCount = await prisma.whatsAppMessage.count({ where: { direction: 'outgoing' } });

    res.json({
      total: totalCount,
      incoming: incomingCount,
      outgoing: outgoingCount,
      recent: messages
    });
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;