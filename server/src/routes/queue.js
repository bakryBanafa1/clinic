const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// جلب الدور لتاريخ معين
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { date, doctorId, status } = req.query;
    const today = date || new Date().toISOString().split('T')[0];
    const where = { date: today };
    if (doctorId) where.doctorId = parseInt(doctorId);
    if (status) where.status = status;

    const queue = await prisma.queueEntry.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, fileNumber: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
        appointment: { select: { period: true, startTime: true } }
      },
      orderBy: { queueNumber: 'asc' }
    });
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تسجيل وصول (إضافة للدور)
router.post('/checkin', authMiddleware, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) return res.status(400).json({ error: 'معرف الموعد مطلوب' });

    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(appointmentId) },
      include: { patient: true }
    });
    if (!appointment) return res.status(404).json({ error: 'الموعد غير موجود' });

    if (appointment.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'عذراً! لا يمكن دخـول المريض للعيادة قبل تـسديـد كـامـل المبـلغ.' });
    }

    // التحقق من عدم التسجيل مسبقاً
    const existing = await prisma.queueEntry.findUnique({ where: { appointmentId: parseInt(appointmentId) } });
    if (existing) return res.status(400).json({ error: 'المريض مسجل في الدور بالفعل' });

    const entry = await prisma.queueEntry.create({
      data: {
        appointmentId: parseInt(appointmentId),
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        date: appointment.date,
        // سحب رقم الدور الأصلي من الموعد لضمان أولوية الحجز وعدم تخطي من دفع جزئياً
        queueNumber: appointment.queueNumber || 999 
      },
      include: {
        patient: { select: { name: true, fileNumber: true } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    });

    // تحديث حالة الموعد
    await prisma.appointment.update({
      where: { id: parseInt(appointmentId) },
      data: { status: 'checked_in' }
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// استدعاء مريض
router.put('/:id/call', authMiddleware, async (req, res) => {
  try {
    const entry = await prisma.queueEntry.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'in_progress', calledAt: new Date() },
      include: { patient: { select: { name: true, fileNumber: true } } }
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إكمال مريض
router.put('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const entry = await prisma.queueEntry.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'completed', completedAt: new Date() }
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تخطي مريض
router.put('/:id/skip', authMiddleware, async (req, res) => {
  try {
    const entry = await prisma.queueEntry.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'skipped' }
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
