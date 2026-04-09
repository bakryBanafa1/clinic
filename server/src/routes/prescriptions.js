const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// جلب الوصفات
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (patientId) where.patientId = parseInt(patientId);
    if (doctorId) where.doctorId = parseInt(doctorId);

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        patient: { select: { name: true, fileNumber: true, dateOfBirth: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
        visit: { select: { diagnosis: true, chiefComplaint: true } }
      },
      orderBy: { date: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب وصفة بالمعرف
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: true,
        doctor: { include: { user: { select: { name: true } } } },
        visit: true
      }
    });
    if (!prescription) return res.status(404).json({ error: 'الوصفة غير موجودة' });
    res.json(prescription);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// إنشاء وصفة
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { visitId, patientId, doctorId, medications, instructions, notes } = req.body;
    if (!visitId || !patientId || !doctorId || !medications) {
      return res.status(400).json({ error: 'بيانات ناقصة' });
    }

    const prescription = await prisma.prescription.create({
      data: {
        visitId: parseInt(visitId),
        patientId: parseInt(patientId),
        doctorId: parseInt(doctorId),
        medications: typeof medications === 'string' ? medications : JSON.stringify(medications),
        instructions,
        notes
      },
      include: {
        patient: { select: { name: true, fileNumber: true } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    });

    res.status(201).json(prescription);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث وصفة
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { medications, instructions, notes } = req.body;
    const prescription = await prisma.prescription.update({
      where: { id: parseInt(req.params.id) },
      data: {
        medications: medications ? (typeof medications === 'string' ? medications : JSON.stringify(medications)) : undefined,
        instructions, notes
      }
    });
    res.json(prescription);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
