const { format, addDays, parseISO, isToday, isBefore, startOfDay } = require('date-fns');

function generateFileNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P${year}${month}${random}`;
}

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}${month}${day}-${random}`;
}

function formatDate(date) {
  return format(new Date(date), 'yyyy-MM-dd');
}

function getDayOfWeek(date) {
  return new Date(date).getDay();
}

function calculateFollowUpDate(visitDate, daysAfter) {
  return format(addDays(new Date(visitDate), daysAfter), 'yyyy-MM-dd');
}

function calculateReminderDate(followUpDate, daysBefore = 1) {
  return format(addDays(parseISO(followUpDate), -daysBefore), 'yyyy-MM-dd');
}

function isDateToday(dateStr) {
  return isToday(parseISO(dateStr));
}

function isDatePast(dateStr) {
  return isBefore(parseISO(dateStr), startOfDay(new Date()));
}

/**
 * استبدال المتغيرات في قالب الرسالة بالقيم الفعلية
 * @param {string} template - نص القالب مع المتغيرات مثل {اسم_المريض}
 * @param {object} variables - كائن يحتوي على القيم { اسم_المريض: 'أحمد', ... }
 * @returns {string} النص النهائي بعد الاستبدال
 */
function renderTemplate(template, variables = {}) {
  if (!template) return '';
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

/**
 * إرسال رسالة واتساب عبر Evolution API مع محاولة إعادة المحاولة في حال فشل الاتصال المؤقت
 */
async function sendWhatsAppMessage(settings, phone, message, retries = 3) {
  if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    console.log('⚠️ Evolution API settings not configured, skipping WhatsApp message');
    return null;
  }
  if (!phone) {
    console.log('⚠️ No phone number provided, skipping WhatsApp message');
    return null;
  }

  // تنظيف رقم الجوال
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '966' + cleanPhone.substring(1); // افتراضي السعودية
  }
  if (!cleanPhone.includes('@')) {
    cleanPhone = cleanPhone + '@s.whatsapp.net';
  }

  let evolutionUrl = settings.evolutionApiUrl;
  if (!evolutionUrl.startsWith('http')) {
    evolutionUrl = 'https://' + evolutionUrl;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${evolutionUrl}/message/sendText/${settings.evolutionInstanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.evolutionApiKey
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message
        })
      });

      // محاولة قراءة الرد بشكل آمن لمنع الانهيار عند استلام نص (Non-JSON)
      const contentType = response.headers.get('content-type');
      let data;
      const responseText = await response.text();
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        data = { message: responseText || 'Empty response' };
        console.warn('⚠️ Received non-JSON response from Evolution API:', responseText.substring(0, 100));
      }

      if (response.ok) {
        console.log(`✅ WhatsApp message sent to: ${phone} (Attempt ${i + 1})`);
        return { success: true, data };
      }

      console.error(`❌ Attempt ${i + 1} failed (HTTP ${response.status}):`, data);
      
      // 🔄 ميزة الإصلاح الذاتي ومواجهة 503 (خادم مشغول)
      if (response.status === 503 || (data.message && data.message.includes('server'))) {
        const waitTime = (i + 1) * 5000; // 5s, 10s, 15s...
        console.log(`⏳ External Server Busy (503). Retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const errorMsg = (data.message || '').toLowerCase();
      const isSessionError = errorMsg.includes('closed') || errorMsg.includes('instancenotfound') || errorMsg.includes('disconnected') || response.status === 404;
      
      if (isSessionError && i < retries - 1) {
        console.log(`🔁 Session error detected. Triggering silent reconnect for [${settings.evolutionInstanceName}]...`);
        fetch(`${evolutionUrl}/instance/connect/${settings.evolutionInstanceName}`, {
           headers: { 'apikey': settings.evolutionApiKey }
        }).catch(e => console.error('Silent reconnect trigger failed:', e.message));
        
        await new Promise(resolve => setTimeout(resolve, 4000));
      } else if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (err) {
      console.error(`❌ Attempt ${i + 1} error:`, err.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 3000));
      } else {
        return { success: false, error: err.message };
      }
    }
  }
  return { success: false, error: 'Maximum retries reached' };
}

module.exports = {
  generateFileNumber,
  generateInvoiceNumber,
  formatDate,
  getDayOfWeek,
  calculateFollowUpDate,
  calculateReminderDate,
  isDateToday,
  isDatePast,
  renderTemplate,
  sendWhatsAppMessage
};
