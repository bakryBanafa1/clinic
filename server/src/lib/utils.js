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
  consecutive503s: 0,     // عداد الـ 503 تحديداً
  threshold: 3,            // عدد الفشل المتتالي قبل فتح الدائرة
  resetTimeout: 90000,      // مدة الانتظار (90 ثانية - أكثر استقراراً)
  halfOpenTested: false,     // هل تم اختبار HALF-OPEN بنجاح

  recordFailure(is503 = false) {
    this.lastFailure = Date.now();
    if (is503) {
      this.consecutive503s++;
      // تجاهل الـ 503 المتفرقة (حتى 2 متتالية)
      if (this.consecutive503s <= 2) {
        console.log(`⏳ Evolution API busy (503). Count: ${this.consecutive503s}`);
        return;
      }
    }
    this.consecutive503s = 0;
    this.failures++;
    if (this.failures >= this.threshold) {
      this.isOpen = true;
      this.halfOpenTested = false;
      console.warn(`🔴 Circuit Breaker OPEN: Evolution API down. Pausing for ${this.resetTimeout / 1000}s`);
    }
  },

  recordSuccess() {
    this.consecutive503s = 0;
    if (this.failures > 0 || this.isOpen) {
      console.log('🟢 Circuit Breaker RESET: Evolution API is back online');
    }
    this.failures = 0;
    this.isOpen = false;
    this.lastFailure = 0;
    this.halfOpenTested = true;
  },

  canProceed() {
    if (!this.isOpen) return true;
    // إذا كان HALF-OPEN وتم اختباره سابقاً بنجاح، انتظر الدورة كاملة
    if (this.halfOpenTested && this.isOpen) {
      return false;
    }
    // تحقق هل مضت مدة كافية لإعادة المحاولة
    if (Date.now() - this.lastFailure > this.resetTimeout) {
      console.log('🟡 Circuit Breaker HALF-OPEN: Testing...');
      return true;
    }
    return false;
  },

  getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      consecutive503s: this.consecutive503s,
      timeSinceLastFailure: this.lastFailure ? Date.now() - this.lastFailure : null,
      remainingMs: this.lastFailure ? this.resetTimeout - (Date.now() - this.lastFailure) : 0
    };
  },

  // إعادة تعيين كامل (للاختبار اليدوي)
  reset() {
    this.failures = 0;
    this.lastFailure = 0;
    this.isOpen = false;
    this.consecutive503s = 0;
    this.halfOpenTested = false;
    console.log('🔄 Circuit Breaker manually reset');
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
 * محسّن: دعم mediaUrl, تأخير أطول, retry logic محسّن
 */
const messageQueue = {
  _queue: [],
  _processing: false,
  _retryTimer: null,

  add(settings, phone, message, mediaUrl = null) {
    if (!settings || !phone) return;

    // تجنب التكرار الكامل خلال 5 دقائق
    const fiveMinAgo = Date.now() - 300000;
    const exists = this._queue.some(m =>
      m.phone === phone && m.message === message && m.addedAt > fiveMinAgo
    );
    if (exists) {
      console.log(`📋 [Queue] Duplicate message skipped for: ${phone}`);
      return;
    }

    // حد أقصى 50 رسالة في الطابور
    if (this._queue.length >= 50) {
      console.warn(`⚠️ [Queue] Full (${this._queue.length}). Discarding oldest messages.`);
      this._queue.shift();
    }

    this._queue.push({ settings, phone, message, mediaUrl, addedAt: Date.now(), retries: 0 });
    console.log(`📥 [Queue] Message added for: ${phone} (Queue: ${this._queue.length})`);

    this._scheduleRetry();
  },

  _scheduleRetry() {
    if (this._retryTimer) return;
    // إعادة المحاولة بعد 2 دقيقة (بدلاً من 90 ثانية)
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this._processQueue();
    }, 120000);
  },

  async _processQueue() {
    if (this._processing || this._queue.length === 0) return;
    if (!circuitBreaker.canProceed()) {
      console.log(`⏸️ [Queue] Blocked by circuit breaker. Rescheduling...`);
      this._scheduleRetry();
      return;
    }

    this._processing = true;
    console.log(`📤 [Queue] Processing ${this._queue.length} messages...`);

    const toProcess = [...this._queue];
    this._queue = [];

    for (const item of toProcess) {
      // تجاهل الرسائل القديمة جداً (أكثر من 4 ساعات)
      if (Date.now() - item.addedAt > 14400000) {
        console.log(`🗑️ [Queue] Discarding expired message to: ${item.phone}`);
        continue;
      }

      try {
        const result = await sendWhatsAppMessage(item.settings, item.phone, item.message, 2, item.mediaUrl);
        if (result && result.success) {
          console.log(`✅ [Queue] Delivered to: ${item.phone}`);
        } else if (result && result.queued) {
          // فشل وأُعيد للطابور
          item.retries++;
          if (item.retries < 3) {
            this._queue.push(item);
          } else {
            console.log(`❌ [Queue] Giving up on: ${item.phone} (${item.retries} retries)`);
          }
        } else {
          // خطأ client (لا يُعاد)
          console.log(`❌ [Queue] Non-retryable error for: ${item.phone}`);
        }
      } catch (err) {
        item.retries++;
        if (item.retries < 3) {
          this._queue.push(item);
        }
      }

      // تأخير بين الرسائل
      await new Promise(r => setTimeout(r, 3000));
    }

    this._processing = false;

    if (this._queue.length > 0) {
      this._scheduleRetry();
    }
  },

  getQueueSize() {
    return this._queue.length;
  },

  // للمراقبة
  getStatus() {
    return {
      size: this._queue.length,
      processing: this._processing,
      items: this._queue.map(m => ({
        phone: m.phone,
        age: Math.round((Date.now() - m.addedAt) / 1000) + 's ago',
        retries: m.retries
      }))
    };
  },

  // مسح الطابور
  clear() {
    this._queue = [];
    console.log('🗑️ [Queue] Cleared');
  }
};

/**
 * إرسال رسالة واتساب عبر Evolution API مع محاولة إعادة المحاولة في حال فشل الاتصال المؤقت
 * محسّن بـ: Circuit Breaker, Timeout, Exponential Backoff, Message Queue, Media Support
 */
async function sendWhatsAppMessage(settings, phone, message, retries = 3, mediaUrl = null) {
  // التحقق من الإعدادات الأساسية
  if (!settings) {
    console.log('⚠️ [WhatsApp] No settings provided, skipping message');
    return { success: false, error: 'Missing settings', queued: false };
  }
  if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    console.log('⚠️ [WhatsApp] Evolution API settings incomplete, skipping message');
    return { success: false, error: 'Evolution API not configured', queued: false };
  }
  if (!phone) {
    console.log('⚠️ [WhatsApp] No phone number provided, skipping message');
    return { success: false, error: 'No phone number', queued: false };
  }
  if (!message && !mediaUrl) {
    console.log('⚠️ [WhatsApp] No message or media provided, skipping');
    return { success: false, error: 'No content', queued: false };
  }

  // فحص الـ Circuit Breaker
  if (!circuitBreaker.canProceed()) {
    const status = circuitBreaker.getStatus();
    console.log(`⏸️ [WhatsApp] Circuit Breaker OPEN. Queuing message to: ${phone} (remaining: ${Math.ceil(status.remainingMs/1000)}s)`);
    messageQueue.add(settings, phone, message, mediaUrl);
    return { success: false, error: 'Circuit breaker open', queued: true };
  }

  // تنظيف رقم الجوال بشكل موحد
  let cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) {
    console.log(`⚠️ [WhatsApp] Invalid phone number: "${phone}", skipping`);
    return { success: false, error: 'Invalid phone number', queued: false };
  }

  let evolutionUrl = settings.evolutionApiUrl;
  if (!evolutionUrl.startsWith('http')) {
    evolutionUrl = 'https://' + evolutionUrl;
  }
  evolutionUrl = evolutionUrl.replace(/\/$/, '');

  const instanceName = settings.evolutionInstanceName;
  const endpoint = mediaUrl
    ? `${evolutionUrl}/message/sendMedia/${instanceName}`
    : `${evolutionUrl}/message/sendText/${instanceName}`;

  const payload = mediaUrl
    ? {
        number: cleanPhone,
        mediatype: "image",
        mimetype: "image/jpeg",
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
        20000
      );

      let data;
      const responseText = await response.text();

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        data = { message: responseText || 'Empty response' };
      }

      if (response.ok) {
        circuitBreaker.recordSuccess();
        console.log(`✅ [WhatsApp] Message sent to ${cleanPhone} (attempt ${i + 1})`);
        return { success: true, data };
      }

      // خطأ 503 - خادم مشغول (مشكلة مؤقتة)
      if (response.status === 503) {
        circuitBreaker.recordFailure(true);

        if (i < retries - 1) {
          const waitTime = Math.min(5000 * Math.pow(2, i), 30000);
          console.log(`⏳ [WhatsApp] Server busy (503). Retrying in ${waitTime/1000}s... (${i + 2}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // خطأ 4xx (عدا 404)
      if (response.status >= 400 && response.status < 500 && response.status !== 404) {
        console.error(`❌ [WhatsApp] Client error (HTTP ${response.status}): ${JSON.stringify(data).substring(0, 100)}`);
        return { success: false, error: data.message || `Client error (${response.status})`, queued: false };
      }

      // خطأ 404 أو خطأ جلسة
      const errorMsg = (data.message || '').toLowerCase();
      const isSessionError = errorMsg.includes('closed') || errorMsg.includes('instancenotfound') || errorMsg.includes('disconnected') || response.status === 404;

      if (isSessionError) {
        console.warn(`⚠️ [WhatsApp] Session error (${response.status}): ${errorMsg.substring(0, 80)}`);
        circuitBreaker.recordFailure();

        if (i < retries - 1) {
          // محاولة إعادة الربط
          console.log(`🔁 [WhatsApp] Attempting reconnect for [${instanceName}]...`);
          fetchWithTimeout(
            `${evolutionUrl}/instance/connect/${instanceName}`,
            { headers: { 'apikey': settings.evolutionApiKey } },
            10000
          ).catch(e => console.warn(`⚠️ [WhatsApp] Reconnect failed: ${e.message}`));

          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
      }

      // أخطاء أخرى
      console.error(`❌ [WhatsApp] Attempt ${i + 1} failed (HTTP ${response.status}): ${JSON.stringify(data).substring(0, 100)}`);
      circuitBreaker.recordFailure();

      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000 * (i + 1)));
      }
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      console.error(`❌ [WhatsApp] Attempt ${i + 1} ${isTimeout ? 'TIMEOUT' : 'error'}: ${err.message}`);

      if (isTimeout || err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        circuitBreaker.recordFailure();
      }

      if (i < retries - 1) {
        const waitTime = Math.min(3000 * Math.pow(2, i), 20000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.log(`📥 [WhatsApp] Adding to queue: ${cleanPhone}`);
        messageQueue.add(settings, phone, message, mediaUrl);
        return { success: false, error: err.message, queued: true };
      }
    }
  }

  // كل المحاولات فشلت
  console.log(`📥 [WhatsApp] Max retries reached. Queueing: ${cleanPhone}`);
  messageQueue.add(settings, phone, message, mediaUrl);
  return { success: false, error: 'Maximum retries reached', queued: true };
}

// =====================================================================
// WhatsApp Cloud API (Meta) - Send Message
// =====================================================================
async function sendWhatsAppCloudMessage(settings, phone, message, mediaUrl = null, templateName = null) {
  if (!settings?.whatsappCloudEnabled) {
    return { success: false, error: 'WhatsApp Cloud غير مفعّل' };
  }

  if (!settings.whatsappCloudApiKey || !settings.whatsappCloudPhoneId) {
    return { success: false, error: 'إعدادات WhatsApp Cloud غير مكتملة' };
  }

  if (!phone) {
    return { success: false, error: 'رقم الهاتف مطلوب' };
  }

  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) {
    return { success: false, error: 'رقم الهاتف غير صالح' };
  }

  const apiUrl = 'https://graph.facebook.com/v18.0';

  try {
    // If template is specified, use template message
    if (templateName) {
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'ar' }
        }
      };

      const response = await fetchWithTimeout(
        `${apiUrl}/${settings.whatsappCloudPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.whatsappCloudApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        20000
      );

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ [WhatsApp Cloud] Template message sent to ${cleanPhone}`);
        return { success: true, messageId: data.messages?.[0]?.id };
      } else {
        console.error(`❌ [WhatsApp Cloud] Template error:`, data);
        return { success: false, error: data.error?.message || 'فشل إرسال القالب' };
      }
    }

    // Text message
    if (mediaUrl) {
      // Media message with caption
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'image',
        image: {
          link: mediaUrl,
          caption: message || ''
        }
      };

      const response = await fetchWithTimeout(
        `${apiUrl}/${settings.whatsappCloudPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.whatsappCloudApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        20000
      );

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ [WhatsApp Cloud] Media message sent to ${cleanPhone}`);
        return { success: true, messageId: data.messages?.[0]?.id };
      } else {
        return { success: false, error: data.error?.message };
      }
    } else {
      // Simple text message
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: message }
      };

      const response = await fetchWithTimeout(
        `${apiUrl}/${settings.whatsappCloudPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.whatsappCloudApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        20000
      );

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ [WhatsApp Cloud] Message sent to ${cleanPhone}`);
        return { success: true, messageId: data.messages?.[0]?.id };
      } else {
        console.error(`❌ [WhatsApp Cloud] Error:`, data);
        return { success: false, error: data.error?.message || 'فشل إرسال الرسالة' };
      }
    }
  } catch (err) {
    console.error('❌ [WhatsApp Cloud] Exception:', err);
    return { success: false, error: err.message };
  }
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
  sendWhatsAppCloudMessage,
  cleanPhoneNumber,
  fetchWithTimeout,
  circuitBreaker,
  messageQueue
};
