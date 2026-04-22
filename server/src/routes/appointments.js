const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { renderTemplate, sendWhatsAppMessage } = require('../lib/utils');
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
    const { patientId, doctorId, date, startTime, endTime, period, appointmentType = 'examination', notes, paidAmount = 0 } = req.body;
    if (!patientId || !doctorId || !date) {
      return res.status(400).json({ error: 'يرجى تعبئة البيانات المطلوبة' });
    }

    const paidAmt = parseFloat(paidAmount) || 0;

    // البحث التلقائي عن أقرب يوم متاح (الترحيل التلقائي)
    let finalDate = new Date(date);
    let isAvailable = false;
    let actualSchedule = null;
    let attempts = 0;
    const maxAttempts = 30; // الحد الأقصى للبحث (30 يوم)
    let finalExistingAppts = 0;
    
    while (!isAvailable && attempts < maxAttempts) {
      const dayOfWeek = finalDate.getDay();
      actualSchedule = await prisma.doctorSchedule.findFirst({
        where: { doctorId: parseInt(doctorId), dayOfWeek, isActive: true }
      });

      if (actualSchedule) {
        const existingAppts = await prisma.appointment.count({
          where: {
            doctorId: parseInt(doctorId),
            date: finalDate.toISOString().split('T')[0],
            period: period || 'morning',
            status: { not: 'cancelled' }
          }
        });

        const capacity = (period || 'morning') === 'morning' ? actualSchedule.morningCapacity : actualSchedule.eveningCapacity;
        if (capacity > 0 && existingAppts < capacity) {
          isAvailable = true;
          finalExistingAppts = existingAppts;
          break;
        }
      }
      // الانتقال لليوم التالي
      finalDate.setDate(finalDate.getDate() + 1);
      attempts++;
    }

    if (!isAvailable) {
      return res.status(400).json({ error: 'عذراً، لا توجد مواعيد متاحة خلال الـ 30 يوماً القادمة.' });
    }

    const assignedDate = finalDate.toISOString().split('T')[0];

    // التحقق من صلاحية الدفع
    const settings = await prisma.clinicSettings.findFirst() || {};
    const minPayment = settings.minPaymentAmount || 0;
    
    const doctorObj = await prisma.doctor.findUnique({ where: { id: parseInt(doctorId) } });
    if (!doctorObj) return res.status(404).json({ error: 'الطبيب غير موجود' });
    
    const totalAmount = appointmentType === 'followup' ? 0 : (doctorObj.consultationFee || 0);
    
    // منع الحجز إذا كان المبلغ أقل من الحد الأدنى المقبول
    const requiredMinimum = Math.min(minPayment, totalAmount);
    if (paidAmt < requiredMinimum && requiredMinimum > 0) {
      return res.status(400).json({ error: `يجب دفع مبلغ لا يقل عن ${requiredMinimum} لتأكيد الحجز` });
    }
    
    let paymentStatus = 'unpaid';
    let apptStatus = 'pending';
    
    if (totalAmount === 0) {
      paymentStatus = 'paid';
      apptStatus = 'checked_in';
    } else if (paidAmt > 0) {
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
          date: assignedDate,
          startTime,
          endTime,
          period: period || 'morning',
          appointmentType: appointmentType || 'examination',
          notes,
          status: apptStatus,
          queueNumber: finalExistingAppts + 1,
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
          items: JSON.stringify([{ description: appointmentType === 'followup' ? 'رسوم مراجعة' : 'كشفية طبيب', quantity: 1, unitPrice: totalAmount, total: totalAmount }]),
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
            queueNumber: appt.queueNumber || 999,
            appointmentType: appt.appointmentType || 'examination'
          }
        });
      }

      return appt;
    });

    // جلب clinicSettings مرة واحدة للاستخدام
    const clinicSettings = await prisma.clinicSettings.findFirst();

    // إرسال إشعار واتساب تلقائي عند الحجز (في الخلفية - لا يؤثر على الحجز)
    if (clinicSettings?.bookingConfirmEnabled && appointment.patient?.phone && clinicSettings?.bookingConfirmTemplate) {
      const variables = {
        'اسم_المريض': appointment.patient.name,
        'اسم_الطبيب': appointment.doctor?.user?.name || '',
        'تاريخ_الموعد': appointment.date,
        'وقت_الموعد': appointment.period === 'morning' ? 'الصباحية' : 'المسائية',
        'اسم_العيادة': clinicSettings.clinicName || 'العيادة',
        'رقم_الملف': ''
      };
      const patientInfo = await prisma.patient.findUnique({ where: { id: appointment.patientId }, select: { fileNumber: true } });
      variables['رقم_الملف'] = patientInfo?.fileNumber || '';
      const msg = renderTemplate(clinicSettings.bookingConfirmTemplate, variables);
      if (msg) {
        sendWhatsAppMessage(clinicSettings, appointment.patient.phone, msg)
          .then(result => {
            if (result && result.success) {
              console.log(`✅ [Booking] WhatsApp sent to: ${appointment.patient.phone}`);
            } else if (result && result.queued) {
              console.log(`📥 [Booking] WhatsApp queued for: ${appointment.patient.phone}`);
            } else {
              console.log(`❌ [Booking] WhatsApp failed: ${result?.error}`);
            }
          })
          .catch(e => console.error('❌ [Booking] WhatsApp error:', e.message));
      }
    }

    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث بيانات موعد (كامل)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, notes, startTime, endTime, date, period, doctorId, appointmentType } = req.body;
    const appointmentId = parseInt(req.params.id);

    const oldAppt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!oldAppt) return res.status(404).json({ error: 'الموعد غير موجود' });

    const newDoctorId  = doctorId  ? parseInt(doctorId)  : oldAppt.doctorId;
    const newDate      = date      || oldAppt.date;
    const newPeriod    = period    || oldAppt.period;

    // إذا تغيّر الطبيب أو التاريخ أو الفترة نتحقق من الطاقة الاستيعابية
    const doctorChanged = newDoctorId !== oldAppt.doctorId;
    const dateChanged   = newDate !== oldAppt.date;
    const periodChanged = newPeriod !== oldAppt.period;

    if ((doctorChanged || dateChanged || periodChanged) && status !== 'cancelled') {
      const dayOfWeek = new Date(newDate).getDay();
      const schedule = await prisma.doctorSchedule.findFirst({
        where: { doctorId: newDoctorId, dayOfWeek, isActive: true }
      });
      if (!schedule) return res.status(400).json({ error: 'الطبيب لا يعمل في هذا اليوم' });

      const existingCount = await prisma.appointment.count({
        where: {
          doctorId: newDoctorId,
          date: newDate,
          period: newPeriod,
          status: { not: 'cancelled' },
          id: { not: appointmentId } // استثناء الموعد الحالي من الحساب
        }
      });
      const capacity = newPeriod === 'morning' ? schedule.morningCapacity : schedule.eveningCapacity;
      if (existingCount >= capacity) {
        return res.status(400).json({ error: 'الفترة ممتلئة - لا يمكن نقل الموعد لهنا' });
      }
    }

    // إذا تغيّر الطبيب نحدث رسوم الكشفية
    let newTotalAmount = oldAppt.totalAmount;
    const newApptType = appointmentType || oldAppt.appointmentType;
    if (newApptType === 'followup') {
      newTotalAmount = 0;
    } else if (doctorChanged || oldAppt.appointmentType === 'followup') {
      const newDoctor = await prisma.doctor.findUnique({ where: { id: newDoctorId } });
      if (newDoctor) newTotalAmount = newDoctor.consultationFee || 0;
    }

    let updateData = {
      notes,
      startTime,
      endTime,
      date: newDate,
      period: newPeriod,
      doctorId: newDoctorId,
      totalAmount: newTotalAmount,
      ...(appointmentType ? { appointmentType } : {}),
      ...(status         ? { status }         : {})
    };

    let refundAmount = 0;
    // إذا تغيرت الحالة إلى ملغي، نصفّر الحالة المالية
    if (status === 'cancelled' && oldAppt.status !== 'cancelled') {
      refundAmount = oldAppt.paidAmount || 0;
      updateData.paidAmount = 0;
      updateData.paymentStatus = 'unpaid';
    }

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    });

    // تحديث الفاتورة في حال تغير المبلغ (تغير الطبيب) أو الإلغاء
    const invoice = await prisma.invoice.findUnique({ where: { appointmentId } });
    if (invoice) {
        if (status === 'cancelled' && oldAppt.status !== 'cancelled') {
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    paymentStatus: refundAmount > 0 ? 'refunded' : 'cancelled',
                    refundedAmount: refundAmount,
                    paidAmount: 0
                }
            });
        } else if (doctorChanged || appointmentType) {
            // تحديث مبلغ الفاتورة وتفاصيلها إذا تغير الطبيب أو نوع الحجز
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    total: newTotalAmount,
                    subtotal: newTotalAmount,
                    items: JSON.stringify([{ description: newApptType === 'followup' ? 'رسوم مراجعة' : 'كشفية طبيب', quantity: 1, unitPrice: newTotalAmount, total: newTotalAmount }])
                }
            });
        }
    }

    // معالجة تحديثات الدور بناءً على الحالة الجديدة
    if (status) {
      const existingQueue = await prisma.queueEntry.findUnique({ where: { appointmentId } });
      
      if (status === 'checked_in') {
        if (!existingQueue) {
          // إضافة المريض للدور إذا لم يكن مسجلا
          await prisma.queueEntry.create({
            data: {
              appointmentId: appointment.id,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              date: appointment.date,
              queueNumber: appointment.queueNumber || 999,
              appointmentType: appointment.appointmentType || 'examination',
              status: 'waiting'
            }
          });
        } else if (existingQueue.status !== 'waiting' && existingQueue.status !== 'in_progress') {
          // إعادة تفعيله في الدور
          await prisma.queueEntry.update({
            where: { id: existingQueue.id },
            data: { status: 'waiting' }
          });
        }
      } else if (status === 'cancelled' || status === 'completed') {
        if (existingQueue && existingQueue.status !== 'completed' && existingQueue.status !== 'skipped') {
          const qStatus = status === 'cancelled' ? 'skipped' : 'completed';
          await prisma.queueEntry.update({
            where: { id: existingQueue.id },
            data: { status: qStatus }
          });
        }
      }
    }

    // إرسال إشعار واتساب عند إلغاء الموعد (في الخلفية)
    if (status === 'cancelled' && oldAppt.status !== 'cancelled') {
      try {
        const clinicSettings = await prisma.clinicSettings.findFirst();
        if (clinicSettings && clinicSettings.bookingCancelEnabled && appointment.patient?.phone) {
          const variables = {
            'اسم_المريض': appointment.patient.name,
            'اسم_الطبيب': appointment.doctor?.user?.name || '',
            'تاريخ_الموعد': appointment.date,
            'وقت_الموعد': appointment.period === 'morning' ? 'الصباحية' : 'المسائية',
            'اسم_العيادة': clinicSettings.clinicName || 'العيادة',
            'رقم_الملف': ''
          };
          const patientInfo = await prisma.patient.findUnique({ where: { id: appointment.patientId }, select: { fileNumber: true } });
          variables['رقم_الملف'] = patientInfo?.fileNumber || '';
          const msg = renderTemplate(clinicSettings.bookingCancelTemplate, variables);
          sendWhatsAppMessage(clinicSettings, appointment.patient.phone, msg).catch(e => console.error('WhatsApp cancel notify error:', e));
        }
      } catch (whatsappErr) {
        console.error('WhatsApp cancel notification error (non-blocking):', whatsappErr);
      }
    }

    // إرسال رسالة شكر بعد الزيارة عند إكمال الموعد
    if (status === 'completed' && oldAppt.status !== 'completed') {
      try {
        const clinicSettings = await prisma.clinicSettings.findFirst();
        if (clinicSettings && clinicSettings.postVisitEnabled && appointment.patient?.phone) {
          const variables = {
            'اسم_المريض': appointment.patient.name,
            'اسم_الطبيب': appointment.doctor?.user?.name || '',
            'تاريخ_الموعد': appointment.date,
            'وقت_الموعد': '',
            'اسم_العيادة': clinicSettings.clinicName || 'العيادة',
            'رقم_الملف': ''
          };
          const patientInfo = await prisma.patient.findUnique({ where: { id: appointment.patientId }, select: { fileNumber: true } });
          variables['رقم_الملف'] = patientInfo?.fileNumber || '';
          const msg = renderTemplate(clinicSettings.postVisitTemplate, variables);
          sendWhatsAppMessage(clinicSettings, appointment.patient.phone, msg).catch(e => console.error('WhatsApp post-visit notify error:', e));
        }
      } catch (whatsappErr) {
        console.error('WhatsApp post-visit notification error (non-blocking):', whatsappErr);
      }
    }

    res.json(appointment);
  } catch (err) {
    console.error(err);
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
            // جلب نوع الحجز من الموعد الأصلي
            const fullAppt = await tx.appointment.findUnique({ where: { id: appt.id } });
            await tx.queueEntry.create({
              data: {
                appointmentId: appt.id,
                patientId: appt.patientId,
                doctorId: appt.doctorId,
                date: appt.date,
                queueNumber: appt.queueNumber || 999,
                appointmentType: fullAppt?.appointmentType || 'examination'
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

// حذف موعد واسترجاع الفاتورة مع تسجيل المبلغ المرجع
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. جلب الموعد لمعرفة المبلغ المدفوع
      const appointment = await tx.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment) throw new Error('الموعد غير موجود');

      const refundAmount = appointment.paidAmount || 0;

      // 2. إلغاء الموعد + تصفير المبلغ المدفوع
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'cancelled', paidAmount: 0, paymentStatus: 'unpaid' }
      });

      // 3. تحديث الفاتورة: تسجيل المبلغ المرجع وتصفير المدفوع
      const invoice = await tx.invoice.findUnique({ where: { appointmentId } });
      if (invoice && invoice.paymentStatus !== 'refunded') {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { 
            paymentStatus: refundAmount > 0 ? 'refunded' : 'cancelled',
            refundedAmount: refundAmount,
            paidAmount: 0
          }
        });
      }

      // 4. إلغاء دخوله من طابور الطبيب إن كان قد دخل بالفعل
      const queue = await tx.queueEntry.findUnique({ where: { appointmentId } });
      if (queue && queue.status !== 'completed') {
        await tx.queueEntry.update({
          where: { id: queue.id },
          data: { status: 'skipped' }
        });
      }

      return { refundAmount };
    });

    const msg = result.refundAmount > 0 
      ? `تم إلغاء الموعد بنجاح. يجب استرجاع مبلغ ${result.refundAmount} للمريض.`
      : 'تم إلغاء الموعد بنجاح.';

    res.json({ message: msg, refundAmount: result.refundAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'خطأ في الخادم' });
  }
});

module.exports = router;
