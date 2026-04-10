import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const WhatsAppRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await api.get('/whatsapp-requests');
      setRequests(data.requests || data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!phone || !message) return;

    try {
      setSending(true);
      await api.post('/whatsapp-requests/send', { phone, message });
      setPhone('');
      setMessage('');
      fetchRequests();
      alert('تم إرسال الرسالة بنجاح');
    } catch (err) {
      alert(err.response?.data?.error || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    try {
      await api.delete(`/whatsapp-requests/${id}`);
      fetchRequests();
    } catch (err) {
      alert('فشل حذف الطلب');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCircle size={16} className="text-success-600" />;
      case 'failed': return <XCircle size={16} className="text-danger-600" />;
      default: return <Clock size={16} className="text-warning-600" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'sent': return 'تم الإرسال';
      case 'failed': return 'فشل';
      default: return 'قيد الانتظار';
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '-';
    return phone.replace('@c.us', '').replace('966', '0');
  };

  return (
    <div className="animate-fade-in pb-8">
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">طلبات الواتساب</h1>
          <p className="text-muted">إرسال رسائل واتساب للمرضى</p>
        </div>
      </div>

      {/* Send Form */}
      <div className="bg-surface rounded-xl border border-color shadow-sm mb-6 p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Send size={20} /> إرسال رسالة جديدة
        </h2>
        <form onSubmit={handleSend} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="form-label">رقم الهاتف</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              className="form-input"
              required
            />
          </div>
          <div className="flex-[2]">
            <label className="form-label">الرسالة</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="نص الرسالة..."
              className="form-input"
              rows="1"
              required
            />
          </div>
          <button type="submit" disabled={sending} className="btn-primary flex items-center gap-2">
            {sending ? 'جاري الإرسال...' : (
              <><Send size={18} /> إرسال</>
            )}
          </button>
        </form>
      </div>

      {/* Requests List */}
      <div className="bg-surface rounded-xl border border-color shadow-sm overflow-hidden">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الهاتف</th>
                <th>الرسالة</th>
                <th>الحالة</th>
                <th>تاريخ الإضافة</th>
                <th>تاريخ الإرسال</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center p-8 text-muted">جاري التحميل...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-8 text-muted">لا يوجد طلبات</td></tr>
              ) : (
                requests.map(r => (
                  <tr key={r.id}>
                    <td className="en-font font-bold">{formatPhone(r.phone)}</td>
                    <td className="max-w-xs text-truncate">{r.message}</td>
                    <td>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(r.status)}
                        <span className="text-sm">{getStatusText(r.status)}</span>
                      </span>
                    </td>
                    <td className="en-font text-sm">{formatDate(r.createdAt)}</td>
                    <td className="en-font text-sm">{r.sentAt ? formatDate(r.sentAt) : '-'}</td>
                    <td>
                      <button onClick={() => handleDelete(r.id)} className="text-danger-600 hover:underline text-sm">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppRequestsPage;