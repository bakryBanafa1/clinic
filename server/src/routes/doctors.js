const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// جلب كل الأطباء
router.get('/', authMiddleware, async (req, res) => {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
        schedules: true,
        _count: { select: { appointments: true, visits: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب طبيب بالمعرف
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { name: true, username: true } },
        schedules: { orderBy: { dayOfWeek: 'asc' } }
      }
    });
    if (!doctor) return res.status(404).json({ error: 'الطبيب غير موجود' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إضافة طبيب جديد (يتطلب حساب مستخدم أولاً)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { userId, specialty, phone, licenseNumber, consultationFee } = req.body;
    if (!userId || !specialty) return res.status(400).json({ error: 'حقول مطلوبة ناقصة' });

    const doctor = await prisma.doctor.create({
      data: { userId: parseInt(userId), specialty, phone, licenseNumber, consultationFee: parseFloat(consultationFee) || 0 },
      include: { user: { select: { name: true, username: true } } }
    });

    // تحديث دور المستخدم إلى طبيب
    await prisma.user.update({ where: { id: parseInt(userId) }, data: { role: 'doctor' } });

    res.status(201).json(doctor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث طبيب
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { specialty, phone, licenseNumber, consultationFee, isActive } = req.body;
    const doctor = await prisma.doctor.update({
      where: { id: parseInt(req.params.id) },
      data: { specialty, phone, licenseNumber, consultationFee: consultationFee !== undefined ? parseFloat(consultationFee) : undefined, isActive },
      include: { user: { select: { name: true } } }
    });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// === جدول الطبيب ===
router.post('/:id/schedule', authMiddleware, async (req, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const { schedules } = req.body; // array of schedule objects

    // حذف الجداول القديمة
    await prisma.doctorSchedule.deleteMany({ where: { doctorId } });

    // إنشاء جداول جديدة
    const created = await prisma.$transaction(
      schedules.map(s => prisma.doctorSchedule.create({
        data: {
          doctorId,
          dayOfWeek: s.dayOfWeek,
          morningStart: s.morningStart,
          morningEnd: s.morningEnd,
          eveningStart: s.eveningStart,
          eveningEnd: s.eveningEnd,
          morningCapacity: s.morningCapacity || 20,
          eveningCapacity: s.eveningCapacity || 20,
          isActive: s.isActive !== false
        }
      }))
    );
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب جدول طبيب
router.get('/:id/schedule', authMiddleware, async (req, res) => {
  try {
    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId: parseInt(req.params.id) },
      orderBy: { dayOfWeek: 'asc' }
    });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
