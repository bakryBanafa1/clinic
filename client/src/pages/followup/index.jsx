import React, { useState, useEffect } from 'react';
import { CalendarClock, CheckCircle, MessageCircle, AlertCircle, Filter, Search } from 'lucide-react';
import api from '../../utils/api';
import { formatDate, getStatusText, getStatusColor } from '../../utils/helpers';

const FollowUpPage = () => {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, overdue: 0, pending: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchName, setSearchName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchFollowUps();
    fetchStats();
  }, [statusFilter, startDate, endDate]);

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      let query = `?status=${statusFilter}`;
      if (searchName) query += `&search=${searchName}`;
      if (startDate) query += `&from=${startDate}`;
      if (endDate) query += `&to=${endDate}`;
      
      const data = await api.get(`/followups${query}`);
      setFollowUps(data.followUps || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.get('/followups/stats');
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const markCompleted = async (id) => {
    try {
      await api.put(`/followups/${id}`, { status: 'completed' });
      fetchFollowUps();
      fetchStats();
    } catch (err) {
      alert('خطأ في أداء العملية');
    }
  };

  const markMissed = async (id) => {
    try {
      await api.put(`/followups/${id}`, { status: 'missed' });
      fetchFollowUps();
      fetchStats();
    } catch (err) {
      alert('خطأ في أداء العملية');
    }
  };

  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">نظام المراجعات (Follow Ups)</h1>
          <p className="text-muted">متابعة المرضى المستحقين للعودة وتذكيرهم بالمواعيد</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }} className="mb-6">
        <div className="bg-surface rounded-xl border border-color shadow-sm p-4 flex items-center gap-3 cursor-pointer" onClick={() => setStatusFilter('')}>
          <div className="p-3 bg-primary-50 text-primary-600 rounded-lg"><CalendarClock size={22}/></div>
          <div>
            <p className="text-muted text-sm">إجمالي المعلقة</p>
            <p className="text-2xl font-bold en-font">{stats.pending}</p>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-color shadow-sm p-4 flex items-center gap-3 cursor-pointer" style={{ borderColor: stats.today > 0 ? 'var(--warning-500)' : undefined }}>
          <div className="p-3 bg-warning-50 text-warning-600 rounded-lg"><AlertCircle size={22}/></div>
          <div>
            <p className="text-muted text-sm">مراجعات اليوم</p>
            <p className="text-2xl font-bold en-font">{stats.today}</p>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-color shadow-sm p-4 flex items-center gap-3 cursor-pointer" style={{ borderColor: stats.overdue > 0 ? 'var(--danger-500)' : undefined }}>
          <div className="p-3 bg-danger-50 text-danger-600 rounded-lg"><AlertCircle size={22}/></div>
          <div>
            <p className="text-muted text-sm">متأخرة</p>
            <p className="text-2xl font-bold en-font text-danger-600">{stats.overdue}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-color shadow-sm mb-6 overflow-hidden">
         <div className="p-4 flex gap-4 items-center bg-gray-50 border-b border-color flex-wrap">
            <div className="flex items-center gap-2 font-bold mr-2"><Filter size={18}/> فلترة وبحث:</div>
            
            <input 
              type="text" 
              placeholder="ابحث باسم المريض..." 
              value={searchName} 
              onChange={(e) => setSearchName(e.target.value)} 
              onBlur={fetchFollowUps}
              onKeyDown={(e) => e.key === 'Enter' && fetchFollowUps()}
              className="form-control" 
              style={{ width: '200px' }} 
            />

            <div className="flex items-center gap-2">
              <span className="text-sm">من:</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-control" style={{ width: '130px' }}/>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">إلى:</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-control" style={{ width: '130px' }}/>
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select" style={{ width: 'auto' }}>
              <option value="">كل الحالات</option>
              <option value="pending">معلق</option>
              <option value="reminded">تم التذكير</option>
              <option value="completed">مكتمل</option>
              <option value="missed">فائت</option>
            </select>
            
            <button className="btn-primary flex items-center gap-2" onClick={fetchFollowUps}>
              <Search size={16}/> بحث
            </button>
         </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>تاريخ المراجعة</th>
                <th>المريض</th>
                <th>رقم الجوال</th>
                <th>الطبيب</th>
                <th>السبب</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">جاري التحميل...</td></tr>
              ) : followUps.length === 0 ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">لا يوجد مراجعات مسجلة</td></tr>
              ) : (
                followUps.map(f => (
                  <tr key={f.id} style={
                    f.status === 'pending' && isOverdue(f.scheduledDate) ? { backgroundColor: '#fef2f2' } :
                    f.status === 'pending' && isToday(f.scheduledDate) ? { backgroundColor: '#fffbeb' } : {}
                  }>
                    <td className="en-font font-bold" style={{
                      color: isOverdue(f.scheduledDate) && f.status === 'pending' ? 'var(--danger-600)' :
                             isToday(f.scheduledDate) ? 'var(--warning-600)' : 'inherit'
                    }}>
                      {f.scheduledDate}
                      {isOverdue(f.scheduledDate) && f.status === 'pending' && <span className="text-xs mr-2 text-danger-600">(متأخر)</span>}
                      {isToday(f.scheduledDate) && <span className="text-xs mr-2 text-warning-600">(اليوم)</span>}
                    </td>
                    <td className="font-bold">{f.patient?.name}</td>
                    <td className="en-font">{f.patient?.phone || '-'}</td>
                    <td>{f.doctor?.user?.name}</td>
                    <td className="text-sm">{f.reason || '-'}</td>
                    <td>
                      <span className="px-3 py-1 text-xs font-bold rounded-full text-white" style={{ backgroundColor: getStatusColor(f.status) }}>
                        {getStatusText(f.status)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {(f.status === 'pending' || f.status === 'reminded') && (
                          <>
                            <button onClick={() => markCompleted(f.id)} className="btn-primary py-1 px-3 text-xs" style={{ background: 'var(--success-600)' }}>
                              <CheckCircle size={14}/> حضر
                            </button>
                            <button onClick={() => markMissed(f.id)} className="btn-secondary py-1 px-3 text-xs text-danger-600">
                              لم يحضر
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FollowUpPage;
