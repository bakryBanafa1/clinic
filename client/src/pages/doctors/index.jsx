import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Stethoscope, Clock, CheckCircle2, XCircle, CalendarDays } from 'lucide-react';
import api from '../../utils/api';
import Modal from '../../components/ui/Modal';
import DoctorForm from '../../components/doctors/DoctorForm';
import DoctorScheduleForm from '../../components/doctors/DoctorScheduleForm';

const DoctorsList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [scheduleDoctor, setScheduleDoctor] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const data = await api.get('/doctors');
      setDoctors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(doc => 
    doc.user?.name?.includes(search) || 
    doc.specialty?.includes(search)
  );

  const handleOpenEdit = (doc) => {
    setEditingDoctor(doc);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingDoctor(null);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setIsModalOpen(false);
    fetchDoctors();
  };

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">الأطباء وجداول العمل</h1>
          <p className="text-muted">إدارة بيانات الأطباء وصلاحياتهم</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={handleOpenAdd}>
          <UserPlus size={18} />
          <span>إضافة طبيب جديد</span>
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-color shadow-sm overflow-hidden mb-6">
        <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-color">
          <div className="search-input-wrapper">
             <Search size={18} className="text-muted" />
             <input 
               type="text" 
               placeholder="بحث بالقسم، أو اسم الطبيب..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
          </div>
        </div>
      </div>

      <div className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ display: 'grid' }}>
         {loading ? (
            <div className="lg:col-span-3 text-center p-8 text-muted">جاري تحميل الأطباء...</div>
         ) : filteredDoctors.length === 0 ? (
            <div className="lg:col-span-3 text-center p-8 text-muted">لم يتم العثور على أطباء</div>
         ) : (
            filteredDoctors.map(doctor => (
              <div key={doctor.id} className="bg-surface border border-color rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                 <div className="p-5 border-b border-color flex items-start gap-4">
                    <div className="avatar bg-primary-100 text-primary-700" style={{ width: '50px', height: '50px', fontSize: '1.4rem' }}>
                       {doctor.user?.name?.charAt(0)}
                    </div>
                    <div>
                       <h3 className="font-bold text-lg">{doctor.user?.name}</h3>
                       <p className="text-primary-600 font-medium">{doctor.specialty}</p>
                    </div>
                 </div>
                 
                 <div className="p-4 bg-gray-50 flex flex-col gap-3 text-sm">
                    <div className="flex justify-between">
                       <span className="text-muted flex items-center gap-1"><Stethoscope size={15}/> رسوم الكشف</span>
                       <span className="en-font font-medium">SR {doctor.consultationFee}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-muted flex items-center gap-1"><CheckCircle2 size={15}/> الحالة</span>
                       {doctor.isActive ? 
                         <span className="text-success-600 font-medium">نشط</span> : 
                         <span className="text-danger-600 font-medium">غير نشط</span>
                       }
                    </div>
                 </div>

                 <div className="p-4 border-top border-color flex gap-2">
                     <button className="btn-secondary flex-1" onClick={() => handleOpenEdit(doctor)}>تعديل البيانات</button>
                     <button className="btn-secondary flex-1 text-primary-600 border-primary-200" style={{ border: '1px solid' }} onClick={() => { setScheduleDoctor(doctor); setIsScheduleModalOpen(true); }}>
                       <CalendarDays size={16} /> تقويم الطبيب
                     </button>
                  </div>
              </div>
            ))
         )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingDoctor ? "تعديل الطبيب" : "إضافة طبيب"} size="md">
        <DoctorForm doctor={editingDoctor} onClose={() => setIsModalOpen(false)} onSave={handleSave} />
      </Modal>

      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title={`جدول عمل الطبيب: ${scheduleDoctor?.user?.name || ''}`} size="lg">
        {scheduleDoctor && (
          <DoctorScheduleForm
            doctor={scheduleDoctor}
            onClose={() => setIsScheduleModalOpen(false)}
            onSave={() => { setIsScheduleModalOpen(false); fetchDoctors(); }}
          />
        )}
      </Modal>
    </div>
  );
};

export default DoctorsList;
