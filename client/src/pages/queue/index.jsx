import React, { useState, useEffect } from 'react';
import { Users, MonitorPlay, ArrowRight, Stethoscope } from 'lucide-react';
import api from '../../utils/api';
import Modal from '../../components/ui/Modal';
import VisitForm from '../../components/visits/VisitForm';

const QueuePage = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVisitEntry, setActiveVisitEntry] = useState(null);
  const [existingVisit, setExistingVisit] = useState(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);

  useEffect(() => {
    fetchQueue();
    // In a real scenario, we would connect Socket.IO here to listen for queue updates
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const data = await api.get('/queue');
      // فلترة الحالات الملغاة للتأكد من عدم ظهورها
      const activeQueue = data.filter(q => q.status !== 'skipped' && q.appointment?.status !== 'cancelled');
      setQueue(activeQueue || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const callPatient = async (id) => {
    try {
      await api.put(`/queue/${id}/call`);
      fetchQueue();
    } catch (err) {
      alert('خطأ في استدعاء المريض');
    }
  };

  const completePatient = async (id) => {
    if (!confirm('هل أنت متأكد من إنهاء هذه الزيارة؟')) return;
    try {
      await api.put(`/queue/${id}/complete`);
      fetchQueue();
    } catch (err) {
      alert('خطأ');
    }
  };

  const openVisitForm = async (entry) => {
    setActiveVisitEntry(entry);
    setExistingVisit(null);

    // 检查是否已存在与此预约关联的就诊记录
    if (entry.appointmentId) {
      try {
        const visits = await api.get(`/visits?appointmentId=${entry.appointmentId}`);
        if (visits.visits && visits.visits.length > 0) {
          setExistingVisit(visits.visits[0]);
        }
      } catch (err) {
        console.error('检查就诊记录时出错:', err);
      }
    }
    setIsVisitModalOpen(true);
  };

  const handleVisitSaved = () => {
    setIsVisitModalOpen(false);
    setActiveVisitEntry(null);
    setExistingVisit(null);
    alert('تم حفظ السجل الطبي بنجاح!');
  };

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">إدارة الدور (Queue)</h1>
          <p className="text-muted">التحكم في سير المرضى للعيادات</p>
        </div>
        <button className="btn-secondary text-primary-600 flex items-center gap-2 border-primary-600 border" onClick={() => window.open('/queue-display', '_blank')}>
          <MonitorPlay size={18} />
          <span>فتح شاشة العرض الخارجي</span>
        </button>
      </div>

      <div className="grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid' }}>
         <div className="bg-surface rounded-xl border border-color shadow-sm overflow-hidden h-full">
            <div className="p-4 bg-gray-50 border-b border-color">
               <h3 className="font-bold flex items-center gap-2"><Users size={18}/> قائمة الانتظار للمرضى</h3>
            </div>
            <div className="p-4 flex flex-col gap-3">
               {queue.filter(q => q.status === 'waiting').length === 0 ? (
                 <p className="text-center text-muted p-8">لا يوجد مرضى في الانتظار حالياً</p>
               ) : queue.filter(q => q.status === 'waiting').map(entry => (
                 <div key={entry.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-center bg-white shadow-sm">
                    <div>
                       <div className="flex items-center gap-3 mb-1">
                          <span className="bg-primary-100 text-primary-800 font-bold px-2 py-1 rounded-md">رقم الدور: {entry.displayQueueNumber || entry.queueNumber}</span>
                          {(entry.appointmentType || entry.appointment?.appointmentType) === 'followup' ? (
                            <span className="px-2 py-1 text-xs font-bold rounded-md" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>🔄 مراجعة</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-bold rounded-md" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>🩺 معاينة</span>
                          )}
                          <span className="font-bold text-lg">{entry.patient?.name}</span>
                       </div>
                       <p className="text-sm text-muted mt-2">الطبيب: {entry.doctor?.user?.name}</p>
                    </div>
                    <button className="btn-primary flex items-center gap-2" onClick={() => callPatient(entry.id)}>
                       استدعاء الشاشة <ArrowRight size={16}/>
                    </button>
                 </div>
               ))}
            </div>
         </div>

         <div className="bg-surface rounded-xl border-dashed border-2 border-primary-200 bg-primary-50 p-6 flex flex-col items-center justify-center">
            <h3 className="font-bold text-primary-800 mb-4 text-xl">المريض في العيادة حالياً (In Progress)</h3>
            
            {queue.filter(q => q.status === 'in_progress').length === 0 ? (
                 <p className="text-center text-muted">العيادة فارغة حالياً</p>
            ) : queue.filter(q => q.status === 'in_progress').map(entry => (
                  <div key={entry.id} className="bg-white border border-primary-300 rounded-xl p-6 w-full shadow-md text-center">
                     <h2 className="text-3xl font-bold text-primary-700 mb-2">{entry.patient?.name}</h2>
                     <p className="text-muted text-lg mb-2">رقم الدور: <b className="en-font">{entry.displayQueueNumber || entry.queueNumber}</b> | الطبيب: {entry.doctor?.user?.name}</p>
                     <div className="mb-4">
                       {(entry.appointmentType || entry.appointment?.appointmentType) === 'followup' ? (
                         <span className="px-3 py-1 text-sm font-bold rounded-full" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>🔄 مراجعة</span>
                       ) : (
                         <span className="px-3 py-1 text-sm font-bold rounded-full" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>🩺 معاينة</span>
                       )}
                     </div>
                    
                    <div className="flex gap-3 justify-center mt-2 flex-wrap">
                       <button className="btn-secondary text-primary-700 font-bold flex items-center gap-2 border-primary-200" onClick={() => openVisitForm(entry)}>
                          <Stethoscope size={18}/> السجل الطبي
                       </button>
                       <button className="btn-primary bg-success-600" onClick={() => completePatient(entry.id)}>
                          إنهاء الزيارة بنجاح
                       </button>
                    </div>
                 </div>
            ))}
         </div>
      </div>

      <Modal isOpen={isVisitModalOpen} onClose={() => setIsVisitModalOpen(false)} title={`${existingVisit ? 'تعديل' : 'تسجيل'} السجل الطبي - المريض: ${activeVisitEntry?.patient?.name}`} size="lg">
        {activeVisitEntry && (
          <VisitForm
            patientId={activeVisitEntry.patientId}
            doctorId={activeVisitEntry.doctorId}
            appointmentId={activeVisitEntry.appointmentId}
            initialVisit={existingVisit}
            onClose={() => setIsVisitModalOpen(false)}
            onSave={handleVisitSaved}
          />
        )}
      </Modal>
    </div>
  );
};

export default QueuePage;
