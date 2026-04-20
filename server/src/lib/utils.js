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

// =====================================================================
// Circuit Breaker لحماية النظام من الطلبات المتكررة عند تعطل Evolution API
// =====================================================================
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  threshold: 3,          // عدد الفشل المتتالي قبل فتح الدائرة
  resetTimeout: 60000,   // مدة الانتظار قبل إعادة المحاولة (60 ثانية)

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.isOpen = true;
      console.warn(`🔴 Circuit Breaker OPEN: Evolution API down. Pausing requests for ${this.resetTimeout / 1000}s`);
    }
  },

  recordSuccess() {
    if (this.failures > 0) {
      console.log('🟢 Circuit Breaker RESET: Evolution API is back online');
    }
    this.failures = 0;
    this.isOpen = false;
    this.lastFailure = 0;
  },

  canProceed() {
    if (!this.isOpen) return true;
    // تحقق هل مضت مدة كافية لإعادة المحاولة
    if (Date.now() - this.lastFailure > this.resetTimeout) {
      console.log('🟡 Circuit Breaker HALF-OPEN: Testing Evolution API...');
      return true; // السماح بمحاولة واحدة للاختبار
    }
    return false;
  },

  getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      timeSinceLastFailure: this.lastFailure ? Date.now() - this.lastFailure : null
    };
  }
};

/**
 * تنظيف وتوحيد رقم الهاتف
 * يدعم الأرقام اليمنية (967) والسعودية (966) وغيرها
 */
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

  // إزالة @s.whatsapp.net أو @c.us إن وجدت
  cleaned = cleaned.replace(/@(s\.whatsapp\.net|c\.us)$/i, '');

  // إذا بدأ بـ 00 نزيلها ونأخذ الرقم الدولي
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // إذا بدأ بـ 0 ولم يكن فيه كود دولة (أقل من 12 رقم) → افتراضي 967 (اليمن)
  if (cleaned.startsWith('0') && cleaned.length <= 10) {
    cleaned = '967' + cleaned.substring(1);
  }

  // إذا كان الرقم قصير جداً ولا يحتوي كود دولة
  if (cleaned.length <= 9 && !cleaned.startsWith('966') && !cleaned.startsWith('967')) {
    cleaned = '967' + cleaned;
  }

  return cleaned;
}

/**
 * Fetch with timeout - لمنع التعليق عند عدم رد السيرفر
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * طابور الرسائل الفاشلة لإعادة إرسالها لاحقاً
 */
const messageQueue = {
  _queue: [],
  _processing: false,
  _retryTimer: null,

  add(settings, phone, message) {
    // تجنب التكرار
    const exists = this._queue.some(m => m.phone === phone && m.message === message);
    if (exists) return;

    this._queue.push({ settings, phone, message, addedAt: Date.now(), retries: 0 });
    console.log(`📥 Message queued for later delivery to: ${phone} (Queue size: ${this._queue.length})`);

    // بدء المعالجة إذا لم تكن تعمل
    this._scheduleRetry();
  },

  _scheduleRetry() {
    if (this._retryTimer) return;
    // إعادة المحاولة بعد 90 ثانية
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this._processQueue();
    }, 90000);
  },

  async _processQueue() {
    if (this._processing || this._queue.length === 0) return;
    if (!circuitBreaker.canProceed()) {
      console.log(`⏸️ Queue processing delayed: Circuit breaker is open`);
      this._scheduleRetry();
      return;
    }

    this._processing = true;
    console.log(`📤 Processing message queue (${this._queue.length} messages)...`);

    const toProcess = [...this._queue];
    this._queue = [];

    for (const item of toProcess) {
      // تجاهل الرسائل القديمة جداً (أكثر من ساعة)
      if (Date.now() - item.addedAt > 3600000) {
        console.log(`🗑️ Discarding expired queued message to: ${item.phone}`);
        continue;
      }

      try {
        const result = await sendWhatsAppMessage(item.settings, item.phone, item.message, 2);
        if (result && result.success) {
          console.log(`✅ Queued message delivered to: ${item.phone}`);
        } else {
          item.retries++;
          if (item.retries < 3) {
            this._queue.push(item);
          } else {
            console.log(`❌ Giving up on queued message to: ${item.phone} after ${item.retries} retries`);
          }
        }
      } catch (err) {
        item.retries++;
        if (item.retries < 3) {
          this._queue.push(item);
        }
      }

      // تأخير بين الرسائل لمنع الإغراق
      await new Promise(r => setTimeout(r, 2000));
    }

    this._processing = false;

    if (this._queue.length > 0) {
      this._scheduleRetry();
    }
  },

  getQueueSize() {
    return this._queue.length;
  }
};

/**
 * إرسال رسالة واتساب عبر Evolution API مع محاولة إعادة المحاولة في حال فشل الاتصال المؤقت
 * محسّن بـ: Circuit Breaker, Timeout, Exponential Backoff, Message Queue, Media Support
 */
async function sendWhatsAppMessage(settings, phone, message, retries = 3, mediaUrl = null) {
  if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    console.log('⚠️ Evolution API settings not configured, skipping WhatsApp message');
    return null;
  }
  if (!phone) {
    console.log('⚠️ No phone number provided, skipping WhatsApp message');
    return null;
  }

  // فحص الـ Circuit Breaker
  if (!circuitBreaker.canProceed()) {
    console.log(`⏸️ Circuit Breaker is OPEN. Queuing message to: ${phone}`);
    messageQueue.add(settings, phone, message); // Currently mediaUrl is not queued to keep it simple
    return { success: false, error: 'Circuit breaker open', queued: true };
  }

  // تنظيف رقم الجوال بشكل موحد
  let cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) {
    console.log('⚠️ Invalid phone number, skipping WhatsApp message');
    return null;
  }

  let evolutionUrl = settings.evolutionApiUrl;
  if (!evolutionUrl.startsWith('http')) {
    evolutionUrl = 'https://' + evolutionUrl;
  }
  evolutionUrl = evolutionUrl.replace(/\/$/, '');
  
  const endpoint = mediaUrl 
    ? `${evolutionUrl}/message/sendMedia/${settings.evolutionInstanceName}`
    : `${evolutionUrl}/message/sendText/${settings.evolutionInstanceName}`;
    
  const payload = mediaUrl 
    ? {
        number: cleanPhone,
        mediatype: "image",
        mimetype: "image/jpeg", // Added for compatibility with strict Evolution API endpoints
        media: mediaUrl,
        caption: message || ''
      }
    : {
        number: cleanPhone,
        text: message || ''
      };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.evolutionApiKey
          },
          body: JSON.stringify(payload)
        },
        20000 // 20 ثانية timeout
      );

      // محاولة قراءة الرد بشكل آمن لمنع الانهيار عند استلام نص (Non-JSON)
      let data;
      const responseText = await response.text();
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        data = { message: responseText || 'Empty response' };
        if (responseText && !responseText.includes('<!DOCTYPE')) {
          console.warn('⚠️ Received non-JSON response from Evolution API:', responseText.substring(0, 100));
        }
      }

      if (response.ok) {
        circuitBreaker.recordSuccess();
        console.log(`✅ WhatsApp message sent to: ${phone} (Attempt ${i + 1})`);
        return { success: true, data };
      }

      console.error(`❌ Attempt ${i + 1} failed (HTTP ${response.status}):`, typeof data === 'object' ? JSON.stringify(data).substring(0, 150) : data);
      
      // 🔄 خطأ 4xx (خطأ في الطلب، مثال 400 Bad Request)
      if (response.status >= 400 && response.status < 500 && response.status !== 404) {
         console.log(`❌ Client Error (HTTP ${response.status}). NOT retrying to avoid hanging.`);
         return { success: false, error: data.message || `Client error (${response.status})`, queued: false };
      }
      
      // 🔄 خطأ 503 (خادم مشغول) مع backoff تصاعدي
      if (response.status === 503) {
        circuitBreaker.recordFailure();

        if (i < retries - 1) {
          // Exponential backoff مع jitter عشوائي
          const baseWait = Math.min(5000 * Math.pow(2, i), 30000);
          const jitter = Math.random() * 2000;
          const waitTime = baseWait + jitter;
          console.log(`⏳ Server Busy (503). Retrying in ${(waitTime/1000).toFixed(1)}s... (attempt ${i + 2}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // خطأ جلسة (منفصلة / غير موجودة)
      const errorMsg = (data.message || '').toLowerCase();
      const isSessionError = errorMsg.includes('closed') || errorMsg.includes('instancenotfound') || errorMsg.includes('disconnected') || response.status === 404;
      
      if (isSessionError && i < retries - 1) {
        console.log(`🔁 Session error detected. Triggering silent reconnect for [${settings.evolutionInstanceName}]...`);
        fetchWithTimeout(
          `${evolutionUrl}/instance/connect/${settings.evolutionInstanceName}`,
          { headers: { 'apikey': settings.evolutionApiKey } },
          10000
        ).catch(e => console.error('Silent reconnect trigger failed:', e.message));
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else if (i < retries - 1) {
        // خطأ عام → انتظار قبل المحاولة التالية
        await new Promise(resolve => setTimeout(resolve, 3000 * (i + 1)));
      }
    } catch (err) {
      // خطأ شبكة أو timeout
      const isTimeout = err.name === 'AbortError';
      console.error(`❌ Attempt ${i + 1} ${isTimeout ? 'TIMEOUT' : 'error'}:`, err.message);
      
      if (isTimeout || err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        circuitBreaker.recordFailure();
      }

      if (i < retries - 1) {
        const waitTime = Math.min(3000 * Math.pow(2, i), 20000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // آخر محاولة فشلت → إضافة للطابور
        messageQueue.add(settings, phone, message);
        return { success: false, error: err.message, queued: true };
      }
    }
  }

  // كل المحاولات فشلت → إضافة للطابور
  messageQueue.add(settings, phone, message);
  return { success: false, error: 'Maximum retries reached', queued: true };
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
  sendWhatsAppMessage,
  cleanPhoneNumber,
  fetchWithTimeout,
  circuitBreaker,
  messageQueue
};
