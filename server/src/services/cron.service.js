const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { emitNotification } = require('../socket');
const { renderTemplate, sendWhatsAppMessage, calculateReminderDate, fetchWithTimeout, circuitBreaker, messageQueue } = require('../lib/utils');
const { format, addDays, parseISO } = require('date-fns');

function startCronJobs() {
  // ===== 1. تذكير مواعيد العودة/المراجعة - كل يوم الساعة 8 صباحاً =====
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running follow-up reminder check...');
    try {
      const settings = await prisma.clinicSettings.findFirst();
      if (!settings) return;

      const today = new Date().toISOString().split('T')[0];
      const reminderDays = settings.followupReminderDays || 1;

      // حساب تاريخ الموعد المستهدف (بعد X يوم من اليوم)
      const targetDate = format(addDays(new Date(), reminderDays), 'yyyy-MM-dd');

      // جلب مواعيد العودة المستحقة
      const upcomingFollowUps = await prisma.followUp.findMany({
        where: {
          scheduledDate: targetDate,
          status: 'pending',
          notificationSent: false
        },
        include: {
          patient: { select: { name: true, phone: true, fileNumber: true } },
          doctor: { include: { user: { select: { name: true } } } }
        }
      });

      for (const fu of upcomingFollowUps) {
        // إنشاء إشعار داخلي
        const notification = await prisma.notification.create({
          data: {
            title: 'تذكير موعد عودة',
            message: `المريض ${fu.patient.name} لديه موعد عودة بتاريخ ${fu.scheduledDate}`,
            type: 'followup',
            link: `/patients/${fu.patientId}`
          }
        });

        // إرسال واتساب إذا مفعّل
        if (settings.followupReminderEnabled && fu.patient.phone && settings.followupReminderTemplate) {
          const variables = {
            'اسم_المريض': fu.patient.name,
            'اسم_الطبيب': fu.doctor?.user?.name || '',
            'تاريخ_الموعد': fu.scheduledDate,
            'وقت_الموعد': '',
            'اسم_العيادة': settings.clinicName || 'العيادة',
            'رقم_الملف': fu.patient.fileNumber || ''
          };
          const message = renderTemplate(settings.followupReminderTemplate, variables);
          await sendWhatsAppMessage(settings, fu.patient.phone, message);

          await prisma.followUp.update({
            where: { id: fu.id },
            data: { status: 'reminded', notificationSent: true, whatsappSent: true, whatsappSentAt: new Date() }
          });
        } else {
          await prisma.followUp.update({
            where: { id: fu.id },
            data: { status: 'reminded', notificationSent: true }
          });
        }

        console.log(`📤 Reminder sent for patient: ${fu.patient.name}`);
      }

      // تحديث المواعيد الفائتة
      await prisma.followUp.updateMany({
        where: {
          scheduledDate: { lt: today },
          status: { in: ['pending', 'reminded'] }
        },
        data: { status: 'missed' }
      });

    } catch (err) {
      console.error('Follow-up cron job error:', err);
    }
  });

  // ===== 2. تذكير المواعيد العادية - كل يوم الساعة 7 مساءً =====
  cron.schedule('0 19 * * *', async () => {
    console.log('⏰ Running appointment reminder check...');
    try {
      const settings = await prisma.clinicSettings.findFirst();
      if (!settings || !settings.appointmentReminderEnabled) return;

      const reminderDays = settings.appointmentReminderDays || 1;
      const targetDate = format(addDays(new Date(), reminderDays), 'yyyy-MM-dd');

      // جلب المواعيد القادمة (غير الملغية)
      const appointments = await prisma.appointment.findMany({
        where: {
          date: targetDate,
          status: { in: ['pending', 'confirmed'] }
        },
        include: {
          patient: { select: { name: true, phone: true, fileNumber: true } },
          doctor: { include: { user: { select: { name: true } } } }
        }
      });

      for (const appt of appointments) {
        if (appt.patient.phone && settings.appointmentReminderTemplate) {
          const variables = {
            'اسم_المريض': appt.patient.name,
            'اسم_الطبيب': appt.doctor?.user?.name || '',
            'تاريخ_الموعد': appt.date,
            'وقت_الموعد': appt.period === 'morning' ? 'الصباحية' : 'المسائية',
            'اسم_العيادة': settings.clinicName || 'العيادة',
            'رقم_الملف': appt.patient.fileNumber || ''
          };
          const message = renderTemplate(settings.appointmentReminderTemplate, variables);
          await sendWhatsAppMessage(settings, appt.patient.phone, message);
          console.log(`📅 Appointment reminder sent to: ${appt.patient.name}`);
        }
      }

    } catch (err) {
      console.error('Appointment reminder cron job error:', err);
    }
  });

  // ===== 3. WhatsApp Connection Watchdog - كل 3 دقائق =====
  // يتحقق من حالة الاتصال ويعيد الربط تلقائياً مع Circuit Breaker
  let watchdogConsecutiveFailures = 0;

  cron.schedule('*/3 * * * *', async () => {
    try {
      const settings = await prisma.clinicSettings.findFirst();
      if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
        return; // لا تسجيلات إذا لم تكتمل الإعدادات
      }

      let evolutionUrl = settings.evolutionApiUrl;
      if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;
      evolutionUrl = evolutionUrl.replace(/\/$/, '');
      const { evolutionApiKey, evolutionInstanceName } = settings;

      // تحقق من circuit breaker — إذا كان مفتوحاً، تخطى بهدوء
      if (!circuitBreaker.canProceed()) {
        const status = circuitBreaker.getStatus();
        const remainMs = circuitBreaker.resetTimeout - status.timeSinceLastFailure;
        if (remainMs > 0) {
          // لا نطبع شيء كل 3 دقائق — فقط كل دورة ثالثة (9 دقائق)
          if (watchdogConsecutiveFailures % 3 === 0) {
            console.log(`⏸️ Watchdog: Circuit breaker open. Next retry in ~${Math.ceil(remainMs/1000)}s`);
          }
          return;
        }
      }

      // 1. فحص حالة الاتصال الحالية
      let stateRes;
      try {
        stateRes = await fetchWithTimeout(
          `${evolutionUrl}/instance/connectionState/${evolutionInstanceName}`,
          { headers: { 'apikey': evolutionApiKey } },
          12000
        );
      } catch (fetchErr) {
        watchdogConsecutiveFailures++;
        circuitBreaker.recordFailure();
        if (watchdogConsecutiveFailures <= 1 || watchdogConsecutiveFailures % 5 === 0) {
          console.warn(`⚠️ Watchdog: Cannot reach Evolution API (${fetchErr.name === 'AbortError' ? 'timeout' : fetchErr.message}). Failures: ${watchdogConsecutiveFailures}`);
        }
        return;
      }

      let stateData;
      const stateText = await stateRes.text();
      try {
        stateData = stateText ? JSON.parse(stateText) : {};
      } catch (e) {
        stateData = { state: 'error', message: stateText };
      }

      if (!stateRes.ok) {
        watchdogConsecutiveFailures++;
        if (stateRes.status === 503) {
          circuitBreaker.recordFailure();
          if (watchdogConsecutiveFailures <= 1 || watchdogConsecutiveFailures % 5 === 0) {
            console.warn(`⏳ Watchdog: Evolution Server Busy (503). Circuit breaker failures: ${circuitBreaker.failures}`);
          }
          return;
        }
        if (stateRes.status === 404) {
          console.warn('⚠️ Watchdog: Instance not found (404). Needs manual setup.');
          return;
        }
        console.warn(`⚠️ Watchdog: Unexpected response (HTTP ${stateRes.status}).`);
        return;
      }

      // نجح الطلب — إعادة العدادات
      circuitBreaker.recordSuccess();
      watchdogConsecutiveFailures = 0;

      const state = stateData?.instance?.state || stateData?.state;
      console.log(`📡 Watchdog: WhatsApp state is [${state}]`);

      if (state === 'open') {
        // الجلسة متصلة — نرسل presence فقط (بدون ضغط إضافي على settings)
        try {
          await fetchWithTimeout(
            `${evolutionUrl}/instance/setPresence/${evolutionInstanceName}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
              body: JSON.stringify({ presence: 'available' })
            },
            8000
          );
        } catch (presErr) {
          // لا نعتبره فشلاً حرجاً
        }

        // معالجة الرسائل المنتظرة في الطابور
        if (messageQueue.getQueueSize() > 0) {
          console.log(`📤 Watchdog: ${messageQueue.getQueueSize()} queued messages found. Processing...`);
          messageQueue._processQueue();
        }

        return;
      }

      // 2. إذا لم تكن الحالة OPEN → نحاول إعادة الربط
      console.log(`🔁 Watchdog: Triggering auto-reconnect for [${evolutionInstanceName}]...`);
      try {
        const connectRes = await fetchWithTimeout(
          `${evolutionUrl}/instance/connect/${evolutionInstanceName}`,
          { headers: { 'apikey': evolutionApiKey } },
          15000
        );

        let connectData;
        const connectText = await connectRes.text();
        try {
          connectData = connectText ? JSON.parse(connectText) : {};
        } catch (e) {
          connectData = { message: connectText };
        }

        if (connectRes.ok) {
          console.log(`✅ Watchdog: Reconnect triggered. Response: ${JSON.stringify(connectData).substring(0, 100)}`);
        } else {
          console.warn(`⚠️ Watchdog: Reconnect failed (HTTP ${connectRes.status})`);
        }
      } catch (connErr) {
        console.warn(`⚠️ Watchdog: Reconnect request failed: ${connErr.message}`);
      }

    } catch (err) {
      console.error('❌ WhatsApp Watchdog error:', err.message);
    }
  });

  console.log('✅ Cron jobs started (follow-up reminders, appointment reminders, WhatsApp Watchdog)');
}

module.exports = { startCronJobs };
