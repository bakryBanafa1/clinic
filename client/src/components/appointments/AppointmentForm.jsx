import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const AppointmentForm = ({ appointment, onClose, onSave, defaultPatientId, defaultPhone, orderMessage }) => {
  const isEditMode = !!appointment?.id;

  const [formData, setFormData] = useState({
    patientId: defaultPatientId || '',
    name: '',
    phone: defaultPhone || '',
    dateOfBirth: '',
    gender: 'male',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    period: 'morning',
    appointmentType: 'examination',
    notes: '',
    paidAmount: '0',
    status: 'pending'
  });

  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [orderMsg, setOrderMsg] = useState(orderMessage || '');

  const [doctors, setDoctors] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capacityInfo, setCapacityInfo] = useState(null);

  // ----- تهيئة البيانات عند فتح نموذج التعديل -----
  useEffect(() => {
    fetchInitialData();
    if (orderMessage) setOrderMsg(orderMessage);
  }, [defaultPhone, orderMessage]);

  useEffect(() => {
    if (isEditMode && appointment) {
      setFormData({
        patientId: appointment.patientId || '',
        name: appointment.patient?.name || '',
        phone: appointment.patient?.phone || '',
        dateOfBirth: appointment.patient?.dateOfBirth || '',
        gender: appointment.patient?.gender || 'male',
        doctorId: String(appointment.doctorId || ''),
        date: appointment.date || new Date().toISOString().split('T')[0],
        period: appointment.period || 'morning',
        appointmentType: appointment.appointmentType || 'examination',
        notes: appointment.notes || '',
        paidAmount: String(appointment.paidAmount ?? '0'),
        status: appointment.status || 'pending'
      });
      setPatientSearch(appointment.patient?.name || '');
    }
  }, [appointment]);

  // ----- بحث المريض -----
  useEffect(() => {
    if (isEditMode) return; // في وضع التعديل لا نحتاج بحث مريض
    const searchPatients = async () => {
      if (patientSearch.length >= 2) {
        try {
          const res = await api.get(`/patients?search=${patientSearch}&limit=10`);
          setPatientResults(res.patients || []);
          setShowPatientResults(true);
        } catch (err) { console.error(err); }
      } else {
        setPatientResults([]);
        setShowPatientResults(false);
      }
    };
    const t = setTimeout(searchPatients, 300);
    return () => clearTimeout(t);
  }, [patientSearch, isEditMode]);

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
    setFormData(prev => ({ ...prev, patientId: '', name: patientSearch }));
  };

  // ----- التحقق من الطاقة الاستيعابية -----
  useEffect(() => {
    if (formData.doctorId && formData.date) checkCapacity();
  }, [formData.doctorId, formData.date, formData.period]);

  const fetchInitialData = async () => {
    try {
      const [doctorsRes, settingsRes] = await Promise.all([
        api.get('/doctors'),
        api.get('/settings')
      ]);
      setDoctors(Array.isArray(doctorsRes) ? doctorsRes : []);
      setSettings(settingsRes || {});
    } catch (err) {
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
      const periodData = formData.period === 'morning' ? res.morning : res.evening;
      // في حالة التعديل، نضيف واحد للمتاح لأنه كان موعدنا يأخذ مكاناً
      if (isEditMode && appointment?.doctorId === parseInt(formData.doctorId) &&
          appointment?.date === formData.date && appointment?.period === formData.period) {
        setCapacityInfo({ ...periodData, available: (periodData.available || 0) + 1 });
      } else {
        setCapacityInfo(periodData);
      }
    } catch (err) {
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

    try {
      setLoading(true);
      setError('');

      if (isEditMode) {
        // ===== وضع التعديل: PUT =====
        
        const payload = {
          doctorId: parseInt(formData.doctorId),
          date: formData.date,
          period: formData.period,
          appointmentType: formData.appointmentType,
          notes: formData.notes,
          status: formData.status
        };

        // 🔒 فحص الدفع: إذا حاول المستخدم تغيير الحالة لـ "وصل" دون دفع كامل
        if (formData.status === 'checked_in' && appointment.paymentStatus !== 'paid') {
          // 1. أولاً نقوم بحفظ التعديلات الأخرى (مثل الملاحظات أو تغيير الطبيب) في قاعدة البيانات
          // لكن نترك الحالة كما هي الآن حتى يكتمل الدفع
          const intermediatePayload = { ...payload, status: appointment.status };
          const savedData = await api.put(`/appointments/${appointment.id}`, intermediatePayload);
          
          // 2. أخبر الصفحة الأم بفتح نافذة الدفع للموعد المحدث بالبيانات الجديدة
          onSave({
            ...savedData,
            _requiresPayment: true,
            _pendingStatus: 'checked_in'
          });
          setLoading(false);
          return;
        }

        const data = await api.put(`/appointments/${appointment.id}`, payload);
        onSave(data);
      } else {
        // ===== وضع الإنشاء: POST =====
        const finalName = formData.patientId ? formData.name : (patientSearch || formData.name);
        if (!finalName) { setError('الرجاء إدخال اسم المريض'); setLoading(false); return; }

        let finalPatientId = formData.patientId;
        if (!finalPatientId && finalName) {
          try {
            const pRes = await api.get(`/patients?search=${encodeURIComponent(finalName)}&limit=5`);
            const found = (pRes.patients || []).find(p => p.name.toLowerCase() === finalName.toLowerCase());
            if (found) finalPatientId = found.id;
          } catch (_) {}
        }

        if (!finalPatientId) {
          try {
            const patientRes = await api.post('/patients', {
              name: finalName,
              phone: formData.phone,
              dateOfBirth: formData.dateOfBirth,
              gender: formData.gender
            });
            finalPatientId = patientRes.id;
          } catch (pErr) {
            setError('فشل في حفظ بيانات المريض: ' + (pErr.message));
            setLoading(false);
            return;
          }
        }

        const payload = {
          patientId: parseInt(finalPatientId),
          doctorId: parseInt(formData.doctorId),
          date: formData.date,
          period: formData.period,
          appointmentType: formData.appointmentType,
          notes: formData.notes,
          paidAmount: formData.paidAmount
        };
        const data = await api.post('/appointments', payload);
        onSave(data);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const selectedDoctor = doctors.find(d => d.id === parseInt(formData.doctorId));
  const fee = selectedDoctor?.consultationFee || 0;
  const minPayment = settings?.minPaymentAmount || 0;
  const paidAmt = parseFloat(formData.paidAmount || 0);
  const remaining = Math.max(0, fee - paidAmt);

  const STATUS_OPTIONS = [
    { value: 'pending', label: '⏳ قيد الانتظار' },
    { value: 'confirmed', label: '✅ مؤكد' },
    { value: 'checked_in', label: '🏥 وصل (بالانتظار)' },
    { value: 'in_progress', label: '⚕️ عند الطبيب' },
    { value: 'completed', label: '🎉 مكتمل' },
    { value: 'cancelled', label: '❌ ملغي' },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" style={{ minHeight: '520px' }}>
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}

      {/* ===== قسم المريض (للقراءة فقط في وضع التعديل) ===== */}
      <div className="bg-gray-50 border border-color rounded-lg p-4">
        <h4 className="font-bold mb-4 border-b pb-2 text-primary">بيانات المريض</h4>

        {isEditMode ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <span className="text-2xl">👤</span>
            <div>
              <div className="font-bold text-lg">{formData.name}</div>
              <div className="text-sm text-muted">{formData.phone}</div>
            </div>
            <span className="mr-auto text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded">لا يمكن تغيير المريض في التعديل</span>
          </div>
        ) : (
          <>
            <div className="form-group mb-4">
              <label>اسم المريض <span className="text-danger">*</span></label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن مريض مسجل أو أدخل اسم مريض جديد..."
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); clearPatientSelection(); }}
                  onFocus={() => patientSearch.length >= 2 && setShowPatientResults(true)}
                  onBlur={() => setTimeout(() => setShowPatientResults(false), 200)}
                  className="form-input"
                  required
                />
                {showPatientResults && patientResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {patientResults.map(p => (
                      <div key={p.id} onClick={() => selectPatient(p)} className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100">
                        {p.name} ({p.phone || p.fileNumber})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {formData.patientId && (
                <div className="mt-2 text-sm text-success-600 font-bold">✓ تم اختيار مريض مسجل مسبقاً</div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group mb-0">
                <label>رقم الجوال {formData.patientId ? '' : <span className="text-danger">*</span>}</label>
                <input type="tel" name="phone" placeholder="أدخل رقم الهاتف..." value={formData.phone} onChange={handleChange} className="form-input" disabled={!!formData.patientId && !!formData.phone} required={!formData.patientId} />
              </div>
              <div className="form-group mb-0">
                <label>العمر (سنة)</label>
                <input type="number" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="form-input" placeholder="مثال: 30" disabled={!!formData.patientId} />
              </div>
              <div className="form-group mb-0">
                <label>الجنس</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="form-select" disabled={!!formData.patientId}>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {orderMsg && (
        <div style={{ backgroundColor: '#FEF3C7', border: '2px solid #F59E0B', padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '18px', color: '#92400E' }}>
            <span style={{ fontSize: '24px' }}>📋</span> تفاصيل الطلب الخارجي
          </div>
          <p style={{ whiteSpace: 'pre-wrap', color: '#000', marginTop: '8px', fontSize: '16px' }}>{orderMsg}</p>
        </div>
      )}

      {/* ===== قسم بيانات الموعد ===== */}
      <div className="form-group">
        <label>الطبيب المعالج <span className="text-danger">*</span></label>
        <select name="doctorId" value={formData.doctorId} onChange={handleChange} className="form-select" required>
          <option value="">اختر الطبيب...</option>
          {doctors.filter(d => d.isActive).map(d => <option key={d.id} value={d.id}>{d.user?.name} - {d.specialty}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>التاريخ <span className="text-danger">*</span></label>
          <input type="date" name="date" value={formData.date} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>الفترة <span className="text-danger">*</span></label>
          <select name="period" value={formData.period} onChange={handleChange} className="form-select" required>
            <option value="morning">صباحي</option>
            <option value="evening">مسائي</option>
          </select>
        </div>
        <div className="form-group">
          <label>نوع الحجز <span className="text-danger">*</span></label>
          <select name="appointmentType" value={formData.appointmentType} onChange={handleChange} className="form-select" required>
            <option value="examination">🩺 معاينة</option>
            <option value="followup">🔄 مراجعة</option>
          </select>
        </div>
      </div>

      {/* حالة الموعد (في وضع التعديل فقط) */}
      {isEditMode && (
        <div className="form-group">
          <label>حالة الموعد</label>
          <select name="status" value={formData.status} onChange={handleChange} className="form-select">
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* الطاقة الاستيعابية */}
      {capacityInfo && (
        <div className={`p-3 rounded-md text-sm border ${capacityInfo.available > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <span className="font-bold block mb-1">حالة الاستيعاب للفترة المحددة:</span>
          {capacityInfo.message ? <span>{capacityInfo.message}</span> :
            capacityInfo.available > 0
              ? <span>متاح: <b className="en-font">{capacityInfo.available}</b> من أصل <b className="en-font">{capacityInfo.capacity}</b></span>
              : <span>عذراً، هذه الفترة ممتلئة.</span>
          }
        </div>
      )}

      {/* تفاصيل الدفع (حجز جديد فقط) */}
      {!isEditMode && formData.doctorId && (
        <div className="bg-gray-50 border border-color rounded-lg p-4">
          <h4 className="font-bold mb-3 border-b pb-2 text-primary">تفاصيل الدفع</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
            <div className="form-group mb-0">
              <label>إجمالي الكشفية</label>
              <div className="font-bold text-lg en-font">{fee} {settings?.currency || 'ر.س'}</div>
            </div>
            <div className="form-group mb-0">
              <label>المبلغ المدفوع الآن <span className="text-danger">*</span></label>
              <input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleChange} min={0} max={fee > 0 ? fee : undefined} className="form-input text-lg font-bold" required />
            </div>
            <div className="form-group mb-0">
              <label>المتبقي للدفع</label>
              <div className={`font-bold text-lg en-font ${remaining > 0 ? 'text-danger' : 'text-success'}`}>{remaining} {settings?.currency || 'ر.س'}</div>
            </div>
          </div>
          {minPayment > 0 && <p className="text-sm mt-3 text-warning-700">★ الحد الأدنى للتسديد لتأكيد الحجز هو: {minPayment} {settings?.currency || 'ر.س'}</p>}
        </div>
      )}

      {/* ملاحظات */}
      <div className="form-group">
        <label>ملاحظات (اختياري)</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="form-textarea" />
      </div>

      <div className="modal-footer" style={{ marginTop: '1rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', marginBottom: '-1.5rem' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={loading || (!isEditMode && capacityInfo && capacityInfo.available <= 0)}>
          {loading ? 'جاري الحفظ...' : isEditMode ? '💾 حفظ التعديلات' : 'حفظ المريض وتأكيد الحجز'}
        </button>
      </div>
    </form>
  );
};

export default AppointmentForm;
