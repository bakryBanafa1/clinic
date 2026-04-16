const API_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('clinic_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  // If body is FormData, remove Content-Type so browser sets it with boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('clinic_token');
    localStorage.removeItem('clinic_user');
    window.location.href = '/login';
    throw new Error('انتهت الجلسة، يرجى تسجيل الدخول مجدداً');
  }

  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    if (!response.ok) {
      throw new Error(`خطأ في الاتصال بالخادم (${response.status}). يرجى التأكد من تشغيل Backend.`);
    }
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || 'حدث خطأ غير معروف');
  }

  return data;
}

export const api = {
  get: (endpoint) => fetchWithAuth(endpoint),
  post: (endpoint, body) => fetchWithAuth(endpoint, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (endpoint, body) => fetchWithAuth(endpoint, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: (endpoint) => fetchWithAuth(endpoint, { method: 'DELETE' }),
};

export default api;
