const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// رفع ملف لمريض
router.post('/:patientId', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'يرجى اختيار ملف' });

    const file = await prisma.patientFile.create({
      data: {
        patientId: parseInt(req.params.patientId),
        fileName: req.file.originalname,
        filePath: '/uploads/patients/' + req.params.patientId + '/' + req.file.filename,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        category: req.body.category || 'other',
        description: req.body.description,
        uploadedBy: req.user.id
      }
    });

    res.status(201).json(file);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في رفع الملف' });
  }
});

// جلب ملفات مريض
router.get('/:patientId', authMiddleware, async (req, res) => {
  try {
    const files = await prisma.patientFile.findMany({
      where: { patientId: parseInt(req.params.patientId) },
      orderBy: { uploadedAt: 'desc' }
    });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// حذف ملف
router.delete('/delete/:fileId', authMiddleware, async (req, res) => {
  try {
    const file = await prisma.patientFile.findUnique({ where: { id: parseInt(req.params.fileId) } });
    if (!file) return res.status(404).json({ error: 'الملف غير موجود' });

    // حذف الملف الفعلي
    const fullPath = path.join(__dirname, '../../', file.filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    await prisma.patientFile.delete({ where: { id: parseInt(req.params.fileId) } });
    res.json({ message: 'تم حذف الملف' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في حذف الملف' });
  }
});

module.exports = router;
