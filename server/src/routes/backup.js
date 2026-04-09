const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const DB_PATH = path.join(__dirname, '../../prisma/clinic.db');
const BACKUP_DIR = path.join(__dirname, '../../backups');

// إنشاء نسخة احتياطية
router.post('/create', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `clinic-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.copyFileSync(DB_PATH, backupPath);

    res.json({ message: 'تم إنشاء النسخة الاحتياطية بنجاح', filename: backupName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في إنشاء النسخة الاحتياطية' });
  }
});

// قائمة النسخ الاحتياطية
router.get('/list', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { name: f, size: stat.size, date: stat.mtime };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تحميل نسخة احتياطية
router.get('/download/:filename', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير موجود' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحميل' });
  }
});

// حذف نسخة
router.delete('/:filename', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ message: 'تم حذف النسخة' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الحذف' });
  }
});

module.exports = router;
