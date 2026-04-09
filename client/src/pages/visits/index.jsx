import React, { useState, useEffect, useRef } from 'react';
import { Search, Activity, FileText, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import Modal from '../../components/ui/Modal';
import VisitForm from '../../components/visits/VisitForm';

const VisitsPage = () => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      const data = await api.get('/visits');
      setVisits(data.visits || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'وصفة_طبية',
  });

  const openPrescriptionPrint = (visit) => {
    if (visit.prescription) {
      let meds = visit.prescription.medications;
      // Try to parse medications JSON
      if (typeof meds === 'string') {
        try {
          meds = JSON.parse(meds);
        } catch (e) {
          // Keep as string
        }
      }
      setSelectedPrescription({
        ...visit.prescription,
        medications: meds,
        patient: visit.patient,
        doctor: visit.doctor,
        date: visit.visitDate
      });
      setIsPrintModalOpen(true);
    } else {
      alert('لا يوجد وصفة طبية مسجلة لهذه الزيارة');
    }
  };

  const openVisitDetails = (visit) => {
    setActiveVisit(visit);
    setIsVisitModalOpen(true);
  };

  const handleVisitSaved = () => {
    setIsVisitModalOpen(false);
    setActiveVisit(null);
    fetchVisits();
  };

  const renderMedications = (meds) => {
    if (Array.isArray(meds)) {
      return meds.map((med, idx) => (
        <div key={idx} className="p-3 border-b border-gray-100" style={{ borderBottom: idx < meds.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
          <p className="font-bold">{idx + 1}. {med.name}</p>
          <p className="text-sm text-gray-600">
            {med.dose && `الجرعة: ${med.dose}`}
            {med.frequency && ` | ${med.frequency}`}
            {med.duration && ` | المدة: ${med.duration}`}
          </p>
          {med.instructions && <p className="text-sm text-muted mt-1">{med.instructions}</p>}
        </div>
      ));
    }
    return <div className="whitespace-pre-wrap font-medium leading-loose px-4">{String(meds)}</div>;
  };

  const filteredVisits = visits.filter(v =>
    (v.patient?.name || '').includes(search) ||
    (v.doctor?.user?.name || '').includes(search) ||
    (v.patient?.fileNumber || '').includes(search)
  );

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">الزيارات والوصفات الطبية</h1>
          <p className="text-muted">السجل الشامل للزيارات وتقارير الأطباء</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-color shadow-sm mb-6 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-color">
          <div className="search-input-wrapper">
             <Search size={18} className="text-muted" />
             <input type="text" placeholder="بحث باسم المريض أو الطبيب..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المريض</th>
                <th>الطبيب</th>
                <th>الشكوى</th>
                <th>التشخيص</th>
                <th>الوصفة الطبية</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">جاري التحميل...</td></tr>
              ) : filteredVisits.length === 0 ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">لا يوجد سجلات</td></tr>
              ) : (
                filteredVisits.map(v => (
                  <tr key={v.id}>
                    <td className="en-font font-medium">{formatDate(v.visitDate)}</td>
                    <td className="font-bold">{v.patient?.name}</td>
                    <td>{v.doctor?.user?.name}</td>
                    <td>{v.chiefComplaint || '-'}</td>
                    <td>{v.diagnosis || '-'}</td>
                    <td>
                      {v.prescription ? (
                         <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">يوجد وصفة</span>
                      ) : (
                         <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                         <button onClick={() => openVisitDetails(v)} className="action-btn text-primary" title="عرض أو تعديل الزيارة"><Activity size={18}/></button>
                         {v.prescription && (
                            <button onClick={() => openPrescriptionPrint(v)} className="action-btn text-success" title="طباعة الوصفة"><Printer size={18}/></button>
                         )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="طباعة الوصفة الطبية" size="md">
        {selectedPrescription && (
          <div className="flex flex-col gap-4">
             <div ref={printRef} className="print-container p-8 bg-white text-black" style={{ direction: 'rtl', border: '1px solid #ddd', minHeight: '400px' }}>
                <div className="text-center border-b pb-4 mb-6" style={{ borderBottomWidth: '2px', borderColor: 'var(--primary-600)' }}>
                   <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--primary-800)' }}>وصفة طبية - Prescription</h2>
                   <p className="text-gray-600 font-bold">{selectedPrescription.doctor?.user?.name} - {selectedPrescription.doctor?.specialty}</p>
                </div>

                <div className="flex justify-between mb-8 pb-4" style={{ borderBottom: '1px dashed #d1d5db' }}>
                   <div>
                      <p>المريض: <b>{selectedPrescription.patient?.name}</b></p>
                      <p>الرقم الطبي: <b className="en-font">{selectedPrescription.patient?.fileNumber}</b></p>
                   </div>
                   <div style={{ textAlign: 'left' }}>
                      <p>التاريخ: <b className="en-font">{formatDate(selectedPrescription.date)}</b></p>
                   </div>
                </div>

                <div className="mb-12" style={{ minHeight: '200px' }}>
                   <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="en-font text-2xl" style={{ color: '#2563eb' }}>Rx</span> الأدوية:</h3>
                   {renderMedications(selectedPrescription.medications)}

                   {selectedPrescription.instructions && (
                      <div className="mt-8 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                         <h4 className="font-bold mb-2">تعليمات عامة:</h4>
                         <p className="text-gray-700">{selectedPrescription.instructions}</p>
                      </div>
                   )}
                   {selectedPrescription.notes && (
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                         <h4 className="font-bold mb-2">ملاحظات الطبيب:</h4>
                         <p className="text-gray-700">{selectedPrescription.notes}</p>
                      </div>
                   )}
                </div>

                <div className="flex justify-between items-end mt-12 pt-8" style={{ borderTop: '2px solid var(--primary-600)' }}>
                   <p className="text-sm text-gray-500">تم اعتماد الوصفة إلكترونياً من قبل الطبيب المعالج للحالة.</p>
                   <div className="text-center" style={{ width: '10rem' }}>
                      <p className="mb-6 font-bold">توقيع الطبيب</p>
                      <div style={{ borderBottom: '1px solid black' }}></div>
                   </div>
                </div>
             </div>

             <div className="flex justify-end gap-2 mt-4">
                <button className="btn-secondary" onClick={() => setIsPrintModalOpen(false)}>إغلاق</button>
                <button className="btn-primary" onClick={() => handlePrint()}>
                   <Printer size={18}/> طباعة الوصفة
                </button>
             </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isVisitModalOpen} onClose={() => { setIsVisitModalOpen(false); setActiveVisit(null); }} title="تفاصيل السجل الطبي" size="lg">
        {activeVisit && (
          <VisitForm 
            initialVisit={activeVisit}
            onClose={() => { setIsVisitModalOpen(false); setActiveVisit(null); }} 
            onSave={handleVisitSaved} 
          />
        )}
      </Modal>
    </div>
  );
};

export default VisitsPage;
