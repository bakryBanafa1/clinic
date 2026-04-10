const fs = require('fs');
const path = require('path');

const fileContent = `import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const AppointmentForm = ({ appointment, onClose, onSave, defaultPatientId, defaultPhone, orderMessage }) => {
  const [formData, setFormData] = useState({
    patientId: defaultPatientId || '',
    name: '',
    phone: defaultPhone || '',
    dateOfBirth: '',
    gender: 'male',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    period: 'morning',
    notes: '',
    paidAmount: '0'
  });
  
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [orderMsg, setOrderMsg] = useState(orderMessage || '');
  
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capacityInfo, setCapacityInfo] = useState(null);

  useEffect(() => {
    fetchInitialData();
    if (orderMessage) {
      setOrderMsg(orderMessage);
    }
  }, [defaultPhone, orderMessage]);

  useEffect(() => {
    const searchPatients = async () => {
      if (patientSearch.length >= 2) {
         try {
           const res = await api.get(\`/patients?search=\${patientSearch}&limit=10\`);
           setPatientResults(res.patients || []);
           setShowPatientResults(true);
         } catch (err) {
           console.error(err);
         }
      } else {
        setPatientResults([]);
        setShowPatientResults(false);
      }
    };
    
    const timeoutId = setTimeout(searchPatients, 300);
    return () => clearTimeout(timeoutId);
  }, [patientSearch]);

  const selectPatient = (patient) => {
    setFormData(prev => ({ 
      ...prev, 
      patientId: patient.id,
      name: patient.name,
      phone: patient.phone || prev.phone,
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || 'male'
    }));
    setPatientSearch(patient.name);
    setShowPatientResults(false);
  };

  const clearPatientSelection = () => {
    setFormData(prev => ({
      ...prev,
      patientId: '',
      name: patientSearch
    }));
  };

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
      const res = await api.get(\`/appointments/availability?doctorId=\${formData.doctorId}&date=\${formData.date}\`);
      if (!res.available) {
        setCapacityInfo({ available: 0, capacity: 0, message: res.message });
        return;
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.doctorId || !formData.date) {
      setError('الرجاء تعبئة الحقول المطلوبة');
      return;
    }

    // Force patient name to be the search input if not selected
    const finalName = formData.patientId ? formData.name : (patientSearch || formData.name);
    if (!finalName) {
      setError('الرجاء إدخال اسم المريض');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      let finalPatientId = formData.patientId;

      // Check if it matches an existing patient by name exactly if not selected
      if (!finalPatientId && finalName) {
        const found = patients.find(p => p.name.toLowerCase() === finalName.toLowerCase());
        if (found) finalPatientId = found.id;
      }
      
      // If still no patientId, create new patient
      if (!finalPatientId) {
         const newPatientData = {
           name: finalName,
           phone: formData.phone,
           dateOfBirth: formData.dateOfBirth,
           gender: formData.gender
         };
         try {
           const patientRes = await api.post('/patients', newPatientData);
           finalPatientId = patientRes.id;
         } catch (pErr) {
           setError('فشل في حفظ بيانات المريض الجديد: ' + (pErr.response?.data?.error || pErr.message));
           setLoading(false);
           return;
         }
      }
      
      let payload = { 
        patientId: parseInt(finalPatientId), 
        doctorId: parseInt(formData.doctorId), 
        date: formData.date, 
        period: formData.period, 
        notes: formData.notes, 
        paidAmount: formData.paidAmount 
      };
      
      const data = await api.post('/appointments', payload);
      onSave(data);
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء حجز الموعد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" style={{ minHeight: '520px' }}>
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
      
      {/* Patient Section */}
      <div className="bg-gray-50 border border-color rounded-lg p-4">
        <h4 className="font-bold mb-4 border-b pb-2 text-primary">بيانات المريض</h4>
        
        <div className="form-group mb-4">
          <label>اسم المريض <span className="text-danger">*</span></label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="ابحث عن مريض مسجل أو أدخل اسم مريض جديد..."
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                clearPatientSelection();
              }}
              onFocus={() => patientSearch.length >= 2 && setShowPatientResults(true)}
              onBlur={() => setTimeout(() => setShowPatientResults(false), 200)}
              className="form-input"
              required
            />
            {showPatientResults && patientResults.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                {patientResults.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => selectPatient(p)}
                    className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                  >
                    {p.name} ({p.phone || p.fileNumber})
                  </div>
                ))}
              </div>
            )}
          </div>
          {formData.patientId && (
            <div className="mt-2 text-sm text-success-600 font-bold flex items-center gap-1">
              ✓ تم اختيار مريض مسجل مسبقاً
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group mb-0">
            <label>رقم الجوال {formData.patientId ? '' : <span className="text-danger">*</span>}</label>
            <input 
              type="tel" 
              name="phone"
              placeholder="أدخل رقم الهاتف..."
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
              disabled={!!formData.patientId && !!formData.phone}
              required={!formData.patientId}
            />
          </div>
          <div className="form-group mb-0">
            <label>العمر (سنة)</label>
            <input 
              type="number" 
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className="form-input"
              placeholder="مثال: 30"
              disabled={!!formData.patientId}
            />
          </div>
          <div className="form-group mb-0">
            <label>الجنس</label>
            <select 
              name="gender" 
              value={formData.gender} 
              onChange={handleChange} 
              className="form-select"
              disabled={!!formData.patientId}  
            >
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
        </div>
      </div>

      {orderMsg ? (
        <div style={{ backgroundColor: '#FEF3C7', border: '2px solid #F59E0B', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '18px', color: '#92400E' }}>
            <span style={{ fontSize: '24px' }}>📋</span> تفاصيل الطلب الخارجي
          </div>
          <p style={{ whiteSpace: 'pre-wrap', color: '#000000', marginTop: '8px', fontSize: '16px', fontWeight: '500' }}>{orderMsg}</p>
        </div>
      ) : null}

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
         <div className={\`p-3 rounded-md text-sm border \${capacityInfo.available > 0 ? 'bg-blue-50 border border-primary-200 text-blue-700' : 'bg-red-50 border border-red-200 text-red-700'}\`}>
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
                <div className={\`font-bold text-lg en-font \${remaining > 0 ? 'text-danger' : 'text-success'}\`}>{remaining} {settings?.currency || 'ر.س'}</div>
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
          {loading ? 'جاري الحفظ...' : 'حفظ المريض وتأكيد الحجز'}
        </button>
      </div>
    </form>
  );
};

export default AppointmentForm;
`;

fs.writeFileSync('d:/My Projects/clinic/client/src/components/appointments/AppointmentForm.jsx', fileContent);
