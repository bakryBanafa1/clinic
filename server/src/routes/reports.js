const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// إحصائيات لوحة التحكم
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalPatients, todayAppointments, todayCompleted,
      monthlyRevenue, unpaidInvoices, todayFollowUps, overdueFollowUps,
      waitingQueue, patientsThisMonth, todayNewPatients
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({ where: { date: today, status: { not: 'cancelled' } } }),
      prisma.appointment.count({ where: { date: today, status: 'completed' } }),
      prisma.invoice.aggregate({ where: { date: { gte: startOfMonth, lte: endOfMonth }, paymentStatus: { notIn: ['cancelled', 'refunded'] } }, _sum: { paidAmount: true } }),
      prisma.invoice.count({ where: { paymentStatus: { in: ['unpaid', 'partial'] } } }),
      prisma.followUp.count({ where: { scheduledDate: today, status: { in: ['pending', 'reminded'] } } }),
      prisma.followUp.count({ where: { scheduledDate: { lt: today }, status: { in: ['pending', 'reminded'] } } }),
      prisma.queueEntry.count({ where: { date: today, status: 'waiting' } }),
      prisma.patient.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.patient.count({ where: { createdAt: { gte: new Date(today), lte: new Date(today + 'T23:59:59') } } })
    ]);

    res.json({
      totalPatients,
      todayAppointments,
      todayCompleted,
      monthlyRevenue: monthlyRevenue._sum.paidAmount || 0,
      unpaidInvoices,
      todayFollowUps,
      overdueFollowUps,
      waitingQueue,
      patientsThisMonth,
      todayNewPatients
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تقرير مالي
router.get('/financial', authMiddleware, async (req, res) => {
  try {
    const { from, to, period = 'daily' } = req.query;
    const where = {};
    if (from) where.date = { ...(where.date || {}), gte: new Date(from) };
    if (to) where.date = { ...(where.date || {}), lte: new Date(to + 'T23:59:59') };

    const invoices = await prisma.invoice.findMany({
      where,
      select: { date: true, total: true, paidAmount: true, paymentStatus: true, discount: true, tax: true, refundedAmount: true },
      orderBy: { date: 'asc' }
    });

    const activeInvoices = invoices.filter(i => !['cancelled', 'refunded'].includes(i.paymentStatus));
    const cancelledInvoices = invoices.filter(i => i.paymentStatus === 'cancelled');
    const refundedInvoices = invoices.filter(i => i.paymentStatus === 'refunded');

    const summary = {
      totalInvoices: invoices.length,
      totalAmount: activeInvoices.reduce((s, i) => s + i.total, 0),
      totalPaid: activeInvoices.reduce((s, i) => s + i.paidAmount, 0),
      totalDiscount: activeInvoices.reduce((s, i) => s + i.discount, 0),
      totalTax: activeInvoices.reduce((s, i) => s + i.tax, 0),
      unpaid: activeInvoices.filter(i => i.paymentStatus === 'unpaid').length,
      partial: activeInvoices.filter(i => i.paymentStatus === 'partial').length,
      paid: activeInvoices.filter(i => i.paymentStatus === 'paid').length,
      cancelled: cancelledInvoices.length,
      refunded: refundedInvoices.length,
      refundedAmount: refundedInvoices.reduce((s, i) => s + i.refundedAmount, 0),
      cancelledRefundAmount: cancelledInvoices.reduce((s, i) => s + i.paidAmount, 0)
    };
    summary.totalRefunded = summary.refundedAmount + summary.cancelledRefundAmount;
    summary.totalUnpaid = summary.totalAmount - summary.totalPaid;

    res.json({ summary, invoices });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// تقرير المرضى
router.get('/patients', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59');
    }

    const [totalPatients, newPatients, genderStats, visits] = await Promise.all([
      prisma.patient.count(),
      prisma.patient.count({ where }),
      prisma.patient.groupBy({ by: ['gender'], _count: true }),
      prisma.visit.count({ where: from || to ? { visitDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to + 'T23:59:59') : undefined } } : {} })
    ]);

    res.json({ totalPatients, newPatients, genderStats, totalVisits: visits });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
