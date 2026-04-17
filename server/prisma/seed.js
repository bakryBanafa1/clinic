const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // إنشاء المدير
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'مدير النظام',
      username: 'admin',
      password: adminPassword,
      role: 'admin'
    }
  });
  console.log('✅ Admin user created:', admin.username);

  // إنشاء طبيب
  const doctorPassword = await bcrypt.hash('doctor123', 10);
  const doctorUser = await prisma.user.upsert({
    where: { username: 'doctor' },
    update: {},
    create: {
      name: 'د. أحمد محمد',
      username: 'doctor',
      password: doctorPassword,
      role: 'doctor'
    }
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      specialty: 'طب عام',
      phone: '0501234567',
      consultationFee: 150
    }
  });
  console.log('✅ Doctor created:', doctorUser.name);

  // إنشاء جدول الطبيب (أحد - خميس)
  for (let day = 0; day <= 4; day++) {
    await prisma.doctorSchedule.upsert({
      where: { id: day + 1 },
      update: {},
      create: {
        doctorId: doctor.id,
        dayOfWeek: day,
        morningStart: '08:00',
        morningEnd: '12:00',
        eveningStart: '16:00',
        eveningEnd: '21:00',
        morningCapacity: 20,
        eveningCapacity: 15
      }
    });
  }
  console.log('✅ Doctor schedule created');

  // إنشاء موظف استقبال
  const receptionistPassword = await bcrypt.hash('reception123', 10);
  await prisma.user.upsert({
    where: { username: 'reception' },
    update: {},
    create: {
      name: 'سارة أحمد',
      username: 'reception',
      password: receptionistPassword,
      role: 'receptionist'
    }
  });
  console.log('✅ Receptionist created');

  // إنشاء إعدادات العيادة الافتراضية
  await prisma.clinicSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      clinicName: 'عيادتي',
      clinicNameEn: 'My Clinic',
      address: 'شارع الرئيسي',
      city: 'صنعاء',
      country: 'اليمن',
      phone: '0112345678',
      mobile: '0501234567',
      currency: 'ر.ي',
      taxRate: 15,
      defaultMorningCapacity: 20,
      defaultEveningCapacity: 15,
      appointmentDuration: 15,
      headerColor: '#0369a1'
    }
  });
  console.log('✅ Clinic settings created');

  // إنشاء بعض المرضى التجريبيين
  const patients = [
    { fileNumber: 'P250001', name: 'محمد عبدالله', phone: '0551234567', gender: 'male', dateOfBirth: '1985-03-15', bloodType: 'A+' },
    { fileNumber: 'P250002', name: 'فاطمة أحمد', phone: '0559876543', gender: 'female', dateOfBirth: '1990-07-22', bloodType: 'O+' },
    { fileNumber: 'P250003', name: 'خالد سعيد', phone: '0541112223', gender: 'male', dateOfBirth: '1978-11-08', bloodType: 'B+' },
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { fileNumber: p.fileNumber },
      update: {},
      create: p
    });
  }
  console.log('✅ Sample patients created');

  console.log('\n🎉 Seeding completed!');
  console.log('📋 Login credentials:');
  console.log('   Admin: admin / admin123');
  console.log('   Doctor: doctor / doctor123');
  console.log('   Reception: reception / reception123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
