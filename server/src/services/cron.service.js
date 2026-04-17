const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { emitNotification } = require('../socket');
const { renderTemplate, sendWhatsAppMessage, calculateReminderDate } = require('../lib/utils');
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

  // ===== 4. WhatsApp Connection Watchdog - كل 6 دقائق =====
  // يقوم بالتأكد من أن اتصال الواتساب نشط دائماً ويعيد الربط تلقائياً إذا انفصل
  cron.schedule('*/6 * * * *', async () => {
    console.log('📡 Running WhatsApp Watchdog check...');
    try {
      const settings = await prisma.clinicSettings.findFirst();
      if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
        console.log('ℹ️ WhatsApp Watchdog: No configuration found, skipping.');
        return;
      }

      let evolutionUrl = settings.evolutionApiUrl;
      if (!evolutionUrl.startsWith('http')) evolutionUrl = 'https://' + evolutionUrl;
      const { evolutionApiKey, evolutionInstanceName } = settings;

      // 1. فحص حالة الاتصال الحالية
      const stateRes = await fetch(`${evolutionUrl}/instance/connectionState/${evolutionInstanceName}`, {
        headers: { 'apikey': evolutionApiKey }
      });

      let stateData;
      const stateText = await stateRes.text();
      try {
        stateData = stateText ? JSON.parse(stateText) : {};
      } catch (e) {
        stateData = { state: 'error', message: stateText };
      }

      if (!stateRes.ok) {
        if (stateRes.status === 503) {
          console.warn(`⏳ Watchdog: Evolution Server Busy (503). Skipping this check...`);
          return;
        }
        console.warn(`⚠️ Watchdog: Unexpected State Response (HTTP ${stateRes.status}).`);
      } else {
        const state = stateData?.instance?.state || stateData?.state;

        console.log(`📡 Watchdog: Current WhatsApp state is [${state}]`);

        if (state === 'open') {
          // الجلسة متصلة - نقوم بتنشيط الإعدادات الاستباقية وإرسال "Available" لإبقاء الجلسة حية وحقيقية
          await fetch(`${evolutionUrl}/settings/set/${evolutionInstanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify({
              alwaysOnline: true,
              readMessages: true,
              readStatus: true
            })
          });

          // إرسال تواجد (Presence) لإيهام السيرفر بالنشاط البشري المستمر
          await fetch(`${evolutionUrl}/instance/setPresence/${evolutionInstanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify({ presence: 'available' })
          });

          return;
        }
      }

      // 2. إذا لم تكن الحالة OPEN أو إذا فشل الطلب السابق -> نحاول إعادة الربط
      console.log(`🔁 Watchdog: Triggering auto-reconnect for [${evolutionInstanceName}]...`);
      const connectRes = await fetch(`${evolutionUrl}/instance/connect/${evolutionInstanceName}`, {
        headers: { 'apikey': evolutionApiKey }
      });

      const connectData = await connectRes.json();
      console.log(`✅ Watchdog Result: ${JSON.stringify(connectData).substring(0, 100)}`);

    } catch (err) {
      console.error('❌ WhatsApp Watchdog error:', err.message);
    }
  });

  console.log('✅ Cron jobs started (follow-up reminders, appointment reminders, WhatsApp Watchdog)');
}

module.exports = { startCronJobs };
