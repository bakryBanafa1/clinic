import React, { useState, useEffect, useRef } from 'react';
import { Search, Receipt, Printer, Plus } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../utils/api';
import { formatDate, formatCurrency, getStatusText, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/ui/Modal';

const BillingPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    fetchInvoices();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const data = await api.get('/billing');
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (id, invoice) => {
    try {
      await api.put(`/billing/${id}`, { 
        paidAmount: invoice.total,
        paymentMethod: 'cash'
      });
      fetchInvoices();
    } catch (err) {
      alert('خطأ في الدفع');
    }
  };

  const openPrintModal = async (invoice) => {
    try {
      const fullInvoice = await api.get(`/billing/${invoice.id}`);
      setSelectedInvoice(fullInvoice);
      setIsPrintModalOpen(true);
    } catch (err) {
      setSelectedInvoice(invoice);
      setIsPrintModalOpen(true);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `فاتورة_${selectedInvoice?.invoiceNumber}`,
  });

  const parseItems = (items) => {
    if (!items) return [];
    if (typeof items === 'string') {
      try { return JSON.parse(items); } catch { return []; }
    }
    return items;
  };

  const filteredInvoices = invoices.filter(inv =>
    (inv.patient?.name || '').includes(search) ||
    (inv.invoiceNumber || '').includes(search)
  );

  const currency = settings?.currency || window.clinicCurrency || 'ر.ي';

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">المالية والفواتير</h1>
          <p className="text-muted">إدارة مدفوعات المرضى والمطالبات المالية</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-color shadow-sm mb-6 overflow-hidden">
        <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-color">
          <div className="search-input-wrapper">
             <Search size={18} className="text-muted" />
             <input 
               type="text" 
               placeholder="ابحث برقم الفاتورة أو اسم المريض..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table cellSpacing={0} cellPadding={0} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to bottom, #3b82f6, #2563eb)', height: '45px' }}>
                <th style={{ padding: '12px', textAlign: 'right', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600' }}>رقم الفاتورة</th>
                <th style={{ padding: '12px', textAlign: 'right', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600' }}>اسم المريض</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600', width: '90px' }}>التاريخ</th>
                
                <th style={{ padding: '12px', textAlign: 'right', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600', width: '100px' }}>المبلغ الفرعي</th>
                <th style={{ padding: '12px', textAlign: 'right', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600', width: '70px' }}>الخصم</th>
                <th style={{ padding: '12px', textAlign: 'right', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600', width: '100px' }}>الإجمالي</th>
                <th style={{ padding: '12px', textAlign: 'right', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600', width: '100px' }}>المدفوع</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600', width: '90px' }}>الحالة</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'white', borderBottom: '3px solid #1d4ed8', fontWeight: '600', width: '100px' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', fontSize: '16px', color: '#6b7280' }}>جاري التحميل...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', fontSize: '16px', color: '#6b7280' }}>📋 لا يوجد فواتير</td></tr>
              ) : (
                filteredInvoices.map((inv, idx) => (
                  <tr key={inv.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc', height: '40px', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}><b style={{ color: '#2563eb', fontSize: '14px' }}>{inv.invoiceNumber}</b></td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 'bold' }}>{inv.patient?.name || 'غير معروف'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>{formatDate(inv.date)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace' }}>{Number(inv.subtotal).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: inv.discount > 0 ? '#dc2626' : '#94a3b8' }}>{inv.discount || '-'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#2563eb', fontFamily: 'monospace', fontSize: '14px' }}>{Number(inv.total).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', color: '#059669' }}>{Number(inv.paidAmount).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', color: 'white', backgroundColor: getStatusColor(inv.paymentStatus), boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        {getStatusText(inv.paymentStatus)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      {inv.paymentStatus !== 'paid' && (
                        <button onClick={() => handlePay(inv.id, inv)} style={{ padding: '5px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', boxShadow: '0 2px 4px rgba(16,185,129,0.3)', marginRight: '4px' }}>دفع</button>
                      )}
                      <button onClick={() => openPrintModal(inv)} style={{ padding: '5px 8px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>🖨️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="معاينة الفاتورة للطباعة" size="md">
        {selectedInvoice && (
          <div className="flex flex-col gap-4">
             <div ref={printRef} className="print-container p-8 bg-white text-black" style={{ direction: 'rtl', border: '1px solid #ddd', minHeight: '400px' }}>
                <div className="text-center border-b pb-4 mb-6" style={{ borderBottomWidth: '2px' }}>
                   <h2 className="text-2xl font-bold mb-1">{settings?.clinicName || 'العيادة'}</h2>
                   <p className="text-gray-500">فاتورة ضريبية مبسطة</p>
                   {settings?.address && <p className="text-gray-400 text-sm">{settings.address} - {settings?.city}</p>}
                </div>

                <div className="flex justify-between mb-6 text-sm">
                   <div>
                      <p>رقم الفاتورة: <b className="en-font">{selectedInvoice.invoiceNumber}</b></p>
                      <p>التاريخ: <b className="en-font">{formatDate(selectedInvoice.date)}</b></p>
                   </div>
                   <div>
                      <p>المريض: <b>{selectedInvoice.patient?.name}</b></p>
                      <p>رقم الملف: <b className="en-font">{selectedInvoice.patient?.fileNumber}</b></p>
                   </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                   <thead>
                     <tr style={{ borderBottom: '2px solid black' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>#</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>البيان</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>الكمية</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>سعر الوحدة</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>المبلغ</th>
                     </tr>
                   </thead>
                   <tbody>
                     {parseItems(selectedInvoice.items).map((item, idx) => (
                       <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }} className="en-font">{idx + 1}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.description}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }} className="en-font">{item.quantity}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }} className="en-font">{item.unitPrice} {currency}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }} className="en-font">{item.total || (item.quantity * item.unitPrice)} {currency}</td>
                       </tr>
                     ))}
                   </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                   <div style={{ width: '16rem' }}>
                      <div className="flex justify-between py-1 border-b">
                         <span>المجموع الفرعي</span>
                         <span className="en-font">{selectedInvoice.subtotal} {currency}</span>
                      </div>
                      {selectedInvoice.discount > 0 && (
                        <div className="flex justify-between py-1 border-b">
                           <span>الخصم</span>
                           <span className="en-font text-danger">-{selectedInvoice.discount} {currency}</span>
                        </div>
                      )}
                      {selectedInvoice.tax > 0 && (
                        <div className="flex justify-between py-1 border-b">
                           <span>الضريبة</span>
                           <span className="en-font">{selectedInvoice.tax} {currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 text-lg font-bold">
                         <span>الإجمالي</span>
                         <span className="en-font">{selectedInvoice.total} {currency}</span>
                      </div>
                      <div className="flex justify-between py-1" style={{ borderTop: '1px dashed #ccc' }}>
                         <span>المدفوع</span>
                         <span className="en-font text-success-600">{selectedInvoice.paidAmount} {currency}</span>
                      </div>
                      {(selectedInvoice.total - selectedInvoice.paidAmount) > 0 && (
                        <div className="flex justify-between py-1 font-bold text-danger">
                           <span>المتبقي</span>
                           <span className="en-font">{(selectedInvoice.total - selectedInvoice.paidAmount).toFixed(2)} {currency}</span>
                        </div>
                      )}
                   </div>
                </div>

                <div className="text-center mt-12 text-sm text-gray-500">
                   <p>نتمنى لكم دوام الصحة والعافية</p>
                   {settings?.phone && <p className="en-font mt-1">📞 {settings.phone}</p>}
                </div>
             </div>

             <div className="flex justify-end gap-2 mt-4">
                <button className="btn-secondary" onClick={() => setIsPrintModalOpen(false)}>إغلاق</button>
                <button className="btn-primary" onClick={() => handlePrint()}>
                   <Printer size={18}/> طباعة الفاتورة
                </button>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BillingPage;