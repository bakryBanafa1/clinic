const express = require('express');
const prisma = require('../lib/prisma');
const { sendWhatsAppMessage, cleanPhoneNumber } = require('../lib/utils');
const router = express.Router();

// GET: Send WhatsApp message via browser link (Direct Execution)
router.get('/send', async (req, res) => {
  try {
    const { phone, message, name, service, mediaUrl } = req.query;
    
    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب في الرابط (phone)' });
    }
    if (!message && !mediaUrl) {
      return res.status(400).json({ error: 'يجب توفير إما نص الرسالة (message) أو رابط الوسائط (mediaUrl) أو كليهما' });
    }

    const fullMessage = message ? `${name ? 'الاسم: ' + name + '\n' : ''}${service ? 'الخدمة: ' + service + '\n' : ''}${message}` : '';
    
    let cleanPhone = cleanPhoneNumber(phone) || phone.replace(/[^0-9]/g, '');

    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      // لا توجد إعدادات كاملة -> يحفظ الطلب
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message: fullMessage,
          status: 'pending'
        }
      });
      return res.status(200).json({ 
        success: true, 
        message: 'تم إضافة الطلب في الانتظار (إعدادات الواتساب غير مكتملة)',
        data: request
      });
    }

    // إرسال عبر الدالة الموحدة مع دعم الوسائط אם وجدت
    const result = await sendWhatsAppMessage(settings, cleanPhone, fullMessage, 3, mediaUrl);

    if (result && result.success) {
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message: fullMessage,
          status: 'sent',
          sentAt: new Date()
        }
      });
      return res.json({ success: true, message: 'تم إرسال الرسالة بنجاح', data: result.data, requestId: request.id });
    } else {
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message: fullMessage,
          status: result?.queued ? 'queued' : 'failed'
        }
      });
      
      if (result?.queued) {
        return res.json({ 
          success: true, 
          message: 'تعذر الاتصال حالياً. تم إضافة الرسالة للطابور وسيتم إرسالها تلقائياً',
          requestId: request.id
        });
      }
      return res.status(500).json({ error: 'فشل إرسال الرسالة', details: result?.error });
    }
  } catch (err) {
    console.error('Error in GET /send WhatsApp:', err);
    res.status(500).json({ error: 'حدث خطأ غير متوقع', details: err.message });
  }
});

// POST: Send WhatsApp message via Evolution API (uses shared utility)
router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'رقم الهاتف والرسالة مطلوبان' });
    }

    let cleanPhone = cleanPhoneNumber(phone);
    if (!cleanPhone) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }

    const settings = await prisma.clinicSettings.findFirst();
    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
      // لا إعدادات → حفظ الطلب كـ pending
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message,
          status: 'pending'
        }
      });
      return res.status(200).json({ 
        success: true, 
        message: 'تم إضافة الطلب في الانتظار',
        requestId: request.id
      });
    }

    // إرسال عبر الدالة الموحدة
    const result = await sendWhatsAppMessage(settings, cleanPhone, message);

    if (result && result.success) {
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message,
          status: 'sent',
          sentAt: new Date()
        }
      });
      return res.json({ success: true, message: 'تم إرسال الرسالة بنجاح', requestId: request.id });
    } else {
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message,
          status: result?.queued ? 'queued' : 'failed'
        }
      });
      
      if (result?.queued) {
        return res.json({ 
          success: true, 
          message: 'تم إضافة الرسالة للطابور وسيتم إرسالها عند عودة الاتصال',
          requestId: request.id
        });
      }
      
      return res.status(500).json({ error: 'فشل إرسال الرسالة', details: result?.error });
    }
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة', details: err.message });
  }
});

// GET: List all WhatsApp requests
router.get('/', async (req, res) => {
  try {
    const requests = await prisma.whatsAppRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(requests);
  } catch (err) {
    console.error('Error fetching WhatsApp requests:', err);
    res.status(500).json({ error: 'خطأ في جلب الطلبات' });
  }
});

// DELETE: Delete a WhatsApp request
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.whatsAppRequest.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting WhatsApp request:', err);
    res.status(500).json({ error: 'خطأ في حذف الطلب' });
  }
});

module.exports = router;