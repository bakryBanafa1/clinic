import React, { useState, useEffect } from 'react';
import { Save, UploadCloud, Store, Palette, Globe, ListOrdered } from 'lucide-react';
import api from '../../utils/api';

const ClinicSettings = () => {
  const [settings, setSettings] = useState({
    clinicName: '',
    clinicNameEn: '',
    phone: '',
    address: '',
    taxRate: 15,
    currency: 'YER',
    whatsappNumber: '',
    whatsappEnabled: false,
    postVisitEnabled: false,
    postVisitTemplate: '',
    queueExaminationRatio: 1,
    queueFollowupRatio: 1
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
                  <ListOrdered size={20} className="text-primary-600"/> إعدادات ترتيب الدور (المعاينات والمراجعات)
               </h3>
               <p className="text-sm text-muted mb-4">تحكّم في طريقة ترتيب المرضى في طابور الانتظار بالتبادل بين المعاينات والمراجعات.</p>
               <div className="grid-cols-1 sm:grid-cols-2 gap-4" style={{ display: 'grid' }}>
                  <div className="form-group">
                     <label>عدد المعاينات 🩺 في كل دورة</label>
                     <input type="number" name="queueExaminationRatio" value={settings.queueExaminationRatio || 1} onChange={handleChange} min="1" max="10" />
                     <p className="text-xs text-muted mt-1">كم معاينة تمر قبل إدخال مراجعة</p>
                  </div>
                  <div className="form-group">
                     <label>عدد المراجعات 🔄 في كل دورة</label>
                     <input type="number" name="queueFollowupRatio" value={settings.queueFollowupRatio || 1} onChange={handleChange} min="1" max="10" />
                     <p className="text-xs text-muted mt-1">كم مراجعة تمر بعد المعاينات</p>
                  </div>
               </div>
               <div className="mt-3 p-3 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-200">
                  💡 <b>مثال:</b> إذا كانت المعاينات = {settings.queueExaminationRatio || 1} والمراجعات = {settings.queueFollowupRatio || 1}، 
                  فسيكون الترتيب: {Array.from({length: 2}, () => [
                    ...Array.from({length: settings.queueExaminationRatio || 1}, () => '🩺'),
                    ...Array.from({length: settings.queueFollowupRatio || 1}, () => '🔄')
                  ]).flat().join(' → ')} → ...
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

                      {/* رسالة الشكر بعد الزيارة */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                         <div className="flex gap-3 items-center mb-3">
                            <input
                              type="checkbox"
                              name="postVisitEnabled"
                              id="postVisitEnabled"
                              checked={settings.postVisitEnabled || false}
                              onChange={handleChange}
                              className="w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="postVisitEnabled" className="font-bold cursor-pointer">إرسال رسالة شكر بعد انتهاء الزيارة</label>
                         </div>
                         {settings.postVisitEnabled && (
                            <div className="form-group mb-0">
                               <label className="text-sm font-bold mb-2 block">نص رسالة الشكر (يمكنك استخدام المتغيرات)</label>
                               <textarea
                                 name="postVisitTemplate"
                                 value={settings.postVisitTemplate || ''}
                                 onChange={handleChange}
                                 rows="3"
                                 className="form-textarea"
                                 placeholder="شكراً لزيارتك {اسم_المريض} 🙏 نتمنى لك السلامة..."
                                 dir="rtl"
                               />
                               <p className="text-xs text-muted mt-2">
                                  المتغيرات المتاحة: <code className="bg-gray-100 px-1 rounded">{'{اسم_المريض}'}</code> <code className="bg-gray-100 px-1 rounded">{'{اسم_الطبيب}'}</code> <code className="bg-gray-100 px-1 rounded">{'{اسم_العيادة}'}</code> <code className="bg-gray-100 px-1 rounded">{'{رقم_الملف}'}</code>
                               </p>
                            </div>
                         )}
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
                  <input type="text" name="currency" value={settings.currency || ''} onChange={handleChange} placeholder="مثال: ر.ي" />
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
