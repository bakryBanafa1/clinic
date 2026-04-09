const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../lib/utils');
const router = express.Router();

// جلب الفواتير مع فلاتر
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, paymentStatus, from, to, page = 1, limit = 20 } = req.query;
    const where = {};
    if (patientId) where.patientId = parseInt(patientId);
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + 'T23:59:59');
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { patient: { select: { name: true, fileNumber: true, phone: true } } },
        orderBy: { date: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.invoice.count({ where })
    ]);

    res.json({ invoices, total });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب فاتورة بالمعرف
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: true,
        visit: { include: { doctor: { include: { user: { select: { name: true } } } } } }
      }
    });
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إنشاء فاتورة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, visitId, items, discount, tax, paidAmount, paymentMethod, notes } = req.body;
    if (!patientId || !items) return res.status(400).json({ error: 'بيانات ناقصة' });

    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
    const subtotal = parsedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountAmount = discount || 0;
    const taxAmount = tax || 0;
    const total = subtotal - discountAmount + taxAmount;

    let paymentStatus = 'unpaid';
    if (paidAmount >= total) paymentStatus = 'paid';
    else if (paidAmount > 0) paymentStatus = 'partial';

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        patientId: parseInt(patientId),
        visitId: visitId ? parseInt(visitId) : null,
        items: JSON.stringify(parsedItems),
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        paidAmount: paidAmount || 0,
        paymentStatus,
        paymentMethod,
        notes
      },
      include: { patient: { select: { name: true, fileNumber: true } } }
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث فاتورة (دفع)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { paidAmount, paymentMethod, discount, notes } = req.body;
    const invoice = await prisma.invoice.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const newPaid = paidAmount !== undefined ? parseFloat(paidAmount) : invoice.paidAmount;
    let paymentStatus = 'unpaid';
    if (newPaid >= invoice.total) paymentStatus = 'paid';
    else if (newPaid > 0) paymentStatus = 'partial';

    const updated = await prisma.invoice.update({
      where: { id: parseInt(req.params.id) },
      data: { paidAmount: newPaid, paymentStatus, paymentMethod, discount, notes },
      include: { patient: { select: { name: true } } }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// حذف فاتورة
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.invoice.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'تم حذف الفاتورة' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
