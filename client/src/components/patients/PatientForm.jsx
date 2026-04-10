import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const PatientForm = ({ patient, onClose, onSave, defaultPhone, orderMessage, appointmentData }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    nationalId: '',
    dateOfBirth: '',
    gender: 'male',
    bloodType: '',
    address: '',
    allergies: '',
    chronicDiseases: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderMsg, setOrderMsg] = useState('');

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        phone: patient.phone || defaultPhone || '',
        nationalId: patient.nationalId || '',
        dateOfBirth: patient.dateOfBirth || '',
        gender: patient.gender || 'male',
        bloodType: patient.bloodType || '',
        address: patient.address || '',
        allergies: patient.allergies || '',
        chronicDiseases: patient.chronicDiseases || ''
      });
    } else if (defaultPhone) {
      setFormData(prev => ({ ...prev, phone: defaultPhone }));
    }
    setOrderMsg(orderMessage || '');
  }, [patient, defaultPhone, orderMessage]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('اسم المريض مطلوب');
      return;
    }

    try {
      setLoading(true);
      setError('');
      let newPatient;
      if (patient) {
        newPatient = await api.put(`/patients/${patient.id}`, formData);
      } else {
        newPatient = await api.post('/patients', formData);
      }
      

      onSave(newPatient);
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
      
      {(orderMsg || appointmentData) ? (
        <div style={{ backgroundColor: '#EFF6FF', border: '2px solid #3B82F6', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '18px', color: '#1E40AF', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px' }}>📅</span> بيانات الحجز المطلوبة
          </div>
          {orderMsg && (
            <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #BFDBFE' }}>
              <p style={{ color: '#DC2626', fontWeight: '600', marginBottom: '4px' }}>الطلب:</p>
              <p style={{ whiteSpace: 'pre-wrap', color: '#1E3A8A', fontSize: '14px', backgroundColor: '#FEF2F2', padding: '8px', borderRadius: '4px' }}>{orderMsg}</p>
            </div>
          )}
          {appointmentData && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ color: '#059669', fontWeight: 'bold', marginBottom: '8px' }}>سيتم حجز موعد تلقائياً:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ backgroundColor: '#F0FDF4', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>التاريخ</p>
                  <p style={{ fontWeight: 'bold', color: '#166534' }}>{appointmentData.date}</p>
                </div>
                <div style={{ backgroundColor: '#F0FDF4', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>الفترة</p>
                  <p style={{ fontWeight: 'bold', color: '#166534' }}>{appointmentData.period === 'morning' ? 'صباحي' : 'مسائي'}</p>
                </div>
                <div style={{ backgroundColor: '#F0FDF4', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>الطبيب</p>
                  <p style={{ fontWeight: 'bold', color: '#166534' }}>{appointmentData.doctorName || 'غير محدد'}</p>
                </div>
                <div style={{ backgroundColor: '#F0FDF4', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>المبلغ المدفوع</p>
                  <p style={{ fontWeight: 'bold', color: '#166534' }}>{appointmentData.paidAmount || 0}</p>
                </div>
              </div>
              {appointmentData.notes && (
                <div style={{ marginTop: '8px', backgroundColor: '#FEF3C7', padding: '8px', borderRadius: '4px' }}>
                  <p style={{ fontSize: '12px', color: '#92400E', marginBottom: '4px' }}>ملاحظات:</p>
                  <p style={{ color: '#78350F' }}>{appointmentData.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
      
      <div className="grid-cols-1 sm:grid-cols-2 gap-4" style={{ display: 'grid' }}>
        <div className="form-group">
          <label>اسم المريض <span className="text-danger">*</span></label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="الاسم الرباعي" required />
        </div>
        
        <div className="form-group">
          <label>الرقم الوطني / الهوية</label>
          <input type="text" name="nationalId" value={formData.nationalId} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} />
        </div>

        <div className="form-group">
          <label>رقم الجوال</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} />
        </div>

        <div className="form-group">
          <label>العمر (سنة)</label>
          <input type="number" name="age" value={formData.dateOfBirth || ''} onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})} placeholder="مثال: 25" min="1" max="150" />
        </div>

        <div className="form-group">
          <label>الجنس</label>
          <select name="gender" value={formData.gender} onChange={handleChange} className="form-select">
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>

        <div className="form-group">
          <label>فصيلة الدم</label>
          <select name="bloodType" value={formData.bloodType} onChange={handleChange} className="form-select" dir="ltr">
            <option value="">غير محدد</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>الأمراض المزمنة (إن وجدت)</label>
        <textarea name="chronicDiseases" value={formData.chronicDiseases} onChange={handleChange} rows="2" className="form-textarea" placeholder="مثل: ضغط، درق، سكري..." />
      </div>

      <div className="form-group">
        <label>الحساسية من أدوية أو أطعمة (إن وجدت)</label>
        <textarea name="allergies" value={formData.allergies} onChange={handleChange} rows="2" className="form-textarea" placeholder="مثل: حساسية بنسلين..." />
      </div>

      <div className="modal-footer" style={{ marginTop: '1rem', margin: '-1.5rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'جاري الحفظ...' : 'حفظ البيانات'}
        </button>
      </div>
    </form>
  );
};

export default PatientForm;
