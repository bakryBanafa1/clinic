const express = require('express');
const prisma = require('../lib/prisma');
const { sendWhatsAppMessage, cleanPhoneNumber } = require('../lib/utils');
const router = express.Router();

// Helper function to send HTML or JSON based on the request's Accept header
const sendResponse = (req, res, statusCode, isSuccess, title, message, data = {}) => {
  const isBrowser = req.headers.accept && req.headers.accept.includes('text/html');
  if (isBrowser) {
    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 450px; width: 90%; }
        .icon { font-size: 5rem; margin-bottom: 1rem; color: ${isSuccess ? '#10b981' : (statusCode === 200 ? '#f59e0b' : '#ef4444')}; }
        h1 { color: #1f2937; font-size: 1.75rem; margin-bottom: 1rem; }
        p { color: #4b5563; font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.6; }
        .btn { background-color: #3b82f6; color: white; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-size: 1.1rem; cursor: pointer; text-decoration: none; display: inline-block; font-weight: bold; transition: background-color 0.2s; }
        .btn:hover { background-color: #2563eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${isSuccess ? '✅' : (statusCode === 200 ? '⏳' : '❌')}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <button class="btn" onclick="window.close(); if(window.history.length > 1) window.history.back();">إغلاق النافذة</button>
      </div>
    </body>
    </html>
    `;
    return res.status(statusCode).send(html);
  }
  
  return res.status(statusCode).json({ success: isSuccess, message, ...data });
};

// GET: Save request only (for external systems) - stores in DB as pending without sending immediately
router.get('/save', async (req, res) => {
  try {
    const { phone, message, name, service } = req.query;
    
    if (!phone || !message) {
      return sendResponse(req, res, 400, false, 'خطأ في الطلب', 'رقم الهاتف والرسالة مطلوبان في الرابط', { error: 'Missing phone or message' });
    }

    const fullMessage = `${name ? 'الاسم: ' + name + '\n' : ''}${service ? 'الخدمة: ' + service + '\n' : ''}${message}`;
    let cleanPhone = cleanPhoneNumber(phone) || phone.replace(/[^0-9]/g, '');

    const request = await prisma.whatsAppRequest.create({
      data: {
        phone: cleanPhone,
        message: fullMessage,
        status: 'pending'
      }
    });

    return sendResponse(req, res, 200, true, 'تم الحفظ بنجاح', 'تم حجز الطلب وحفظه بقاعدة البيانات بنجاح', { requestId: request.id });
  } catch (err) {
    console.error('Error saving request:', err);
    return sendResponse(req, res, 500, false, 'حدث خطأ', 'خطأ في حجز الطلب', { details: err.message });
  }
});

// GET: Send WhatsApp message via browser link (Direct Execution)
router.get('/send', async (req, res) => {
  try {
    const { phone, message, name, service, mediaUrl } = req.query;
    
    if (!phone) {
      return sendResponse(req, res, 400, false, 'خطأ في الطلب', 'رقم الهاتف مطلوب في الرابط', { error: 'Missing phone' });
    }
    if (!message && !mediaUrl) {
      return sendResponse(req, res, 400, false, 'خطأ في الطلب', 'يجب توفير إما نص الرسالة أو رابط الوسائط أو كليهما', { error: 'Missing message or mediaUrl' });
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
      return sendResponse(req, res, 200, true, 'تم إضافة الطلب في الانتظار', 'إعدادات الواتساب غير مكتملة، تم حفظ الطلب للإرسال لاحقاً.', { data: request });
    }

    // إرسال عبر الدالة الموحدة مع دعم الوسائط
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
      
      await prisma.whatsAppMessage.create({
        data: {
          messageId: result.messageId || null,
          fromNumber: settings.whatsappNumber || settings.whatsappCloudPhoneId || 'System',
          toNumber: cleanPhone,
          type: mediaUrl ? 'image' : 'text',
          content: fullMessage || '[صورة/ملف]',
          status: 'sent',
          direction: 'outgoing',
          rawPayload: JSON.stringify({ messageId: result.messageId, senderName: 'API (Auto Reply)', mediaUrl })
        }
      });

      return sendResponse(req, res, 200, true, 'تم الإرسال بنجاح', 'تم إرسال رسالة الواتساب إلى العميل بنجاح.', { data: result.data, requestId: request.id });
    } else {
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message: fullMessage,
          status: result?.queued ? 'queued' : 'failed'
        }
      });
      
      if (result?.queued) {
        return sendResponse(req, res, 200, true, 'تم الإضافة للطابور', 'تعذر الاتصال حالياً. تم إضافة الرسالة للطابور وسيتم إرسالها تلقائياً عند عودة الاتصال.', { requestId: request.id });
      }
      return sendResponse(req, res, 500, false, 'فشل الإرسال', result?.error || 'حدث خطأ أثناء محاولة إرسال الرسالة.', { details: result?.error });
    }
  } catch (err) {
    console.error('Error in GET /send WhatsApp:', err);
    return sendResponse(req, res, 500, false, 'حدث خطأ', 'حدث خطأ غير متوقع', { details: err.message });
  }
});

// POST: Send WhatsApp message via API (uses shared utility)
router.post('/send', async (req, res) => {
  try {
    const { phone, message, mediaUrl } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    }
    if (!message && !mediaUrl) {
      return res.status(400).json({ error: 'يجب توفير إما نص الرسالة أو رابط الوسائط أو كليهما' });
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
          message: message || '',
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
    const result = await sendWhatsAppMessage(settings, cleanPhone, message || '', 3, mediaUrl);

    if (result && result.success) {
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message: message || '',
          status: 'sent',
          sentAt: new Date()
        }
      });

      await prisma.whatsAppMessage.create({
        data: {
          messageId: result.messageId || null,
          fromNumber: settings.whatsappNumber || settings.whatsappCloudPhoneId || 'System',
          toNumber: cleanPhone,
          type: mediaUrl ? 'image' : 'text',
          content: message || '[صورة/ملف]',
          status: 'sent',
          direction: 'outgoing',
          rawPayload: JSON.stringify({ messageId: result.messageId, senderName: 'API (Auto Reply)', mediaUrl })
        }
      });

      return res.json({ success: true, message: 'تم إرسال الرسالة بنجاح', requestId: request.id });
    } else {
      const request = await prisma.whatsAppRequest.create({
        data: {
          phone: cleanPhone,
          message: message || '',
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