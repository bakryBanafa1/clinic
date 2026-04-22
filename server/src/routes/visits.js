const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// جلب كل الزيارات
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, date, appointmentId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (patientId) where.patientId = parseInt(patientId);
    if (doctorId) where.doctorId = parseInt(doctorId);
    if (date) where.visitDate = { gte: new Date(date + 'T00:00:00'), lte: new Date(date + 'T23:59:59') };
    if (appointmentId) where.appointmentId = parseInt(appointmentId);

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

// إنشاء زيارة مع إمكانية تحديد موعد المراجعة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId, chiefComplaint, diagnosis, examination, treatmentPlan, notes, vitalSigns, followUpDate, followUpReason } = req.body;
    if (!patientId || !doctorId) return res.status(400).json({ error: 'بيانات ناقصة' });

    // 检查是否已经存在与此预约关联的就诊记录
    if (appointmentId) {
      const existingVisit = await prisma.visit.findUnique({
        where: { appointmentId: parseInt(appointmentId) }
      });
      if (existingVisit) {
        return res.status(400).json({ error: 'يوجد تسجيل طبي مرتبط بهذا الموعد بالفعل', existingVisitId: existingVisit.id });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({
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
          patient: { select: { name: true, fileNumber: true, phone: true } },
          doctor: { include: { user: { select: { name: true } } } }
        }
      });

      // تحديث حالة الموعد إلى مكتمل
      if (appointmentId) {
        await tx.appointment.update({
          where: { id: parseInt(appointmentId) },
          data: { status: 'completed' }
        });
      }

      // إنشاء موعد مراجعة تلقائياً إذا حدد الطبيب تاريخ العودة
      let followUp = null;
      if (followUpDate) {
        const visitDate = new Date(visit.visitDate);
        const followDate = new Date(followUpDate);
        const daysAfter = Math.max(1, Math.ceil((followDate - visitDate) / (1000 * 60 * 60 * 24)));
        
        // حساب تاريخ التذكير (يوم قبل الموعد)
        const reminderDate = new Date(followDate);
        reminderDate.setDate(reminderDate.getDate() - 1);
        const reminderStr = reminderDate.toISOString().split('T')[0];

        followUp = await tx.followUp.create({
          data: {
            patientId: parseInt(patientId),
            doctorId: parseInt(doctorId),
            visitId: visit.id,
            scheduledDate: followUpDate,
            daysAfterVisit: daysAfter,
            reason: followUpReason || 'مراجعة بعد الزيارة',
            reminderDate: reminderStr,
            notes: `تم تحديد المراجعة من قبل الطبيب أثناء الزيارة`
          }
        });
      }

      return { visit, followUp };
    });

    res.status(201).json(result.visit);
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
