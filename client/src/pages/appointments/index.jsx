import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Filter, CheckCircle, XCircle, UserCheck, Trash2, Pencil } from 'lucide-react';
import api from '../../utils/api';
import { getStatusText, getStatusColor, formatDate } from '../../utils/helpers';
import Modal from '../../components/ui/Modal';
import AppointmentForm from '../../components/appointments/AppointmentForm';

const AppointmentsList = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedApptToPay, setSelectedApptToPay] = useState(null);
  const [amountToPay, setAmountToPay] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [dateFilter]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/appointments?date=${dateFilter}`);
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/appointments/${id}`, { status: newStatus });
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'خطأ في تحديث الحالة');
    }
  };

  const handleCheckin = async (appointmentId) => {
    try {
      await api.post('/queue/checkin', { appointmentId });
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'خطأ في تسجيل الوصول');
    }
  };

  const handleOpenPayment = (appt) => {
    setSelectedApptToPay(appt);
    setAmountToPay('');
    setPaymentModalOpen(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!amountToPay || amountToPay <= 0) return alert('الرجاء إدخال مبلغ صحيح');
    try {
      await api.put(`/appointments/${selectedApptToPay.id}/pay`, { amountToPay });
      setPaymentModalOpen(false);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'خطأ في إكمال الدفع');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الموعد؟')) return;
    try {
      await api.delete(`/appointments/${id}`);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'خطأ في إلغاء الموعد');
    }
  };

  const handleSave = (savedAppointment) => {
    setIsModalOpen(false);
    setEditingAppointment(null);
    
    // Automatically switch to the date of the saved appointment so the user can see it
    if (savedAppointment && savedAppointment.date) {
      if (dateFilter !== savedAppointment.date) {
        setDateFilter(savedAppointment.date); // This will trigger fetchAppointments via useEffect
      } else {
        fetchAppointments(); // Same date, explicit refresh
      }
    } else {
      fetchAppointments();
    }
  };

  const handleOpenAdd = () => {
    setEditingAppointment(null);
    setIsModalOpen(true);
  };

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">إدارة المواعيد</h1>
          <p className="text-muted">جدول المواعيد والحجوزات اليومية</p>
        </div>
        <button className="btn-primary" onClick={handleOpenAdd}>
          <Plus size={18} />
          <span>حجز موعد جديد</span>
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-color shadow-sm mb-6">
        <div className="p-4 flex gap-4 items-center bg-gray-50 border-b border-color rounded-t-xl">
           <div className="flex items-center gap-2 text-primary-700 font-bold mr-2"><Filter size={18}/> فلترة:</div>
           <input 
             type="date" 
             value={dateFilter}
             onChange={(e) => setDateFilter(e.target.value)}
             className="form-select"
             style={{ width: 'auto' }}
           />
           <button className="btn-secondary" onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}>مواعيد اليوم</button>
        </div>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم المريض</th>
                <th>اسم المريض</th>
                <th>الطبيب</th>
                <th>الفترة</th>
                <th>حالة الدفع</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">جاري التحميل...</td></tr>
              ) : appointments.length === 0 ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">لا يوجد مواعيد في هذا اليوم</td></tr>
              ) : (
                appointments.map(app => (
                  <tr key={app.id}>
                    <td className="en-font font-medium">{app.patient?.fileNumber}</td>
                    <td className="font-bold">{app.patient?.name}</td>
                    <td>{app.doctor?.user?.name}</td>
                    <td>{app.period === 'morning' ? 'صباحي' : 'مسائي'}</td>
                    <td>
                      {app.paymentStatus === 'paid' ? (
                        <span className="px-2 py-1 text-xs font-bold rounded-md bg-green-100 text-green-700">دفع بالكامل 🟢</span>
                      ) : app.paymentStatus === 'partial' ? (
                        <span className="px-2 py-1 text-xs font-bold rounded-md bg-orange-100 text-orange-700">سداد جزئي 🔶</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-bold rounded-md bg-red-100 text-red-700">غير مدفوع 🔴</span>
                      )}
                    </td>
                    <td>
                      <span className="px-3 py-1 text-xs font-bold rounded-full text-white" style={{ backgroundColor: getStatusColor(app.status) }}>
                        {getStatusText(app.status)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                         {app.status === 'pending' && (
                           <>
                             <button onClick={() => handleStatusChange(app.id, 'confirmed')} className="action-btn text-success-600" title="تأكيد"><CheckCircle size={18}/></button>
                             <button onClick={() => handleStatusChange(app.id, 'cancelled')} className="action-btn text-danger-600" title="إلغاء"><XCircle size={18}/></button>
                           </>
                         )}
                         {app.status === 'confirmed' && (
                             app.paymentStatus === 'paid' ? (
                               <button onClick={() => handleCheckin(app.id)} className="btn-primary py-1 px-3 text-sm">
                                 <UserCheck size={14}/> تسجيل وصول
                               </button>
                             ) : (
                               <button onClick={() => handleOpenPayment(app)} className="btn-secondary py-1 px-3 text-sm border-orange-500 text-orange-700">
                                 إكمال الدفع أولاً
                               </button>
                             )
                         )}
                         {(app.status !== 'cancelled' && app.status !== 'completed') && (
                           <button onClick={() => handleDelete(app.id)} className="action-btn text-danger" title="حذف الموعد"><Trash2 size={16}/></button>
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

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingAppointment(null); }} title="حجز موعد جديد" size="lg">
        <AppointmentForm onClose={() => { setIsModalOpen(false); setEditingAppointment(null); }} onSave={handleSave} />
      </Modal>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="إكمال دفع الموعد" size="sm">
        {selectedApptToPay && (
          <form onSubmit={submitPayment} className="flex flex-col gap-4">
            <div className="bg-orange-50 text-orange-800 p-3 rounded-md text-sm mb-2">
              <p>إجمالي الكشفية: <b>{selectedApptToPay.totalAmount}</b></p>
              <p>المدفوع مسبقاً: <b>{selectedApptToPay.paidAmount}</b></p>
              <p>المتبقي: <b className="text-danger">{selectedApptToPay.totalAmount - selectedApptToPay.paidAmount}</b></p>
            </div>
            <div className="form-group">
              <label>المبلغ المراد دفعه الآن <span className="text-danger">*</span></label>
              <input type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="form-input text-lg font-bold" min={1} max={(selectedApptToPay.totalAmount - selectedApptToPay.paidAmount) > 0 ? selectedApptToPay.totalAmount - selectedApptToPay.paidAmount : undefined} autoFocus required />
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', marginBottom: '-1.5rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setPaymentModalOpen(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">حفظ وتسديد</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AppointmentsList;
