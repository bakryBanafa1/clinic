const express = require('express');
const prisma = require('../lib/prisma');
const { generateFileNumber } = require('../lib/utils');
const router = express.Router();

// GET: Receive external booking (for external links) - saves to pending orders
router.get('/receive', async (req, res) => {
  try {
    const { phone, message } = req.query;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'رقم الهاتف والرسالة مطلوبان' });
    }

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('966') && !cleanPhone.startsWith('967')) {
      cleanPhone = '966' + cleanPhone;
    }
    cleanPhone = cleanPhone + '@c.us';

    let patient = await prisma.patient.findFirst({
      where: { phone: cleanPhone }
    });

    if (!patient) {
      let fileNumber;
      let unique = false;
      while (!unique) {
        fileNumber = generateFileNumber();
        const existing = await prisma.patient.findUnique({ where: { fileNumber } });
        if (!existing) unique = true;
      }
      patient = await prisma.patient.create({
        data: {
          fileNumber,
          name: message,
          phone: cleanPhone
        }
      });
    }

    const order = await prisma.whatsAppRequest.create({
      data: {
        phone: cleanPhone,
        message: message,
        status: 'pending',
        sentAt: null
      }
    });

    res.json({ 
      success: true, 
      message: 'تم حجز الطلب بنجاح',
      orderId: order.id
    });
  } catch (err) {
    console.error('Error saving external order:', err);
    res.status(500).json({ error: 'خطأ في حجز الطلب', details: err.message });
  }
});

// POST: Receive external booking
router.post('/receive', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'رقم الهاتف والرسالة مطلوبان' });
    }

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('966') && !cleanPhone.startsWith('967')) {
      cleanPhone = '966' + cleanPhone;
    }
    cleanPhone = cleanPhone + '@c.us';

    let patient = await prisma.patient.findFirst({
      where: { phone: cleanPhone }
    });

    if (!patient) {
      let fileNumber;
      let unique = false;
      while (!unique) {
        fileNumber = generateFileNumber();
        const existing = await prisma.patient.findUnique({ where: { fileNumber } });
        if (!existing) unique = true;
      }
      patient = await prisma.patient.create({
        data: {
          fileNumber,
          name: message,
          phone: cleanPhone
        }
      });
    }

    const order = await prisma.whatsAppRequest.create({
      data: {
        phone: cleanPhone,
        message: message,
        status: 'pending'
      }
    });

    res.json({ 
      success: true, 
      message: 'تم حجز الطلب بنجاح',
      orderId: order.id
    });
  } catch (err) {
    console.error('Error saving external order:', err);
    res.status(500).json({ error: 'خطأ في حجز الطلب', details: err.message });
  }
});

// GET: List all external orders
router.get('/', async (req, res) => {
  try {
    const orders = await prisma.whatsAppRequest.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'خطأ في جلب الطلبات' });
  }
});

// DELETE: Delete an order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.whatsAppRequest.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(500).json({ error: 'خطأ في حذف الطلب' });
  }
});

module.exports = router;