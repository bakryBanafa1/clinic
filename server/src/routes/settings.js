const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { uploadLogo } = require('../middleware/upload');
const path = require('path');
const router = express.Router();

// جلب معلومات العيادة العامة (لصفحة تسجيل الدخول)
router.get('/public-info', async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst({
      select: {
        clinicName: true,
        logo: true
      }
    });
    res.json(settings || { clinicName: 'العيادة', logo: null });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب إعدادات العيادة الكاملة (يتطلب تسجيل دخول)
router.get('/', authMiddleware, async (req, res) => {
  try {
    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحديث إعدادات العيادة
router.put('/', authMiddleware, async (req, res) => {
  try {
    const {
      clinicName, clinicNameEn, address, city, country,
      phone, mobile, email, website, taxNumber, commercialRegister,
      workingHours, defaultMorningCapacity, defaultEveningCapacity,
      appointmentDuration, currency, taxRate,
      invoiceNotes, prescriptionNotes, headerColor,
      whatsappEnabled, whatsappNumber, minPaymentAmount,
      queueExaminationRatio, queueFollowupRatio
    } = req.body;

    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) {
      settings = await prisma.clinicSettings.create({ data: {} });
    }

    const updated = await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: {
        clinicName, clinicNameEn, address, city, country,
        phone, mobile, email, website, taxNumber, commercialRegister,
        workingHours: workingHours ? (typeof workingHours === 'string' ? workingHours : JSON.stringify(workingHours)) : undefined,
        defaultMorningCapacity: defaultMorningCapacity ? parseInt(defaultMorningCapacity) : undefined,
        defaultEveningCapacity: defaultEveningCapacity ? parseInt(defaultEveningCapacity) : undefined,
        appointmentDuration: appointmentDuration ? parseInt(appointmentDuration) : undefined,
        currency, taxRate: taxRate !== undefined ? parseFloat(taxRate) : undefined,
        invoiceNotes, prescriptionNotes, headerColor,
        whatsappEnabled, whatsappNumber,
        minPaymentAmount: minPaymentAmount !== undefined ? parseFloat(minPaymentAmount) : undefined,
        queueExaminationRatio: queueExaminationRatio !== undefined ? parseInt(queueExaminationRatio) : undefined,
        queueFollowupRatio: queueFollowupRatio !== undefined ? parseInt(queueFollowupRatio) : undefined
      }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// رفع شعار العيادة
router.post('/logo', authMiddleware, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'يرجى رفع ملف الشعار' });

    let settings = await prisma.clinicSettings.findFirst();
    if (!settings) settings = await prisma.clinicSettings.create({ data: {} });

    const logoPath = '/uploads/clinic/' + req.file.filename;
    await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: { logo: logoPath }
    });

    res.json({ logo: logoPath, message: 'تم رفع الشعار بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في رفع الشعار' });
  }
});

module.exports = router;
