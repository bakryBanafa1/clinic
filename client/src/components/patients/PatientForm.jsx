import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const PatientForm = ({ patient, onClose, onSave }) => {
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

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        phone: patient.phone || '',
        nationalId: patient.nationalId || '',
        dateOfBirth: patient.dateOfBirth || '',
        gender: patient.gender || 'male',
        bloodType: patient.bloodType || '',
        address: patient.address || '',
        allergies: patient.allergies || '',
        chronicDiseases: patient.chronicDiseases || ''
      });
    }
  }, [patient]);

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
      if (patient) {
        const data = await api.put(`/patients/${patient.id}`, formData);
        onSave(data);
      } else {
        const data = await api.post('/patients', formData);
        onSave(data);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
      
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
          <label>تاريخ الميلاد</label>
          <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} />
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
