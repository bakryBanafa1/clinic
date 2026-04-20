const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// دالة ترتيب الدور بالتبادل بين المعاينات والمراجعات
function interleaveQueue(waitingEntries, examRatio, followupRatio) {
  const examinations = waitingEntries.filter(e => e.appointmentType === 'examination');
  const followups = waitingEntries.filter(e => e.appointmentType === 'followup');
  
  const result = [];
  let examIdx = 0;
  let followupIdx = 0;
  
  while (examIdx < examinations.length || followupIdx < followups.length) {
    // أضف المعاينات حسب النسبة
    for (let i = 0; i < examRatio && examIdx < examinations.length; i++) {
      result.push(examinations[examIdx++]);
    }
    // أضف المراجعات حسب النسبة
    for (let i = 0; i < followupRatio && followupIdx < followups.length; i++) {
      result.push(followups[followupIdx++]);
    }
  }
  
  return result;
}

// جلب الدور لتاريخ معين مع ترتيب ذكي
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
        appointment: { select: { period: true, startTime: true, appointmentType: true } }
      },
      orderBy: { queueNumber: 'asc' }
    });

    // جلب إعدادات الترتيب
    const settings = await prisma.clinicSettings.findFirst();
    const examRatio = settings?.queueExaminationRatio || 1;
    const followupRatio = settings?.queueFollowupRatio || 1;

    // فصل المنتظرين عن البقية
    const waiting = queue.filter(q => q.status === 'waiting');
    const others = queue.filter(q => q.status !== 'waiting');

    // ترتيب المنتظرين بالتبادل
    const sortedWaiting = interleaveQueue(waiting, examRatio, followupRatio);

    // تحديث أرقام الدور لتكون تسلسلية للمنتظرين لتعكس ترتيب الدخول الفعلي
    let highestInProgress = Math.max(0, ...others.map(o => o.queueNumber || 0));
    const numberedWaiting = sortedWaiting.map((q, idx) => ({ ...q, displayQueueNumber: highestInProgress + idx + 1 }));

    // دمج الترتيب: المنتظرون المرتبون + البقية (in_progress, completed, skipped)
    const finalQueue = [...numberedWaiting, ...others];

    res.json(finalQueue);
  } catch (err) {
    console.error(err);
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
        queueNumber: appointment.queueNumber || 999,
        appointmentType: appointment.appointmentType || 'examination'
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
    const existingEntry = await prisma.queueEntry.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'غير موجود' });
    }

    let visit = await prisma.visit.findUnique({
      where: { appointmentId: existingEntry.appointmentId }
    });

    if (!visit) {
      visit = await prisma.visit.create({
        data: {
          patientId: existingEntry.patientId,
          doctorId: existingEntry.doctorId,
          appointmentId: existingEntry.appointmentId,
          visitDate: new Date(),
          chiefComplaint: 'مراجعة عامة',
          diagnosis: '',
          examination: '',
          treatmentPlan: '',
          notes: 'تم إنهاء الزيارة عبر إدارة الدور بدون إدخال تفاصيل إضافية.'
        }
      });
    }

    const entry = await prisma.queueEntry.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'completed', completedAt: new Date() }
    });

    await prisma.appointment.update({
      where: { id: existingEntry.appointmentId },
      data: { status: 'completed' }
    });

    res.json(entry);
  } catch (err) {
    console.error(err);
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
