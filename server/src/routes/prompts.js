const express = require('express');
const prisma = require('../lib/prisma');
const router = express.Router();

// GET: جلب بيانات الـ Prompt مباشرة عبر المتصفح
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.clinicSettings.findFirst();
    
    // إرجاع البيانات بصيغة JSON مباشرة لتسهيل قراءتها من أي نظام خارجي
    res.json({
      success: true,
      data: {
        aiPrompt: settings?.aiPrompt || '',
        clinicName: settings?.clinicName || 'العيادة'
      }
    });
  } catch (err) {
    console.error('Error fetching prompts:', err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب البيانات' });
  }
});

module.exports = router;
