import React, { useState, useEffect } from 'react';
import { Search, Plus, FileText, UserPlus, FileEdit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import Modal from '../../components/ui/Modal';
import PatientForm from '../../components/patients/PatientForm';
import './Patients.css';

const PatientsList = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatients();
  }, [search]);

  const fetchPatients = async () => {
    try {
      const data = await api.get(`/patients?search=${search}`);
      setPatients(data.patients || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getGenderTextLocal = (g) => {
    return g === 'male' ? 'ذكر' : g === 'female' ? 'أنثى' : 'غير محدد';
  };

  const handleSavePatient = () => {
    setIsModalOpen(false);
    setEditingPatient(null);
    fetchPatients();
  };

  const handleOpenAdd = () => {
    setEditingPatient(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e, patient) => {
    e.stopPropagation();
    setEditingPatient(patient);
    setIsModalOpen(true);
  };

  const handleDelete = async (e, patient) => {
    e.stopPropagation();
    if (!confirm(`هل أنت متأكد من حذف المريض "${patient.name}"؟\nسيتم حذف جميع البيانات المرتبطة.`)) return;
    try {
      await api.delete(`/patients/${patient.id}`);
      fetchPatients();
    } catch (err) {
      alert(err.message || 'خطأ في حذف المريض - قد تكون هناك بيانات مرتبطة');
    }
  };

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">المرضى</h1>
          <p className="text-muted">إدارة بيانات المرضى والملفات الطبية</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={handleOpenAdd}>
          <UserPlus size={18} />
          <span>إضافة مريض جديد</span>
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-color shadow-sm overflow-hidden">
        <div className="p-4 border-b border-color flex justify-between items-center bg-gray-50">
          <div className="search-input-wrapper">
             <Search size={18} className="text-muted" />
             <input 
               type="text" 
               placeholder="ابحث بالاسم، رقم الملف..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الملف</th>
                <th>اسم المريض</th>
                <th>رقم الجوال</th>
                <th>الجنس</th>
                <th>تاريخ الميلاد</th>
                <th>الزيارات</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">جاري التحميل...</td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted">لم يتم العثور على مرضى</td></tr>
              ) : (
                patients.map(patient => (
                  <tr key={patient.id} onClick={() => navigate(`/patients/${patient.id}`)} className="cursor-pointer">
                    <td className="font-medium text-primary"><span className="en-font">{patient.fileNumber}</span></td>
                    <td className="font-bold">{patient.name}</td>
                    <td className="en-font">{patient.phone || '-'}</td>
                    <td>{getGenderTextLocal(patient.gender)}</td>
                    <td className="en-font">{patient.dateOfBirth || '-'}</td>
                    <td className="en-font">{patient._count?.visits || 0}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="action-btn text-primary" title="عرض الملف" onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}>
                          <FileText size={18} />
                        </button>
                        <button className="action-btn text-warning" title="تعديل" onClick={(e) => handleOpenEdit(e, patient)}>
                          <FileEdit size={18} />
                        </button>
                        <button className="action-btn text-danger" title="حذف" onClick={(e) => handleDelete(e, patient)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingPatient(null); }} title={editingPatient ? "تعديل بيانات المريض" : "إضافة مريض جديد"} size="lg">
        <PatientForm patient={editingPatient} onClose={() => { setIsModalOpen(false); setEditingPatient(null); }} onSave={handleSavePatient} />
      </Modal>
    </div>
  );
};

export default PatientsList;
