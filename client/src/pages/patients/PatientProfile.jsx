import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarPlus, FileText, UserPlus, FileEdit, HeartPulse, Stethoscope, Download, FileUp, Plus, X, Upload, Trash2, Pencil } from 'lucide-react';
import api from '../../utils/api';
import { formatDate, getGenderText, getBloodTypeDisplay } from '../../utils/helpers';
import Modal from '../../components/ui/Modal';
import PatientForm from '../../components/patients/PatientForm';
import VisitForm from '../../components/visits/VisitForm';

const PatientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMedHistoryModalOpen, setIsMedHistoryModalOpen] = useState(false);
  const [editingMedHistory, setEditingMedHistory] = useState(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Med history form
  const [medForm, setMedForm] = useState({
    condition: '',
    diagnosisDate: '',
    treatment: '',
    notes: ''
  });

  useEffect(() => {
    fetchPatientData();
    fetchFiles();
  }, [id]);

  const fetchPatientData = async () => {
    try {
      const data = await api.get(`/patients/${id}`);
      setPatient(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const data = await api.get(`/files/${id}`);
      setFiles(Array.isArray(data) ? data : (data.files || []));
    } catch (err) {
      console.error(err);
    }
  };

  const handlePatientUpdate = (updatedPatient) => {
    setPatient({ ...patient, ...updatedPatient });
    setIsEditModalOpen(false);
    fetchPatientData();
  };

  const handleAddMedHistory = async (e) => {
    e.preventDefault();
    try {
      if (editingMedHistory) {
        await api.put(`/patients/history/${editingMedHistory.id}`, medForm);
      } else {
        await api.post(`/patients/${id}/history`, medForm);
      }
      setMedForm({ condition: '', diagnosisDate: '', treatment: '', notes: '' });
      setEditingMedHistory(null);
      setIsMedHistoryModalOpen(false);
      fetchPatientData();
    } catch (err) {
      alert(err.message || 'خطأ في الحفظ');
    }
  };

  const handleEditMedHistory = (hist) => {
    setEditingMedHistory(hist);
    setMedForm({
      condition: hist.condition || '',
      diagnosisDate: hist.diagnosisDate || '',
      treatment: hist.treatment || '',
      notes: hist.notes || '',
    });
    setIsMedHistoryModalOpen(true);
  };

  const handleDeleteMedHistory = async (histId) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل المرضي؟')) return;
    try {
      await api.delete(`/patients/history/${histId}`);
      fetchPatientData();
    } catch (err) {
      alert(err.message || 'خطأ في الحذف');
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    try {
      await api.delete(`/files/delete/${fileId}`);
      fetchFiles();
    } catch (err) {
      alert(err.message || 'خطأ في حذف الملف');
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('patientId', id);
        formData.append('description', file.name);

        await fetch(`/api/files/${id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('clinic_token')}`
          },
          body: formData
        });
      }
      fetchFiles();
    } catch (err) {
      alert('خطأ في رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (filename) => {
    if (!filename) return '📄';
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📕';
    if (['doc', 'docx'].includes(ext)) return '📘';
    return '📄';
  };

  const handleVisitSaved = () => {
    setIsVisitModalOpen(false);
    setActiveVisit(null);
    fetchPatientData();
  };

  if (loading) return <div className="text-center p-12 text-muted animate-pulse">جاري تحميل ملف المريض...</div>;
  if (!patient) return <div className="p-8 text-center text-danger">لم يتم العثور على المريض.</div>;

  return (
    <div className="animate-fade-in pb-8">
      {/* Header */}
      <div className="flex-between mb-6">
        <div className="flex items-center gap-4">
          <button className="icon-btn bg-surface border border-color" onClick={() => navigate('/patients')}>
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold mb-1">{patient.name}</h1>
            <p className="text-muted en-font">ملف: {patient.fileNumber} | {getGenderText(patient.gender)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setIsEditModalOpen(true)}>
            <FileEdit size={18} />
            <span>تعديل البيانات</span>
          </button>
          <button className="btn-primary" onClick={() => navigate(`/appointments?patientId=${patient.id}`)}>
            <CalendarPlus size={18} />
            <span>حجز موعد</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem' }}>
         {/* Sidebar */}
         <div className="flex flex-col gap-6">
            <div className="bg-surface rounded-xl border border-color shadow-sm p-5">
              <h3 className="font-bold border-b border-color pb-3 mb-4 flex items-center gap-2">
                 <UserPlus size={18} className="text-primary" />
                 البيانات الشخصية
              </h3>
              <div className="flex flex-col gap-3 text-sm">
                {[
                  { label: 'تاريخ الميلاد', value: patient.dateOfBirth || '-', isEn: true },
                  { label: 'الهوية', value: patient.nationalId || '-', isEn: true },
                  { label: 'رقم الجوال', value: patient.phone || '-', isEn: true },
                  { label: 'فصيلة الدم', value: getBloodTypeDisplay(patient.bloodType), isEn: true, danger: true },
                  { label: 'العنوان', value: patient.address || '-' },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-muted">{item.label}</span>
                    <span className={`${item.isEn ? 'en-font' : ''} font-medium ${item.danger ? 'text-danger' : ''}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-color shadow-sm p-5">
              <h3 className="font-bold border-b border-color pb-3 mb-4 flex items-center gap-2">
                 <HeartPulse size={18} className="text-danger" />
                 التنبيهات الصحية
              </h3>
              <div className="flex flex-col gap-3 text-sm">
                 <div>
                   <span className="text-muted block mb-1">الأمراض المزمنة</span>
                   <p className="font-medium bg-red-50 text-red-700 p-2 rounded-md">{patient.chronicDiseases || 'لا يوجد'}</p>
                 </div>
                 <div>
                   <span className="text-muted block mb-1">الحساسية</span>
                   <p className="font-medium bg-orange-50 text-orange-700 p-2 rounded-md">{patient.allergies || 'لا يوجد'}</p>
                 </div>
              </div>
            </div>
         </div>

         {/* Main Content */}
         <div>
            <div className="bg-surface rounded-xl border border-color shadow-sm overflow-hidden h-full">
              {/* Tabs */}
              <div className="flex border-b border-color bg-gray-50 px-2" style={{ overflowX: 'auto' }}>
                {[
                  { key: 'history', label: 'السجل الطبي' },
                  { key: 'visits', label: `الزيارات (${patient.visits?.length || 0})` },
                  { key: 'files', label: 'الملفات المرفقة' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`p-4 font-medium transition-all ${activeTab === tab.key ? 'text-primary-600' : 'text-muted'}`}
                    style={{ borderBottom: activeTab === tab.key ? '2px solid var(--primary-600)' : '2px solid transparent' }}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="p-6">
                {activeTab === 'history' && (
                  <div>
                    <div className="flex-between mb-4">
                      <h3 className="font-bold flex items-center gap-2"><FileText size={18} /> التاريخ المرضي</h3>
                      <button className="btn-primary text-sm" onClick={() => { setEditingMedHistory(null); setMedForm({ condition: '', diagnosisDate: '', treatment: '', notes: '' }); setIsMedHistoryModalOpen(true); }}>
                        <Plus size={16}/> إضافة سجل
                      </button>
                    </div>
                    {patient.medicalHistory?.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        {patient.medicalHistory.map(hist => (
                          <div key={hist.id} className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold">{hist.condition}</h4>
                              <div className="flex gap-1">
                                <button className="action-btn text-primary" title="تعديل" onClick={() => handleEditMedHistory(hist)}><Pencil size={15}/></button>
                                <button className="action-btn text-danger" title="حذف" onClick={() => handleDeleteMedHistory(hist.id)}><Trash2 size={15}/></button>
                              </div>
                            </div>
                            <p className="text-sm text-muted mb-2">تاريخ التشخيص: {hist.diagnosisDate || '-'}</p>
                            <p className="bg-gray-50 p-2 rounded-md text-sm">{hist.treatment || 'لم يتم تحديد علاج'}</p>
                            {hist.notes && <p className="text-sm text-muted mt-2">{hist.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted p-8">لا يوجد سجل تاريخ مرضي مسجل</p>
                    )}
                  </div>
                )}

                {activeTab === 'visits' && (
                  <div>
                     <h3 className="font-bold mb-4 flex items-center gap-2"><Stethoscope size={18} /> سجل الزيارات</h3>
                     {patient.visits?.length > 0 ? (
                       <table className="data-table">
                         <thead>
                           <tr>
                             <th>التاريخ</th>
                             <th>الطبيب</th>
                             <th>الشكوى الرئيسية</th>
                             <th>التشخيص</th>
                             <th>الإجراء</th>
                           </tr>
                         </thead>
                         <tbody>
                           {patient.visits.map(visit => (
                             <tr key={visit.id}>
                               <td className="en-font">{formatDate(visit.visitDate)}</td>
                               <td>{visit.doctor?.user?.name || '-'}</td>
                               <td>{visit.chiefComplaint || '-'}</td>
                               <td>{visit.diagnosis || '-'}</td>
                               <td>
                                 <button className="btn-secondary py-1 px-3 text-sm" onClick={() => { setActiveVisit(visit); setIsVisitModalOpen(true); }}>
                                   عرض التفاصيل
                                 </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     ) : (
                       <p className="text-center text-muted p-8">لا يوجد زيارات سابقة</p>
                     )}
                  </div>
                )}

                {activeTab === 'files' && (
                  <div>
                    <div className="flex-between mb-4">
                      <h3 className="font-bold flex items-center gap-2"><FileUp size={18} /> التقارير وصور الأشعة</h3>
                    </div>

                    {/* Upload Area */}
                    <div
                      className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer mb-6 transition-all"
                      style={{ borderColor: 'var(--primary-200)', backgroundColor: 'var(--primary-50)' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                       <input
                         ref={fileInputRef}
                         type="file"
                         multiple
                         accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                         style={{ display: 'none' }}
                         onChange={handleFileUpload}
                       />
                       {uploading ? (
                         <>
                           <div className="spinner mb-3"></div>
                           <p className="font-bold">جاري رفع الملفات...</p>
                         </>
                       ) : (
                         <>
                           <Upload size={36} className="text-primary-600 mb-3" />
                           <h4 className="font-bold text-lg mb-1">اضغط هنا لاختيار ملفات لرفعها</h4>
                           <p className="text-muted text-sm">يدعم: PDF, JPG, PNG, DOC (حد أقصى 10MB)</p>
                         </>
                       )}
                    </div>

                    {/* Files List */}
                    <div className="flex flex-col gap-3">
                       <h4 className="font-bold mb-2">الملفات المرفوعة ({files.length})</h4>
                       {files.length === 0 ? (
                         <p className="text-center text-muted p-4">لا يوجد ملفات مرفقة</p>
                       ) : (
                         files.map(file => (
                           <div key={file.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-center bg-surface">
                              <div className="flex items-center gap-3">
                                 <span style={{ fontSize: '1.5rem' }}>{getFileIcon(file.fileName)}</span>
                                 <div>
                                    <p className="font-bold text-sm">{file.description || file.fileName}</p>
                                    <p className="text-xs text-muted en-font">{formatDate(file.uploadedAt)}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2">
                                 <a
                                   href={file.filePath}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="icon-btn text-primary-600"
                                 >
                                   <Download size={18}/>
                                 </a>
                                 <button className="icon-btn text-danger-600" title="حذف الملف" onClick={() => handleDeleteFile(file.id)}>
                                   <Trash2 size={18}/>
                                 </button>
                               </div>
                           </div>
                         ))
                       )}
                    </div>
                  </div>
                )}
              </div>
            </div>
         </div>
      </div>

      {/* Edit Patient Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="تعديل بيانات المريض" size="lg">
        <PatientForm patient={patient} onClose={() => setIsEditModalOpen(false)} onSave={handlePatientUpdate} />
      </Modal>

      {/* Add Medical History Modal */}
      <Modal isOpen={isMedHistoryModalOpen} onClose={() => { setIsMedHistoryModalOpen(false); setEditingMedHistory(null); }} title={editingMedHistory ? "تعديل سجل مرض" : "إضافة سجل مرض"} size="md">
        <form onSubmit={handleAddMedHistory} className="flex flex-col gap-4">
          <div className="form-group">
            <label>اسم المرض / الحالة <span className="text-danger">*</span></label>
            <input type="text" value={medForm.condition} onChange={e => setMedForm({...medForm, condition: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>تاريخ التشخيص</label>
            <input type="date" value={medForm.diagnosisDate} onChange={e => setMedForm({...medForm, diagnosisDate: e.target.value})} />
          </div>
          <div className="form-group">
            <label>العلاج المتبع</label>
            <textarea value={medForm.treatment} onChange={e => setMedForm({...medForm, treatment: e.target.value})} rows="2" className="form-textarea" />
          </div>
          <div className="form-group">
            <label>ملاحظات</label>
            <textarea value={medForm.notes} onChange={e => setMedForm({...medForm, notes: e.target.value})} rows="2" className="form-textarea" />
          </div>
          <div className="modal-footer" style={{ marginTop: '1rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', marginBottom: '-1.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => { setIsMedHistoryModalOpen(false); setEditingMedHistory(null); }}>إلغاء</button>
            <button type="submit" className="btn-primary">{editingMedHistory ? 'تحديث السجل' : 'حفظ السجل'}</button>
          </div>
        </form>
      </Modal>

      {/* View Visit Modal */}
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

export default PatientProfile;
