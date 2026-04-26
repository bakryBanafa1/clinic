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

// إلغاء زيارة مع الربط المالي
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const { cancelReason } = req.body;

    // جلب الزيارة الحالية
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
        appointment: true
      }
    });

    if (!visit) return res.status(404).json({ error: 'الزيارة غير موجودة' });
    if (visit.status === 'cancelled') return res.status(400).json({ error: 'الزيارة ملغاة بالفعل' });

    const result = await prisma.$transaction(async (tx) => {
      let refundAmount = 0;

      // 1. تحديث حالة الزيارة
      await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: cancelReason || null
        }
      });

      // 2. تحديث الفاتورة المرتبطة بالزيارة
      const invoice = await tx.invoice.findUnique({
        where: { visitId }
      });

      if (invoice) {
        refundAmount = invoice.paidAmount || 0;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paymentStatus: refundAmount > 0 ? 'refunded' : 'cancelled',
            refundedAmount: refundAmount,
            paidAmount: 0,
            notes: `${invoice.notes || ''}\n[إلغاء زيارة] ${cancelReason || 'بدون سبب'} - تم استرجاع ${refundAmount}`.trim()
          }
        });
      }

      // 3. تحديث الفاتورة المرتبطة بالموعد (إن وجد)
      if (visit.appointmentId) {
        const appointmentInvoice = await tx.invoice.findUnique({
          where: { appointmentId: visit.appointmentId }
        });

        if (appointmentInvoice && !invoice) {
          // إذا لم يكن هناك فاتورة على الزيارة، نحدث فاتورة الموعد
          refundAmount = appointmentInvoice.paidAmount || 0;
          await tx.invoice.update({
            where: { id: appointmentInvoice.id },
            data: {
              paymentStatus: refundAmount > 0 ? 'refunded' : 'cancelled',
              refundedAmount: refundAmount,
              paidAmount: 0,
              notes: `${appointmentInvoice.notes || ''}\n[إلغاء زيارة] ${cancelReason || 'بدون سبب'} - تم استرجاع ${refundAmount}`.trim()
            }
          });
        }

        // 4. تحديث حالة الموعد المرتبط
        await tx.appointment.update({
          where: { id: visit.appointmentId },
          data: {
            status: 'cancelled',
            paidAmount: 0,
            paymentStatus: 'unpaid'
          }
        });

        // 5. إلغاء من الطابور إن وجد
        const queue = await tx.queueEntry.findUnique({
          where: { appointmentId: visit.appointmentId }
        });
        if (queue && queue.status !== 'completed') {
          await tx.queueEntry.update({
            where: { id: queue.id },
            data: { status: 'skipped' }
          });
        }
      }

      // 6. إلغاء موعد المراجعة المرتبط (إن وجد)
      const followUp = await tx.followUp.findUnique({
        where: { visitId }
      });
      if (followUp && followUp.status !== 'completed') {
        await tx.followUp.update({
          where: { id: followUp.id },
          data: { status: 'cancelled' }
        });
      }

      return { refundAmount };
    });

    const updatedVisit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: { select: { name: true, fileNumber: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
        prescription: true,
        followUp: true
      }
    });

    const msg = result.refundAmount > 0
      ? `تم إلغاء الزيارة بنجاح. يجب استرجاع مبلغ ${result.refundAmount} للمريض.`
      : 'تم إلغاء الزيارة بنجاح.';

    res.json({
      message: msg,
      refundAmount: result.refundAmount,
      visit: updatedVisit
    });
  } catch (err) {
    console.error('Error cancelling visit:', err);
    res.status(500).json({ error: err.message || 'خطأ في الخادم' });
  }
});

module.exports = router;
