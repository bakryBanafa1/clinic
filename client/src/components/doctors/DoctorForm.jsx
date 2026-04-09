import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const DoctorForm = ({ doctor, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    specialty: '',
    phone: '',
    licenseNumber: '',
    consultationFee: 0,
    isActive: true
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (doctor) {
      setFormData({
        name: doctor.user?.name || '',
        username: doctor.user?.username || '',
        password: '',
        specialty: doctor.specialty || '',
        phone: doctor.phone || '',
        licenseNumber: doctor.licenseNumber || '',
        consultationFee: doctor.consultationFee || 0,
        isActive: doctor.isActive !== false
      });
    }
  }, [doctor]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.username || (!doctor && !formData.password) || !formData.specialty) {
      setError('يرجى تعبئة كافة الحقول المطلوبة');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      if (doctor) {
        // Update existing doctor
        // Update user info
        const userData = { name: formData.name };
        if (formData.password) userData.password = formData.password;
        await api.put(`/auth/users/${doctor.userId}`, userData);
        
        // Update doctor info
        const doctorData = {
          specialty: formData.specialty,
          phone: formData.phone,
          licenseNumber: formData.licenseNumber,
          consultationFee: parseFloat(formData.consultationFee),
          isActive: formData.isActive
        };
        await api.put(`/doctors/${doctor.id}`, doctorData);
        onSave();
      } else {
        // Create new doctor: first create user, then create doctor record
        // Step 1: Create user account
        const user = await api.post('/auth/users', {
          name: formData.name,
          username: formData.username,
          password: formData.password,
          role: 'doctor'
        });

        // Step 2: Create doctor record linked to user
        await api.post('/doctors', {
          userId: user.id,
          specialty: formData.specialty,
          phone: formData.phone,
          licenseNumber: formData.licenseNumber,
          consultationFee: parseFloat(formData.consultationFee) || 0
        });
        
        onSave();
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
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
         {/* User Details */}
         <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <h4 className="font-bold border-b pb-2 mb-2">بيانات الدخول</h4>
         </div>

        <div className="form-group">
          <label>اسم الطبيب <span className="text-danger">*</span></label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="الاسم كامل" required />
        </div>
        
        <div className="form-group">
          <label>اسم المستخدم <span className="text-danger">*</span></label>
          <input type="text" name="username" value={formData.username} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} required disabled={!!doctor} />
        </div>

        <div className="form-group">
          <label>كلمة المرور {doctor ? '(اتركه فارغاً لعدم التغيير)' : <span className="text-danger">*</span>}</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} required={!doctor} />
        </div>
        
        <div className="form-group">
          <label>حالة الحساب</label>
          <div className="flex items-center gap-2 mt-2">
             <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} id="isActive" style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }} />
             <label htmlFor="isActive" className="cursor-pointer">نشط (يمكنه الدخول والعمل)</label>
          </div>
        </div>

        {/* Doctor Details */}
        <div className="form-group mt-4" style={{ gridColumn: 'span 2' }}>
            <h4 className="font-bold border-b pb-2 mb-2">البيانات الطبية والمالية</h4>
         </div>

        <div className="form-group">
          <label>التخصص <span className="text-danger">*</span></label>
          <input type="text" name="specialty" value={formData.specialty} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>رقم الجوال</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} />
        </div>

        <div className="form-group">
          <label>رقم الترخيص الطبي</label>
          <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} />
        </div>

        <div className="form-group">
          <label>رسوم الكشفية (ر.س)</label>
          <input type="number" name="consultationFee" value={formData.consultationFee} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} min="0" step="0.01" />
        </div>
      </div>

      <div className="modal-footer" style={{ marginTop: '1rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', marginBottom: '-1.5rem' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'جاري الحفظ...' : 'حفظ بيانات الطبيب'}
        </button>
      </div>
    </form>
  );
};

export default DoctorForm;
