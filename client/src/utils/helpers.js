export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-CA') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '0';
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ر.س';
};

export const getStatusText = (status) => {
  const map = {
    // Appointment statuses
    pending: 'بانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    checked_in: 'وصل',
    no_show: 'لم يحضر',
    // Billing statuses
    paid: 'مدفوعة',
    partial: 'مدفوع جزئياً',
    unpaid: 'غير مدفوعة',
    refunded: 'مسترجعة',
    // Follow-up statuses
    reminded: 'تم التذكير',
    missed: 'فائت',
    // Queue statuses
    waiting: 'في الانتظار',
    in_progress: 'في العيادة',
    done: 'انتهى',
    // Generic
    active: 'نشط',
    inactive: 'غير نشط',
  };
  return map[status] || status;
};

export const getStatusColor = (status) => {
  const colors = {
    // Appointment
    pending: '#f59e0b',
    confirmed: '#0ea5e9',
    completed: '#22c55e',
    cancelled: '#ef4444',
    checked_in: '#8b5cf6',
    no_show: '#64748b',
    // Billing
    paid: '#22c55e',
    partial: '#f59e0b',
    unpaid: '#ef4444',
    refunded: '#8b5cf6',
    // Follow-up
    reminded: '#0ea5e9',
    missed: '#ef4444',
    // Queue
    waiting: '#f59e0b',
    in_progress: '#0ea5e9',
    done: '#22c55e',
    // Generic
    active: '#22c55e',
    inactive: '#94a3b8',
  };
  return colors[status] || '#64748b';
};

export const getGenderText = (gender) => {
  if (gender === 'male') return 'ذكر';
  if (gender === 'female') return 'أنثى';
  return 'غير محدد';
};

export const getRoleText = (role) => {
  const roles = {
    admin: 'مدير النظام',
    doctor: 'طبيب',
    receptionist: 'موظف استقبال',
    nurse: 'ممرض/ة',
  };
  return roles[role] || role;
};

export const getBloodTypeDisplay = (bloodType) => {
  return bloodType || 'غير محدد';
};

export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return formatDate(dateStr);
};
