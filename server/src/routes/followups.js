const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { calculateFollowUpDate, calculateReminderDate } = require('../lib/utils');
const router = express.Router();

// جلب مواعيد العودة مع فلاتر
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, doctorId, date, from, to, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = parseInt(doctorId);
    if (date) where.scheduledDate = date;
    if (from || to) {
      where.scheduledDate = {};
      if (from) where.scheduledDate.gte = from;
      if (to) where.scheduledDate.lte = to;
    }

    const [followUps, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true, fileNumber: true, phone: true } },
          doctor: { include: { user: { select: { name: true } } } },
          visit: { select: { diagnosis: true, visitDate: true } }
        },
        orderBy: { scheduledDate: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.followUp.count({ where })
    ]);

    res.json({ followUps, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إحصائيات العودة (لليوم ومتأخرة)
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [todayCount, overdueCount, pendingCount] = await Promise.all([
      prisma.followUp.count({ where: { scheduledDate: today, status: { in: ['pending', 'reminded'] } } }),
      prisma.followUp.count({ where: { scheduledDate: { lt: today }, status: { in: ['pending', 'reminded'] } } }),
      prisma.followUp.count({ where: { status: 'pending' } })
    ]);
    res.json({ today: todayCount, overdue: overdueCount, pending: pendingCount });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إنشاء موعد عودة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, visitId, daysAfterVisit, scheduledDate, reason, notes } = req.body;
    if (!patientId || !doctorId || !visitId) {
      return res.status(400).json({ error: 'بيانات ناقصة' });
    }

    // حساب تاريخ العودة
    const visit = await prisma.visit.findUnique({ where: { id: parseInt(visitId) } });
    if (!visit) return res.status(404).json({ error: 'الزيارة غير موجودة' });

    let finalDate = scheduledDate;
    let days = daysAfterVisit;
    if (!finalDate && daysAfterVisit) {
      finalDate = calculateFollowUpDate(visit.visitDate, parseInt(daysAfterVisit));
    } else if (finalDate && !daysAfterVisit) {
      const visitDate = new Date(visit.visitDate);
      const followDate = new Date(finalDate);
      days = Math.ceil((followDate - visitDate) / (1000 * 60 * 60 * 24));
    }

    const reminderDate = calculateReminderDate(finalDate);

    const followUp = await prisma.followUp.create({
      data: {
        patientId: parseInt(patientId),
        doctorId: parseInt(doctorId),
        visitId: parseInt(visitId),
        scheduledDate: finalDate,
        daysAfterVisit: parseInt(days) || 0,
        reason,
        notes,
        reminderDate
      },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    });

    res.status(201).json(followUp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث حالة العودة
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const data = { status };
    if (notes) data.notes = notes;
    if (status === 'completed') data.completedAt = new Date();

    const followUp = await prisma.followUp.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    });
    res.json(followUp);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// حذف موعد عودة
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.followUp.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'تم حذف موعد العودة' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
