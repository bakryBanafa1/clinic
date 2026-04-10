const express = require('express');
const prisma = require('../lib/prisma');
const router = express.Router();

// GET: Save request only (for external links) - no actual WhatsApp sending
router.get('/send', async (req, res) => {
  try {
    const { phone, message, name, service } = req.query;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'رقم الهاتف والرسالة مطلوبان' });
    }

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('966') && !cleanPhone.startsWith('967')) {
      cleanPhone = '966' + cleanPhone;
    }
    cleanPhone = cleanPhone + '@c.us';

    const request = await prisma.whatsAppRequest.create({
      data: {
        phone: cleanPhone,
        message: `${name ? name + '\n' : ''}${service ? 'الخدمة: ' + service + '\n' : ''}${message}`,
        status: 'pending'
      }
    });

    res.json({ 
      success: true, 
      message: 'تم حجز الطلب بنجاح',
      requestId: request.id
    });
  } catch (err) {
    console.error('Error saving request:', err);
    res.status(500).json({ error: 'خطأ في حجز الطلب', details: err.message });
  }
});

// POST: Send WhatsApp message via Evolution API
router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    return await sendWhatsAppMessage(phone, message, res);
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة', details: err.message });
  }
});

// Shared function for sending WhatsApp messages
async function sendWhatsAppMessage(phone, message, res) {
  if (!phone || !message) {
    return res.status(400).json({ error: 'رقم الهاتف والرسالة مطلوبان' });
  }

  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '966' + cleanPhone.substring(1);
  } else if (!cleanPhone.startsWith('966')) {
    cleanPhone = '966' + cleanPhone;
  }
  cleanPhone = cleanPhone + '@c.us';

  const settings = await prisma.clinicSettings.findFirst();
  if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
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

  let evolutionUrl = settings.evolutionApiUrl;
  if (!evolutionUrl.startsWith('http')) {
    evolutionUrl = 'https://' + evolutionUrl;
  }

  const response = await fetch(`${evolutionUrl}/message/sendText/${settings.evolutionInstanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': settings.evolutionApiKey
    },
    body: JSON.stringify({
      number: cleanPhone,
      text: message
    })
  });

  const data = await response.json();

  if (!response.ok) {
    await prisma.whatsAppRequest.create({
      data: {
        phone: cleanPhone,
        message,
        status: 'failed'
      }
    });
    return res.status(500).json({ error: 'فشل إرسال الرسالة', details: data.message });
  }

  const request = await prisma.whatsAppRequest.create({
    data: {
      phone: cleanPhone,
      message,
      status: 'sent',
      sentAt: new Date()
    }
  });

  res.json({ success: true, message: 'تم إرسال الرسالة بنجاح', requestId: request.id });
}

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