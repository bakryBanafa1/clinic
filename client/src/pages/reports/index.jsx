import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../../utils/api';
import { TrendingUp, Users, Calendar, Banknote, Filter } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

const ReportsPage = () => {
  const [dashStats, setDashStats] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [patientReport, setPatientReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAllReports();
  }, [dateRange]);

  const fetchAllReports = async () => {
    try {
      setLoading(true);
      const [dash, fin, pat] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get(`/reports/financial?from=${dateRange.from}&to=${dateRange.to}`),
        api.get(`/reports/patients?from=${dateRange.from}&to=${dateRange.to}`)
      ]);
      setDashStats(dash);
      setFinancial(fin);
      setPatientReport(pat);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">جاري توليد التقارير...</div>;

  const paymentStatusData = financial ? [
    { name: 'مدفوعة', value: financial.summary.paid, color: '#22c55e' },
    { name: 'جزئي', value: financial.summary.partial, color: '#f59e0b' },
    { name: 'غير مدفوعة', value: financial.summary.unpaid, color: '#ef4444' },
    { name: 'مسترجعة', value: financial.summary.refunded || 0, color: '#8b5cf6' },
  ].filter(d => d.value > 0) : [];

  const genderData = patientReport?.genderStats ? patientReport.genderStats.map(g => ({
    name: g.gender === 'male' ? 'ذكور' : g.gender === 'female' ? 'إناث' : 'غير محدد',
    value: g._count,
    color: g.gender === 'male' ? '#0ea5e9' : g.gender === 'female' ? '#ec4899' : '#94a3b8'
  })) : [];

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">التقارير والإحصائيات</h1>
          <p className="text-muted">نظرة تحليلية شاملة لأداء العيادة</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-surface rounded-xl border border-color shadow-sm p-4 mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2 font-bold"><Filter size={18}/> الفترة:</div>
        <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="form-select" style={{ width: 'auto' }} />
        <span className="text-muted">إلى</span>
        <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="form-select" style={{ width: 'auto' }} />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }} className="mb-8">
         <div className="bg-surface p-5 rounded-xl border border-color shadow-sm flex items-center gap-4">
            <div className="p-3 bg-primary-50 text-primary-600 rounded-lg"><Users size={24}/></div>
            <div>
               <p className="text-muted text-sm">إجمالي المرضى</p>
               <h3 className="text-2xl font-bold en-font">{patientReport?.totalPatients || 0}</h3>
            </div>
         </div>
         <div className="bg-surface p-5 rounded-xl border border-color shadow-sm flex items-center gap-4">
            <div className="p-3 bg-success-50 text-success-600 rounded-lg"><Calendar size={24}/></div>
            <div>
               <p className="text-muted text-sm">مرضى جدد (الفترة)</p>
               <h3 className="text-2xl font-bold en-font">{patientReport?.newPatients || 0}</h3>
            </div>
         </div>
         <div className="bg-surface p-5 rounded-xl border border-color shadow-sm flex items-center gap-4">
            <div className="p-3 bg-warning-50 text-warning-600 rounded-lg"><Banknote size={24}/></div>
            <div>
               <p className="text-muted text-sm">إجمالي الفواتير</p>
               <h3 className="text-xl font-bold en-font text-success-600">{formatCurrency(financial?.summary?.totalAmount || 0)}</h3>
            </div>
         </div>
         <div className="bg-surface p-5 rounded-xl border border-color shadow-sm flex items-center gap-4">
            <div className="p-3 bg-danger-50 text-danger-600 rounded-lg"><TrendingUp size={24}/></div>
            <div>
               <p className="text-muted text-sm">المحصّل فعلياً</p>
               <h3 className="text-xl font-bold en-font">{formatCurrency(financial?.summary?.totalPaid || 0)}</h3>
               {financial?.summary?.totalUnpaid > 0 && <p className="text-xs text-danger-600 en-font">متبقي: {formatCurrency(financial.summary.totalUnpaid)}</p>}
            </div>
         </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
         {/* Payment Status Pie */}
         <div className="bg-surface p-6 rounded-xl border border-color shadow-sm">
            <h3 className="font-bold mb-6 flex items-center gap-2"><Banknote size={20}/> حالة الفواتير ({financial?.summary?.totalInvoices || 0} فاتورة)</h3>
            {paymentStatusData.length > 0 ? (
              <div style={{ width: '100%', height: 280 }} dir="ltr">
                 <ResponsiveContainer>
                   <PieChart>
                     <Pie
                       data={paymentStatusData}
                       cx="50%" cy="50%"
                       innerRadius={60} outerRadius={100}
                       paddingAngle={4}
                       dataKey="value"
                       label={({ name, value }) => `${name}: ${value}`}
                     >
                       {paymentStatusData.map((entry, idx) => (
                         <Cell key={idx} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip />
                     <Legend />
                   </PieChart>
                 </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-center text-muted" style={{ height: '200px' }}>لا يوجد فواتير في هذه الفترة</div>
            )}
         </div>

         {/* Gender Distribution */}
         <div className="bg-surface p-6 rounded-xl border border-color shadow-sm">
            <h3 className="font-bold mb-6 flex items-center gap-2"><Users size={20}/> توزيع المرضى حسب الجنس</h3>
            {genderData.length > 0 ? (
              <div style={{ width: '100%', height: 280 }} dir="ltr">
                 <ResponsiveContainer>
                   <PieChart>
                     <Pie
                       data={genderData}
                       cx="50%" cy="50%"
                       innerRadius={60} outerRadius={100}
                       paddingAngle={4}
                       dataKey="value"
                       label={({ name, value }) => `${name}: ${value}`}
                     >
                       {genderData.map((entry, idx) => (
                         <Cell key={idx} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip />
                     <Legend />
                   </PieChart>
                 </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-center text-muted" style={{ height: '200px' }}>لا يوجد بيانات</div>
            )}
         </div>
      </div>

      {/* Financial Summary Table */}
      {financial && (
        <div className="bg-surface rounded-xl border border-color shadow-sm mt-6 p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp size={20}/> ملخص مالي</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-muted text-sm mb-1">إجمالي الخصومات</p>
              <p className="text-lg font-bold en-font">{formatCurrency(financial.summary.totalDiscount)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-muted text-sm mb-1">إجمالي الضرائب</p>
              <p className="text-lg font-bold en-font">{formatCurrency(financial.summary.totalTax)}</p>
            </div>
            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#f5f3ff' }}>
              <p className="text-muted text-sm mb-1">مبالغ مسترجعة ⬅️</p>
              <p className="text-lg font-bold en-font" style={{ color: '#7c3aed' }}>{formatCurrency(financial.summary.totalRefunded || 0)}</p>
              <p className="text-xs text-muted mt-1">{(financial.summary.refunded || 0) + (financial.summary.cancelled || 0)} فاتورة ملغاة/مسترجعة</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-muted text-sm mb-1">إجمالي الزيارات</p>
              <p className="text-lg font-bold en-font">{patientReport?.totalVisits || 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
