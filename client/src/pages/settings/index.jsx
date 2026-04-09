import React, { useState, useEffect } from 'react';
import { Save, UploadCloud, Store, Palette, Globe } from 'lucide-react';
import api from '../../utils/api';

const ClinicSettings = () => {
  const [settings, setSettings] = useState({
    clinicName: '',
    clinicNameEn: '',
    phone: '',
    address: '',
    taxRate: 15,
    currency: 'SAR',
    whatsappNumber: '',
    whatsappEnabled: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSettings({ ...settings, [e.target.name]: value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ text: '', type: '' });
      await api.put('/settings', settings);
      setMessage({ text: 'تم حفظ الإعدادات بنجاح', type: 'success' });
    } catch (err) {
      setMessage({ text: 'حدث خطأ أثناء الحفظ', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">جاري التحميل...</div>;

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">إعدادات النظام</h1>
          <p className="text-muted">تخصيص بيانات وتفضيلات العيادة</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl mb-6 font-bold flex justify-center ${message.type === 'success' ? 'bg-success-50 text-success-600 border border-success-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="grid-cols-1 lg:grid-cols-3 gap-6" style={{ display: 'grid' }}>
         {/* الهوية والتفاصيل */}
         <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-surface rounded-xl border border-color shadow-sm p-6">
               <h3 className="font-bold flex items-center gap-2 mb-6 border-b border-color pb-3">
                  <Store size={20} className="text-primary-600"/> البيانات الأساسية
               </h3>
               
               <div className="grid-cols-1 sm:grid-cols-2 gap-4" style={{ display: 'grid' }}>
                  <div className="form-group">
                     <label>اسم العيادة (عربي) <span className="text-danger">*</span></label>
                     <input type="text" name="clinicName" value={settings.clinicName || ''} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                     <label>اسم العيادة (إنجليزي)</label>
                     <input type="text" name="clinicNameEn" value={settings.clinicNameEn || ''} onChange={handleChange} dir="ltr" />
                  </div>
                  <div className="form-group">
                     <label>رقم هاتف العيادة</label>
                     <input type="text" name="phone" value={settings.phone || ''} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} />
                  </div>
                  <div className="form-group">
                     <label>العنوان</label>
                     <input type="text" name="address" value={settings.address || ''} onChange={handleChange} />
                  </div>
               </div>
            </div>

            <div className="bg-surface rounded-xl border border-color shadow-sm p-6">
               <h3 className="font-bold flex items-center gap-2 mb-6 border-b border-color pb-3">
                  <Globe size={20} className="text-primary-600"/> التكامل مع واتساب
               </h3>
               <div className="flex gap-4 items-center">
                  <input type="checkbox" name="whatsappEnabled" id="whatsappEnabled" checked={settings.whatsappEnabled || false} onChange={handleChange} className="w-5 h-5 cursor-pointer"/>
                  <label htmlFor="whatsappEnabled" className="font-bold cursor-pointer">تفعيل الإشعارات والتذكيرات التلقائية عبر واتساب</label>
               </div>
               
               {settings.whatsappEnabled && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="form-group">
                         <label>رقم واتساب المعتمد للإرسال</label>
                         <input type="text" name="whatsappNumber" value={settings.whatsappNumber || ''} onChange={handleChange} dir="ltr" placeholder="مثال: 966500000000" style={{ textAlign: 'right', width: '50%' }} />
                         <p className="text-sm text-muted mt-2">سيتم إرسال تذكيرات المواعيد تلقائياً من خلال هذا الرقم بواسطة نظام Baileys.</p>
                      </div>
                  </div>
               )}
            </div>
         </div>

         {/* الإعدادات المالية والاعتماد */}
         <div className="flex flex-col gap-6">
            <div className="bg-surface rounded-xl border border-color shadow-sm p-6 text-center">
               <h3 className="font-bold flex items-center gap-2 mb-4 justify-center">
                  <Palette size={20} className="text-primary-600"/> الشعار
               </h3>
               <div className="w-32 h-32 mx-auto rounded-xl border-dashed border-2 border-gray-300 flex-center bg-gray-50 text-muted flex-col mb-4 cursor-pointer hover:border-primary-500 transition-all">
                  <UploadCloud size={30} className="mb-2" />
                  <span className="text-sm">تغيير الشعار</span>
               </div>
               <p className="text-xs text-muted">يدعم JPG, PNG (حد أقصى 2MB)</p>
            </div>

            <div className="bg-surface rounded-xl border border-color shadow-sm p-6">
               <div className="form-group mb-4">
                  <label>الضريبة (%)</label>
                  <input type="number" name="taxRate" value={settings.taxRate || 0} onChange={handleChange} min="0" max="100" />
               </div>
               <div className="form-group">
                  <label>العملة الافتراضية</label>
                  <input type="text" name="currency" value={settings.currency || ''} onChange={handleChange} placeholder="مثال: ر.س" />
               </div>
            </div>

            <button type="submit" className="btn-primary w-full flex-center gap-2 py-3 text-lg" disabled={saving}>
               <Save size={20} />
               <span>{saving ? 'جاري الحفظ...' : 'حفظ كافة الإعدادات'}</span>
            </button>
         </div>
      </form>
    </div>
  );
};

export default ClinicSettings;
