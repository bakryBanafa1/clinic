const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { emitNotification } = require('../socket');

function startCronJobs() {
  // فحص مواعيد العودة كل يوم الساعة 8 صباحاً
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running follow-up reminder check...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // جلب مواعيد العودة ليوم غد (لإرسال تذكير)
      const upcomingFollowUps = await prisma.followUp.findMany({
        where: {
          scheduledDate: tomorrow,
          status: 'pending',
          notificationSent: false
        },
        include: {
          patient: { select: { name: true, phone: true } },
          doctor: { include: { user: { select: { name: true } } } }
        }
      });

      for (const fu of upcomingFollowUps) {
        // إنشاء إشعار داخلي
        const notification = await prisma.notification.create({
          data: {
            title: 'تذكير موعد عودة',
            message: `المريض ${fu.patient.name} لديه موعد عودة غداً ${fu.scheduledDate}`,
            type: 'followup',
            link: `/patients/${fu.patientId}`
          }
        });

        // تحديث حالة المتابعة
        await prisma.followUp.update({
          where: { id: fu.id },
          data: { status: 'reminded', notificationSent: true }
        });

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
      console.error('Cron job error:', err);
    }
  });

  console.log('✅ Cron jobs started');
}

module.exports = { startCronJobs };
