import React, { useState } from 'react';
import api from '../../utils/api';
import { Save, CalendarClock } from 'lucide-react';

const VisitForm = ({ patientId, doctorId, appointmentId, initialVisit, onClose, onSave }) => {
  const parseVitals = (vitalsStr) => {
    try {
      if (!vitalsStr) return { bp: '', temp: '', pulse: '', weight: '', height: '' };
      const parsed = typeof vitalsStr === 'string' ? JSON.parse(vitalsStr) : vitalsStr;
      return {
        bp: parsed.bp || '', temp: parsed.temp || '', pulse: parsed.pulse || '',
        weight: parsed.weight || '', height: parsed.height || ''
      };
    } catch {
      return { bp: '', temp: '', pulse: '', weight: '', height: '' };
    }
  };

  const [formData, setFormData] = useState({
    patientId: initialVisit?.patientId || patientId || '',
    doctorId: initialVisit?.doctorId || doctorId || '',
    appointmentId: initialVisit?.appointmentId || appointmentId || '',
    chiefComplaint: initialVisit?.chiefComplaint || '',
    diagnosis: initialVisit?.diagnosis || '',
    examination: initialVisit?.examination || '',
    treatmentPlan: initialVisit?.treatmentPlan || '',
    notes: initialVisit?.notes || '',
    vitalSigns: parseVitals(initialVisit?.vitalSigns)
  });

  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleVitalsChange = (e) => {
    setFormData({
      ...formData,
      vitalSigns: { ...formData.vitalSigns, [e.target.name]: e.target.value }
    });
  };

  // حساب تاريخ المراجعة بناءً على عدد الأيام
  const setFollowUpByDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFollowUpDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientId || !formData.doctorId) {
       setError('بيانات المريض أو الطبيب مفقودة');
       return;
    }

    if (needsFollowUp && !followUpDate) {
      setError('الرجاء تحديد تاريخ المراجعة');
      return;
    }

    try {
      setLoading(true);
      setError('');
      // Clean up vital signs
      const vitals = { ...formData.vitalSigns };
      const hasVitals = Object.values(vitals).some(v => v !== '');
      
      const payload = {
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        appointmentId: formData.appointmentId || null,
        chiefComplaint: formData.chiefComplaint,
        diagnosis: formData.diagnosis,
        examination: formData.examination,
        treatmentPlan: formData.treatmentPlan,
        notes: formData.notes,
        vitalSigns: hasVitals ? vitals : null,
        ...(needsFollowUp && followUpDate ? { followUpDate, followUpReason } : {})
      };

      let data;
      if (initialVisit) {
        data = await api.put(`/visits/${initialVisit.id}`, payload);
      } else {
        data = await api.post('/visits', payload);
      }
      onSave(data);
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء حفظ تفاصيل الزيارة');
    } finally {
      setLoading(false);
    }
  };

  // حساب الحد الأدنى لتاريخ المراجعة (غداً)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minFollowUpDate = tomorrow.toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
      
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-2">
        <h4 className="font-bold mb-3 text-primary-700">العلامات الحيوية (اختياري)</h4>
        <div className="grid-cols-2 md:grid-cols-3 gap-3" style={{ display: 'grid' }}>
          <div className="form-group mb-0">
            <label className="text-xs">ضغط الدم (mmHg)</label>
            <input type="text" name="bp" value={formData.vitalSigns.bp} onChange={handleVitalsChange} placeholder="120/80" className="form-input text-sm" dir="ltr" />
          </div>
          <div className="form-group mb-0">
            <label className="text-xs">درجة الحرارة (°C)</label>
            <input type="text" name="temp" value={formData.vitalSigns.temp} onChange={handleVitalsChange} placeholder="37" className="form-input text-sm" dir="ltr" />
          </div>
          <div className="form-group mb-0">
            <label className="text-xs">النبض (bpm)</label>
            <input type="text" name="pulse" value={formData.vitalSigns.pulse} onChange={handleVitalsChange} placeholder="72" className="form-input text-sm" dir="ltr" />
          </div>
          <div className="form-group mb-0">
            <label className="text-xs">الوزن (kg)</label>
            <input type="text" name="weight" value={formData.vitalSigns.weight} onChange={handleVitalsChange} placeholder="75" className="form-input text-sm" dir="ltr" />
          </div>
          <div className="form-group mb-0">
            <label className="text-xs">الطول (cm)</label>
            <input type="text" name="height" value={formData.vitalSigns.height} onChange={handleVitalsChange} placeholder="175" className="form-input text-sm" dir="ltr" />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>الشكوى الرئيسية (Chief Complaint)</label>
        <textarea name="chiefComplaint" value={formData.chiefComplaint} onChange={handleChange} rows="2" className="form-textarea" placeholder="ما الذي يشتكي منه المريض؟" required />
      </div>

      <div className="form-group">
        <label>التشخيص الأولي (Diagnosis)</label>
        <textarea name="diagnosis" value={formData.diagnosis} onChange={handleChange} rows="2" className="form-textarea" placeholder="التشخيص للحالة المرضية..." />
      </div>
      
      <div className="form-group">
        <label>الفحص السريري (Examination)</label>
        <textarea name="examination" value={formData.examination} onChange={handleChange} rows="2" className="form-textarea" placeholder="ملاحظات الفحص..." />
      </div>

      <div className="form-group">
        <label>خطة العلاج (Treatment Plan)</label>
        <textarea name="treatmentPlan" value={formData.treatmentPlan} onChange={handleChange} rows="2" className="form-textarea" placeholder="الإجراءات العلاجية الموصى بها..." />
      </div>

      <div className="form-group">
        <label>ملاحظات إضافية (Notes)</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className="form-textarea" />
      </div>

      {/* قسم موعد المراجعة / العودة */}
      <div className="rounded-lg border-2 overflow-hidden" style={{ borderColor: needsFollowUp ? '#0ea5e9' : '#e2e8f0' }}>
        <div 
          className="p-3 flex items-center gap-3 cursor-pointer" 
          style={{ backgroundColor: needsFollowUp ? '#f0f9ff' : '#f8fafc' }}
          onClick={() => setNeedsFollowUp(!needsFollowUp)}
        >
          <input 
            type="checkbox" 
            checked={needsFollowUp} 
            onChange={(e) => setNeedsFollowUp(e.target.checked)} 
            className="w-5 h-5 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
          <CalendarClock size={20} style={{ color: needsFollowUp ? '#0ea5e9' : '#94a3b8' }} />
          <span className="font-bold" style={{ color: needsFollowUp ? '#0369a1' : '#64748b' }}>
            هل يحتاج المريض مراجعة (موعد عودة)؟
          </span>
        </div>

        {needsFollowUp && (
          <div className="p-4 border-t" style={{ borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group mb-0">
                <label className="text-sm font-bold">تاريخ المراجعة <span className="text-danger">*</span></label>
                <input 
                  type="date" 
                  value={followUpDate} 
                  onChange={(e) => setFollowUpDate(e.target.value)} 
                  min={minFollowUpDate}
                  className="form-input"
                  required={needsFollowUp}
                />
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button type="button" className="px-2 py-1 text-xs rounded-md bg-primary-50 text-primary-700 border border-primary-200 cursor-pointer hover:bg-primary-100" onClick={() => setFollowUpByDays(3)}>بعد 3 أيام</button>
                  <button type="button" className="px-2 py-1 text-xs rounded-md bg-primary-50 text-primary-700 border border-primary-200 cursor-pointer hover:bg-primary-100" onClick={() => setFollowUpByDays(7)}>بعد أسبوع</button>
                  <button type="button" className="px-2 py-1 text-xs rounded-md bg-primary-50 text-primary-700 border border-primary-200 cursor-pointer hover:bg-primary-100" onClick={() => setFollowUpByDays(14)}>بعد أسبوعين</button>
                  <button type="button" className="px-2 py-1 text-xs rounded-md bg-primary-50 text-primary-700 border border-primary-200 cursor-pointer hover:bg-primary-100" onClick={() => setFollowUpByDays(30)}>بعد شهر</button>
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="text-sm font-bold">سبب المراجعة (اختياري)</label>
                <textarea 
                  value={followUpReason} 
                  onChange={(e) => setFollowUpReason(e.target.value)} 
                  rows="2" 
                  className="form-textarea" 
                  placeholder="مثال: متابعة نتائج التحاليل..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ marginTop: '1rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', marginBottom: '-1.5rem' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'جاري الحفظ...' : <><Save size={18} className="ml-1"/> حفظ السجل الطبي</>}
        </button>
      </div>
    </form>
  );
};

export default VisitForm;

