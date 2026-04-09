const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { generateFileNumber } = require('../lib/utils');
const router = express.Router();

// جلب كل المرضى مع البحث والفلترة
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { fileNumber: { contains: search } },
        { phone: { contains: search } },
        { nationalId: { contains: search } }
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { visits: true, appointments: true } } }
      }),
      prisma.patient.count({ where })
    ]);

    res.json({ patients, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب مريض بالمعرف
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        visits: { include: { doctor: { include: { user: { select: { name: true } } } }, prescription: true, followUp: true }, orderBy: { visitDate: 'desc' } },
        medicalHistory: { orderBy: { createdAt: 'desc' } },
        appointments: { include: { doctor: { include: { user: { select: { name: true } } } } }, orderBy: { date: 'desc' }, take: 10 },
        files: { orderBy: { uploadedAt: 'desc' } },
        invoices: { orderBy: { date: 'desc' }, take: 10 },
        followUps: { include: { doctor: { include: { user: { select: { name: true } } } } }, orderBy: { scheduledDate: 'desc' } },
        _count: { select: { visits: true, appointments: true, files: true, invoices: true } }
      }
    });
    if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إضافة مريض جديد
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, dateOfBirth, gender, phone, email, nationalId, address, bloodType, allergies, chronicDiseases, emergencyContact, emergencyPhone, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم المريض مطلوب' });

    let fileNumber;
    let unique = false;
    while (!unique) {
      fileNumber = generateFileNumber();
      const existing = await prisma.patient.findUnique({ where: { fileNumber } });
      if (!existing) unique = true;
    }

    const patient = await prisma.patient.create({
      data: { fileNumber, name, dateOfBirth, gender, phone, email, nationalId, address, bloodType, allergies, chronicDiseases, emergencyContact, emergencyPhone, notes }
    });
    res.status(201).json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث بيانات مريض
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, dateOfBirth, gender, phone, email, nationalId, address, bloodType, allergies, chronicDiseases, emergencyContact, emergencyPhone, notes } = req.body;
    const patient = await prisma.patient.update({
      where: { id: parseInt(req.params.id) },
      data: { name, dateOfBirth, gender, phone, email, nationalId, address, bloodType, allergies, chronicDiseases, emergencyContact, emergencyPhone, notes }
    });
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// حذف مريض
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.patient.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'تم حذف المريض بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في حذف المريض - قد تكون هناك بيانات مرتبطة' });
  }
});

// === التاريخ المرضي ===
router.post('/:id/history', authMiddleware, async (req, res) => {
  try {
    const { condition, diagnosisDate, treatment, status, notes } = req.body;
    const history = await prisma.medicalHistory.create({
      data: { patientId: parseInt(req.params.id), condition, diagnosisDate, treatment, status, notes }
    });
    res.status(201).json(history);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.put('/history/:historyId', authMiddleware, async (req, res) => {
  try {
    const history = await prisma.medicalHistory.update({
      where: { id: parseInt(req.params.historyId) },
      data: req.body
    });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.delete('/history/:historyId', authMiddleware, async (req, res) => {
  try {
    await prisma.medicalHistory.delete({ where: { id: parseInt(req.params.historyId) } });
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
