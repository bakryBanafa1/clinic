const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// جلب المواعيد مع فلاتر
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { date, doctorId, status, period, page = 1, limit = 50 } = req.query;
    const where = {};
    if (date) where.date = date;
    if (doctorId) where.doctorId = parseInt(doctorId);
    if (status) where.status = status;
    if (period) where.period = period;

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true, fileNumber: true, phone: true } },
          doctor: { include: { user: { select: { name: true } } } }
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.appointment.count({ where })
    ]);

    res.json({ appointments, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// التحقق من التوفر
router.get('/availability', authMiddleware, async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: 'يرجى تحديد الطبيب والتاريخ' });

    const dayOfWeek = new Date(date).getDay();
    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: parseInt(doctorId), dayOfWeek, isActive: true }
    });

    if (!schedule) return res.json({ available: false, message: 'الطبيب لا يعمل في هذا اليوم' });

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: parseInt(doctorId),
        date,
        status: { not: 'cancelled' }
      }
    });

    const morningCount = appointments.filter(a => a.period === 'morning').length;
    const eveningCount = appointments.filter(a => a.period === 'evening').length;

    res.json({
      available: true,
      schedule,
      morning: { booked: morningCount, capacity: schedule.morningCapacity, available: schedule.morningCapacity - morningCount },
      evening: { booked: eveningCount, capacity: schedule.eveningCapacity, available: schedule.eveningCapacity - eveningCount }
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إنشاء موعد
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, date, startTime, endTime, period, notes, paidAmount = 0 } = req.body;
    if (!patientId || !doctorId || !date) {
      return res.status(400).json({ error: 'يرجى تعبئة البيانات المطلوبة' });
    }

    const paidAmt = parseFloat(paidAmount) || 0;

    // التحقق من الطاقة الاستيعابية
    const dayOfWeek = new Date(date).getDay();
    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: parseInt(doctorId), dayOfWeek, isActive: true }
    });

    if (!schedule) return res.status(400).json({ error: 'الطبيب لا يعمل في هذا اليوم' });

    const existingAppts = await prisma.appointment.count({
      where: {
        doctorId: parseInt(doctorId),
        date,
        period: period || 'morning',
        status: { not: 'cancelled' }
      }
    });

    const capacity = (period || 'morning') === 'morning' ? schedule.morningCapacity : schedule.eveningCapacity;
    if (existingAppts >= capacity) {
      return res.status(400).json({ error: 'الفترة ممتلئة - لا يمكن الحجز' });
    }

    // التحقق من صلاحية الدفع
    const settings = await prisma.clinicSettings.findFirst() || {};
    const minPayment = settings.minPaymentAmount || 0;
    
    const doctorObj = await prisma.doctor.findUnique({ where: { id: parseInt(doctorId) } });
    if (!doctorObj) return res.status(404).json({ error: 'الطبيب غير موجود' });
    
    const totalAmount = doctorObj.consultationFee || 0;
    
    // منع الحجز إذا كان المبلغ أقل من الحد الأدنى المقبول
    const requiredMinimum = Math.min(minPayment, totalAmount);
    if (paidAmt < requiredMinimum && requiredMinimum > 0) {
      return res.status(400).json({ error: `يجب دفع مبلغ لا يقل عن ${requiredMinimum} لتأكيد الحجز` });
    }
    
    let paymentStatus = 'unpaid';
    let apptStatus = 'pending';
    
    if (paidAmt > 0) {
      if (paidAmt >= totalAmount) {
        paymentStatus = 'paid';
        apptStatus = 'checked_in'; // تم الدفع بالكامل: تسجيل وصول مباشر
      } else {
        paymentStatus = 'partial';
        apptStatus = 'confirmed'; // دفع جزئي: تأكيد مباشر وبانتظار الدفع المتبقي للدخول
      }
    }

    // هنا يتم استخدام Transaction لضمان إنشاء الموعد والفاتورة معاً
    const appointment = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          patientId: parseInt(patientId),
          doctorId: parseInt(doctorId),
          date,
          startTime,
          endTime,
          period: period || 'morning',
          notes,
          status: apptStatus,
          queueNumber: existingAppts + 1,
          totalAmount,
          paidAmount: paidAmt,
          paymentStatus
        },
        include: {
          patient: { select: { name: true, phone: true } },
          doctor: { include: { user: { select: { name: true } } } }
        }
      });

      // إنشاء فاتورة فورية 
      const invoiceNumber = 'INV-' + Date.now().toString().slice(-6) + '-' + appt.id;
      await tx.invoice.create({
        data: {
          invoiceNumber,
          patientId: parseInt(patientId),
          appointmentId: appt.id,
          date: new Date(),
          items: JSON.stringify([{ description: 'كشفية طبيب', quantity: 1, unitPrice: totalAmount, total: totalAmount }]),
          subtotal: totalAmount,
          tax: 0,
          total: totalAmount,
          paidAmount: paidAmt,
          paymentStatus: paymentStatus
        }
      });

      // إذا تم دفع المبلغ بالكامل عند الحجز، ندخله الطابور تلقائياً
      if (apptStatus === 'checked_in') {
        await tx.queueEntry.create({
          data: {
            appointmentId: appt.id,
            patientId: appt.patientId,
            doctorId: appt.doctorId,
            date: appt.date,
            queueNumber: appt.queueNumber || 999
          }
        });
      }

      return appt;
    });

    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث حالة موعد
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, notes, startTime, endTime, date, period } = req.body;
    const appointment = await prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data: { status, notes, startTime, endTime, date, period },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إكمال دفع موعد (تسديد متبقي) وتسويته في الفاتورة
router.put('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const { amountToPay } = req.body;
    const amount = parseFloat(amountToPay);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'مبلغ الدفع غير صالح' });

    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { invoice: true }
    });

    if (!appointment) return res.status(404).json({ error: 'الموعد غير موجود' });

    const newPaidAmount = appointment.paidAmount + amount;
    const newStatus = newPaidAmount >= appointment.totalAmount ? 'paid' : 'partial';
    
    // إذا اكتمل الدفع، يتم تحويل الحالة تلقائياً لتسجيل الدخول للطابور
    let newApptStatus = appointment.status;
    if (newStatus === 'paid') {
      newApptStatus = 'checked_in';
    }

    const updatedAppt = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.update({
        where: { id: appointment.id },
        data: { paidAmount: newPaidAmount, paymentStatus: newStatus, status: newApptStatus },
        include: { patient: { select: { name: true } }, doctor: { include: { user: { select: { name: true } } } } }
      });

      if (appointment.invoice) {
        await tx.invoice.update({
          where: { id: appointment.invoice.id },
          data: { paidAmount: newPaidAmount, paymentStatus: newStatus }
        });
      }
      
      // الدخول للطابور التلقائي
      if (newApptStatus === 'checked_in') {
         const existingQueue = await tx.queueEntry.findUnique({ where: { appointmentId: appt.id } });
         if (!existingQueue) {
            await tx.queueEntry.create({
              data: {
                appointmentId: appt.id,
                patientId: appt.patientId,
                doctorId: appt.doctorId,
                date: appt.date,
                queueNumber: appt.queueNumber || 999
              }
            });
         }
      }

      return appt;
    });

    res.json(updatedAppt);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// حذف موعد واسترجاع الفاتورة
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    await prisma.$transaction(async (tx) => {
      // 1. إلغاء الموعد
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'cancelled' }
      });

      // 2. إلغاء الفاتورة المرتبطة بالموعد لكي لا تحتسب في التقارير كإيرادات
      const invoice = await tx.invoice.findUnique({ where: { appointmentId } });
      if (invoice && invoice.paymentStatus !== 'cancelled') {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paymentStatus: 'cancelled' } 
          // نحتفظ بـ paidAmount لكي نعلم كم المبلغ الذي تم رده للمريض (استرجاع)
        });
      }

      // 3. إلغاء دخوله من طابور الطبيب إن كان قد دخل بالفعل
      const queue = await tx.queueEntry.findUnique({ where: { appointmentId } });
      if (queue && queue.status !== 'completed') {
        await tx.queueEntry.update({
          where: { id: queue.id },
          data: { status: 'skipped' }
        });
      }
    });

    res.json({ message: 'تم إلغاء الموعد بنجاح وتحديث السجلات المالية' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
