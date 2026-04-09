const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// جلب كل الزيارات
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, date, page = 1, limit = 20 } = req.query;
    const where = {};
    if (patientId) where.patientId = parseInt(patientId);
    if (doctorId) where.doctorId = parseInt(doctorId);
    if (date) where.visitDate = { gte: new Date(date + 'T00:00:00'), lte: new Date(date + 'T23:59:59') };

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        include: {
          patient: { select: { name: true, fileNumber: true, phone: true } },
          doctor: { include: { user: { select: { name: true } } } },
          prescription: true,
          followUp: true
        },
        orderBy: { visitDate: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.visit.count({ where })
    ]);

    res.json({ visits, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إنشاء زيارة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId, chiefComplaint, diagnosis, examination, treatmentPlan, notes, vitalSigns } = req.body;
    if (!patientId || !doctorId) return res.status(400).json({ error: 'بيانات ناقصة' });

    const visit = await prisma.visit.create({
      data: {
        patientId: parseInt(patientId),
        doctorId: parseInt(doctorId),
        appointmentId: appointmentId ? parseInt(appointmentId) : null,
        chiefComplaint,
        diagnosis,
        examination,
        treatmentPlan,
        notes,
        vitalSigns: vitalSigns ? JSON.stringify(vitalSigns) : null
      },
      include: {
        patient: { select: { name: true, fileNumber: true } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    });

    // تحديث حالة الموعد إلى مكتمل
    if (appointmentId) {
      await prisma.appointment.update({
        where: { id: parseInt(appointmentId) },
        data: { status: 'completed' }
      });
    }

    res.status(201).json(visit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث زيارة
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { chiefComplaint, diagnosis, examination, treatmentPlan, notes, vitalSigns } = req.body;
    const visit = await prisma.visit.update({
      where: { id: parseInt(req.params.id) },
      data: {
        chiefComplaint, diagnosis, examination, treatmentPlan, notes,
        vitalSigns: vitalSigns ? JSON.stringify(vitalSigns) : undefined
      },
      include: {
        patient: { select: { name: true, fileNumber: true } },
        doctor: { include: { user: { select: { name: true } } } },
        prescription: true,
        followUp: true
      }
    });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب زيارة واحدة
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: true,
        doctor: { include: { user: { select: { name: true } } } },
        prescription: true,
        followUp: true,
        invoice: true
      }
    });
    if (!visit) return res.status(404).json({ error: 'الزيارة غير موجودة' });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
