const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { emitNotification } = require('../socket');
const { renderTemplate, sendWhatsAppMessage, calculateReminderDate, fetchWithTimeout, circuitBreaker, messageQueue } = require('../lib/utils');
const { format, addDays, parseISO } = require('date-fns');

function startCronJobs() {
  // ===== 1. تذكير مواعيد العودة/المراجعة - كل يوم الساعة 8 صباحاً =====
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ [CRON] Running follow-up reminder check...');
    try {
      const settings = await prisma.clinicSettings.findFirst();
      if (!settings) {
        console.log('ℹ️ [CRON] No settings found, skipping follow-up reminders');
        return;
      }
      if (!settings.followupReminderEnabled) {
        console.log('ℹ️ [CRON] Follow-up reminders disabled');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const reminderDays = settings.followupReminderDays || 1;
      const targetDate = format(addDays(new Date(), reminderDays), 'yyyy-MM-dd');

      console.log(`📅 [CRON] Looking for follow-ups on: ${targetDate}`);

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

      console.log(`📋 [CRON] Found ${upcomingFollowUps.length} follow-ups to remind`);

      for (const fu of upcomingFollowUps) {
        // إنشاء إشعار داخلي
        try {
          await prisma.notification.create({
            data: {
              title: 'تذكير موعد عودة',
              message: `المريض ${fu.patient.name} لديه موعد عودة بتاريخ ${fu.scheduledDate}`,
              type: 'followup',
              link: `/patients/${fu.patientId}`
            }
          });
        } catch (notifErr) {
          console.error(`⚠️ [CRON] Failed to create notification for: ${fu.patient.name}`);
        }

        // إرسال واتساب
        let whatsappResult = null;
        if (fu.patient.phone && settings.followupReminderTemplate) {
          const variables = {
            'اسم_المريض': fu.patient.name,
            'اسم_الطبيب': fu.doctor?.user?.name || '',
            'تاريخ_الموعد': fu.scheduledDate,
            'وقت_الموعد': '',
            'اسم_العيادة': settings.clinicName || 'العيادة',
            'رقم_الملف': fu.patient.fileNumber || ''
          };
          const message = renderTemplate(settings.followupReminderTemplate, variables);
          console.log(`📱 [CRON] Sending reminder to: ${fu.patient.phone}`);
          whatsappResult = await sendWhatsAppMessage(settings, fu.patient.phone, message);

          if (whatsappResult && whatsappResult.success) {
            await prisma.followUp.update({
              where: { id: fu.id },
              data: { status: 'reminded', notificationSent: true, whatsappSent: true, whatsappSentAt: new Date() }
            });
            console.log(`✅ [CRON] Reminder sent to: ${fu.patient.name} (${fu.patient.phone})`);
          } else if (whatsappResult && whatsappResult.queued) {
            await prisma.followUp.update({
              where: { id: fu.id },
              data: { status: 'reminded', notificationSent: true, whatsappSent: false }
            });
            console.log(`📥 [CRON] Reminder queued for: ${fu.patient.name}`);
          } else {
            await prisma.followUp.update({
              where: { id: fu.id },
              data: { status: 'reminded', notificationSent: true, whatsappSent: false }
            });
            console.log(`❌ [CRON] Reminder failed for: ${fu.patient.name} - ${whatsappResult?.error}`);
          }
        } else {
          await prisma.followUp.update({
            where: { id: fu.id },
            data: { status: 'reminded', notificationSent: true }
          });
          console.log(`⚠️ [CRON] No phone/template for: ${fu.patient.name}`);
        }
      }

      // تحديث المواعيد الفائتة
      const missedCount = await prisma.followUp.updateMany({
        where: {
          scheduledDate: { lt: today },
          status: { in: ['pending', 'reminded'] }
        },
        data: { status: 'missed' }
      });
      if (missedCount.count > 0) {
        console.log(`⚠️ [CRON] ${missedCount.count} follow-ups marked as missed`);
      }

    } catch (err) {
      console.error('❌ [CRON] Follow-up reminder error:', err.message);
    }
  });

  // ===== 2. تذكير المواعيد العادية - كل يوم الساعة 7 مساءً =====
  cron.schedule('0 19 * * *', async () => {
    console.log('⏰ [CRON] Running appointment reminder check...');
    try {
      const settings = await prisma.clinicSettings.findFirst();
      if (!settings || !settings.appointmentReminderEnabled) {
        console.log('ℹ️ [CRON] Appointment reminders disabled');
        return;
      }

      const reminderDays = settings.appointmentReminderDays || 1;
      const targetDate = format(addDays(new Date(), reminderDays), 'yyyy-MM-dd');

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

      console.log(`📋 [CRON] Found ${appointments.length} appointments to remind for ${targetDate}`);

      for (const appt of appointments) {
        if (!appt.patient.phone) {
          console.log(`⚠️ [CRON] No phone for appointment: ${appt.patient.name}`);
          continue;
        }
        if (!settings.appointmentReminderTemplate) {
          console.log(`⚠️ [CRON] No reminder template configured`);
          continue;
        }

        const variables = {
          'اسم_المريض': appt.patient.name,
          'اسم_الطبيب': appt.doctor?.user?.name || '',
          'تاريخ_الموعد': appt.date,
          'وقت_الموعد': appt.period === 'morning' ? 'الصباحية' : 'المسائية',
          'اسم_العيادة': settings.clinicName || 'العيادة',
          'رقم_الملف': appt.patient.fileNumber || ''
        };
        const message = renderTemplate(settings.appointmentReminderTemplate, variables);
        const result = await sendWhatsAppMessage(settings, appt.patient.phone, message);

        if (result && result.success) {
          console.log(`✅ [CRON] Appointment reminder sent to: ${appt.patient.name}`);
        } else if (result && result.queued) {
          console.log(`📥 [CRON] Appointment reminder queued for: ${appt.patient.name}`);
        } else {
          console.log(`❌ [CRON] Appointment reminder failed for: ${appt.patient.name} - ${result?.error}`);
        }
      }

    } catch (err) {
      console.error('❌ [CRON] Appointment reminder error:', err.message);
    }
  });

  // ===== 3. WhatsApp Connection Watchdog - كل 3 دقائق =====
  cron.schedule('*/3 * * * *', async () => {
    try {
      const settings = await prisma.clinicSettings.findFirst();
      if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
        return;
      }

      let evolutionUrl = settings.evolutionApiUrl;
      if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;
      evolutionUrl = evolutionUrl.replace(/\/$/, '');
      const { evolutionApiKey, evolutionInstanceName } = settings;

      // فحص circuit breaker
      const cbStatus = circuitBreaker.getStatus();
      if (!circuitBreaker.canProceed()) {
        const remaining = Math.ceil(cbStatus.remainingMs / 1000);
        if (remaining <= 30 || remaining >= 60) {
          console.log(`⏸️ [Watchdog] Circuit breaker: ${remaining}s remaining`);
        }
        return;
      }

      // فحص حالة الاتصال
      let stateRes;
      try {
        stateRes = await fetchWithTimeout(
          `${evolutionUrl}/instance/connectionState/${evolutionInstanceName}`,
          { headers: { 'apikey': evolutionApiKey } },
          12000
        );
      } catch (fetchErr) {
        circuitBreaker.recordFailure();
        console.warn(`⚠️ [Watchdog] Cannot reach Evolution API: ${fetchErr.name === 'AbortError' ? 'timeout' : fetchErr.message}`);
        return;
      }

      if (!stateRes.ok) {
        if (stateRes.status === 503) {
          circuitBreaker.recordFailure(true);
          console.warn(`⏳ [Watchdog] Evolution API busy (503)`);
        } else if (stateRes.status === 404) {
          console.warn(`⚠️ [Watchdog] Instance not found (404)`);
        } else {
          circuitBreaker.recordFailure();
          console.warn(`⚠️ [Watchdog] Unexpected response: HTTP ${stateRes.status}`);
        }
        return;
      }

      circuitBreaker.recordSuccess();

      let stateData;
      const stateText = await stateRes.text();
      try {
        stateData = stateText ? JSON.parse(stateText) : {};
      } catch (e) {
        stateData = { state: 'error' };
      }

      const state = stateData?.instance?.state || stateData?.state || 'unknown';

      if (state === 'open') {
        // الجلسة متصلة
        // إرسال presence
        fetchWithTimeout(
          `${evolutionUrl}/instance/setPresence/${evolutionInstanceName}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify({ presence: 'available' })
          },
          8000
        ).catch(() => {});

        // معالجة الطابور
        const qSize = messageQueue.getQueueSize();
        if (qSize > 0) {
          console.log(`📤 [Watchdog] Processing queue (${qSize} messages)...`);
          messageQueue._processQueue();
        }
        return;
      }

      // الجلسة غير متصلة — إعادة الربط
      console.log(`🔁 [Watchdog] Session state: [${state}]. Reconnecting...`);
      try {
        const connectRes = await fetchWithTimeout(
          `${evolutionUrl}/instance/connect/${evolutionInstanceName}`,
          { headers: { 'apikey': evolutionApiKey } },
          15000
        );

        if (connectRes.ok) {
          console.log(`✅ [Watchdog] Reconnect triggered for [${evolutionInstanceName}]`);
        } else {
          console.warn(`⚠️ [Watchdog] Reconnect failed (HTTP ${connectRes.status})`);
        }
      } catch (connErr) {
        console.warn(`⚠️ [Watchdog] Reconnect error: ${connErr.message}`);
      }

    } catch (err) {
      console.error('❌ [Watchdog] Error:', err.message);
    }
  });

  console.log('✅ [CRON] Jobs started');
}

module.exports = { startCronJobs };
