import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import api from '../../utils/api';
import Modal from '../ui/Modal';
import PatientForm from '../patients/PatientForm';

const AppointmentForm = ({ appointment, onClose, onSave, defaultPatientId }) => {
  const [formData, setFormData] = useState({
    patientId: defaultPatientId || '',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    period: 'morning',
    notes: '',
    paidAmount: '0'
  });
  
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capacityInfo, setCapacityInfo] = useState(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.doctorId && formData.date) {
      checkCapacity();
    }
  }, [formData.doctorId, formData.date, formData.period]);

  const fetchInitialData = async () => {
    try {
      const [patientsRes, doctorsRes, settingsRes] = await Promise.all([
        api.get('/patients'),
        api.get('/doctors'),
        api.get('/settings')
      ]);
      setPatients(patientsRes.patients || []);
      setDoctors(Array.isArray(doctorsRes) ? doctorsRes : []);
      setSettings(settingsRes || {});
    } catch (err) {
      console.error(err);
      setError('حدث خطأ في تحميل البيانات الأساسية');
    }
  };

  const checkCapacity = async () => {
    try {
      const res = await api.get(`/appointments/availability?doctorId=${formData.doctorId}&date=${formData.date}`);
      if (!res.available) {
        setCapacityInfo({ available: 0, capacity: 0, message: res.message });
        return;
      }
      // API returns res.morning and res.evening directly
      const periodData = formData.period === 'morning' ? res.morning : res.evening;
      setCapacityInfo(periodData);
    } catch (err) {
      console.error(err);
      setCapacityInfo(null);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePatientSaved = async (newPatient) => {
    setIsPatientModalOpen(false);
    await fetchInitialData();
    if (newPatient && newPatient.id) {
       setFormData(prev => ({ ...prev, patientId: newPatient.id }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientId || !formData.doctorId || !formData.date) {
      setError('الرجاء تعبئة الحقول المطلوبة');
      return;
    }

    try {
      setLoading(true);
      setError('');
      let payload = { ...formData, patientId: parseInt(formData.patientId), doctorId: parseInt(formData.doctorId) };
      
      const data = await api.post('/appointments', payload);
      onSave(data);
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء حجز الموعد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" style={{ minHeight: '520px' }}>
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
      
      <div className="form-group">
        <label>المريض <span className="text-danger">*</span></label>
        <div className="flex gap-2">
          <select name="patientId" value={formData.patientId} onChange={handleChange} className="form-select flex-1" required>
            <option value="">اختر المريض...</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.fileNumber})</option>)}
          </select>
          <button type="button" className="btn-secondary whitespace-nowrap flex items-center gap-1" onClick={() => setIsPatientModalOpen(true)}>
             <Plus size={16}/> إضافة مريض
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>الطبيب المعالج <span className="text-danger">*</span></label>
        <select name="doctorId" value={formData.doctorId} onChange={handleChange} className="form-select" required>
          <option value="">اختر الطبيب...</option>
          {doctors.filter(d => d.isActive).map(d => <option key={d.id} value={d.id}>{d.user?.name} - {d.specialty}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
         <div className="form-group">
            <label>التاريخ <span className="text-danger">*</span></label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} min={new Date().toISOString().split('T')[0]} required />
         </div>
         
         <div className="form-group">
            <label>الفترة <span className="text-danger">*</span></label>
            <select name="period" value={formData.period} onChange={handleChange} className="form-select" required>
               <option value="morning">صباحي</option>
               <option value="evening">مسائي</option>
            </select>
         </div>
      </div>

      {capacityInfo && (
         <div className={`p-3 rounded-md text-sm border ${capacityInfo.available > 0 ? 'bg-blue-50 border border-primary-200 text-blue-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <span className="font-bold block mb-1">حالة الاستيعاب للفترة المحددة:</span>
            {capacityInfo.message ? (
               <span>{capacityInfo.message}</span>
            ) : capacityInfo.available > 0 ? (
               <span>متاح: <b className="en-font">{capacityInfo.available}</b> من أصل <b className="en-font">{capacityInfo.capacity}</b></span>
            ) : (
               <span>عذراً، هذه الفترة ممتلئة بالكامل ولا يمكن إضافة المزيد من المواعيد.</span>
            )}
         </div>
      )}

      {formData.doctorId && (() => {
        const selectedDoctor = doctors.find(d => d.id === parseInt(formData.doctorId));
        const fee = selectedDoctor?.consultationFee || 0;
        const minPayment = settings?.minPaymentAmount || 0;
        const remaining = Math.max(0, fee - parseFloat(formData.paidAmount || 0));

        return (
          <div className="bg-gray-50 border border-color rounded-lg p-4">
            <h4 className="font-bold mb-3 border-b pb-2 text-primary">تفاصيل الدفع</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
              <div className="form-group mb-0">
                <label>إجمالي الكشفية</label>
                <div className="font-bold text-lg en-font">{fee} {settings?.currency || 'ر.س'}</div>
              </div>
              <div className="form-group mb-0">
                <label>المبلغ المدفوع الآن <span className="text-danger">*</span></label>
                <div className="relative">
                  <input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleChange} min={0} max={fee > 0 ? fee : undefined} className="form-input text-lg font-bold" required />
                </div>
              </div>
              <div className="form-group mb-0">
                <label>المتبقي للدفع</label>
                <div className={`font-bold text-lg en-font ${remaining > 0 ? 'text-danger' : 'text-success'}`}>{remaining} {settings?.currency || 'ر.س'}</div>
              </div>
            </div>
            {minPayment > 0 && <p className="text-sm mt-3 text-warning-700">★ الحد الأدنى للتسديد لتأكيد الحجز هو: {minPayment} {settings?.currency || 'ر.س'}</p>}
          </div>
        );
      })()}

      <div className="form-group">
        <label>ملاحظات (اختياري)</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="4" className="form-textarea" />
      </div>

      <div className="modal-footer" style={{ marginTop: '1rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', marginBottom: '-1.5rem' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={loading || (capacityInfo && capacityInfo.available <= 0)}>
          {loading ? 'جاري الحفظ...' : 'تأكيد الحجز'}
        </button>
      </div>
    </form>

    <Modal isOpen={isPatientModalOpen} onClose={() => setIsPatientModalOpen(false)} title="إضافة مريض جديد" size="xl">
      <PatientForm onClose={() => setIsPatientModalOpen(false)} onSave={handlePatientSaved} />
    </Modal>
    </>
  );
};

export default AppointmentForm;
