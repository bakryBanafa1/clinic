import React, { useEffect, useState } from 'react';
import { Users, CalendarCheck, TrendingUp, AlertCircle, Clock, Receipt, Banknote, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    todayCompleted: 0,
    monthlyRevenue: 0,
    unpaidInvoices: 0,
    todayFollowUps: 0,
    overdueFollowUps: 0,
    waitingQueue: 0,
    patientsThisMonth: 0,
    todayNewPatients: 0
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get('/reports/dashboard');
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: 'إجمالي المرضى', value: stats.totalPatients, icon: <Users size={24} />, color: 'var(--primary-500)', bgColor: 'var(--primary-50)', path: '/patients' },
    { title: 'مواعيد اليوم', value: stats.todayAppointments, icon: <CalendarCheck size={24} />, color: 'var(--success-500)', bgColor: 'var(--success-50)', path: '/appointments' },
    { title: 'في الانتظار', value: stats.waitingQueue, icon: <Clock size={24} />, color: 'var(--warning-500)', bgColor: 'var(--warning-50)', path: '/queue' },
    { title: 'فواتير غير مدفوعة', value: stats.unpaidInvoices, icon: <Receipt size={24} />, color: 'var(--danger-500)', bgColor: 'var(--danger-50)', path: '/billing' },
  ];

  const secondaryStats = [
    { label: 'مرضى جدد اليوم', value: stats.todayNewPatients, icon: <UserPlus size={18} /> },
    { label: 'مرضى هذا الشهر', value: stats.patientsThisMonth, icon: <TrendingUp size={18} /> },
    { label: 'مراجعات اليوم', value: stats.todayFollowUps, icon: <AlertCircle size={18} /> },
    { label: 'مراجعات متأخرة', value: stats.overdueFollowUps, icon: <AlertCircle size={18} />, danger: true },
  ];

  // Chart data derived from stats
  const chartData = [
    { name: 'المواعيد', value: stats.todayAppointments, fill: 'var(--primary-500)' },
    { name: 'مكتملة', value: stats.todayCompleted, fill: 'var(--success-500)' },
    { name: 'في الانتظار', value: stats.waitingQueue, fill: 'var(--warning-500)' },
    { name: 'مراجعات', value: stats.todayFollowUps, fill: '#8b5cf6' },
  ];

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ width: '40px', height: '40px' }}></div>
          <p className="text-muted">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header mb-6">
        <h1>نظرة عامة</h1>
        <p className="text-muted">مرحباً بك في لوحة تحكم العيادة</p>
      </div>

      {/* Main Stats */}
      <div className="stats-grid">
        {statCards.map((card, idx) => (
          <div key={idx} className="stat-card" onClick={() => navigate(card.path)} style={{ cursor: 'pointer' }}>
            <div className="stat-icon" style={{ backgroundColor: card.bgColor, color: card.color }}>
              {card.icon}
            </div>
            <div className="stat-info">
              <h3>{card.title}</h3>
              <p className="en-font">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }} className="mt-6">
        {secondaryStats.map((s, idx) => (
          <div key={idx} className="bg-surface rounded-lg border border-color p-4 flex items-center gap-3">
            <span style={{ color: s.danger ? 'var(--danger-500)' : 'var(--text-muted)' }}>{s.icon}</span>
            <div>
              <p className="text-xs text-muted">{s.label}</p>
              <p className={`text-lg font-bold en-font ${s.danger && s.value > 0 ? 'text-danger-600' : ''}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="mt-8" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
         <div className="chart-card">
            <div className="border-b pb-4 mb-4">
              <h2 style={{ fontSize: '1.1rem' }}>ملخص أداء اليوم</h2>
            </div>
            <div style={{ width: '100%', height: 280 }} dir="ltr">
               <ResponsiveContainer>
                 <BarChart data={chartData} barCategoryGap="30%">
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                   <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 13 }} />
                   <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} allowDecimals={false} />
                   <Tooltip
                     contentStyle={{
                       background: 'var(--bg-surface)',
                       border: '1px solid var(--border-color)',
                       borderRadius: '8px',
                       direction: 'rtl'
                     }}
                   />
                   <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--primary-500)" />
                 </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
         
         <div className="chart-card">
            <div className="border-b pb-4 mb-4">
              <h2 style={{ fontSize: '1.1rem' }}>إحصائيات مالية</h2>
            </div>
            <div className="flex flex-col gap-6 p-2">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-muted text-sm mb-2">إيرادات الشهر</p>
                <p className="text-2xl font-bold en-font text-success-600">{formatCurrency(stats.monthlyRevenue)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-muted text-sm mb-2">مكتمل اليوم</p>
                <p className="text-2xl font-bold en-font text-primary-600">{stats.todayCompleted}</p>
                <p className="text-xs text-muted mt-1">من أصل <span className="en-font">{stats.todayAppointments}</span> موعد</p>
              </div>
              <div className="flex gap-3">
                <button className="btn-primary flex-1 text-sm" onClick={() => navigate('/appointments')}>
                  <CalendarCheck size={16}/> المواعيد
                </button>
                <button className="btn-secondary flex-1 text-sm" onClick={() => navigate('/billing')}>
                  <Banknote size={16}/> الفواتير
                </button>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
