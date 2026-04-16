# إعدادات إشعارات الواتساب + توثيق Evolution API

تطوير صفحة ربط الواتساب لتشمل نظام إشعارات احترافي مع قوالب نصوص قابلة للتخصيص، وإضافة تبويب توثيق كامل لجميع نقاط Evolution API v2.

## المقترحات الاحترافية 💡

بالإضافة لما طلبته، أقترح الإضافات التالية لجعل النظام احترافي:

| المقترح | الوصف |
|---------|-------|
| 🎂 **تهنئة عيد الميلاد** | إرسال تهنئة تلقائية للمريض في يوم ميلاده |
| 📅 **تذكير قبل الموعد العادي** | تذكير المريض بموعده القادم (قبل بيوم مثلاً) |
| 🙏 **شكر بعد الزيارة** | رسالة شكر تلقائية بعد انتهاء الزيارة |
| 👀 **معاينة الرسالة** | زر لمعاينة شكل الرسالة النهائية قبل الحفظ |
| 🏷️ **متغيرات متعددة** | ليس فقط اسم المريض، بل أيضاً اسم الطبيب، تاريخ الموعد، اسم العيادة |
| ⏰ **تحكم بيوم التذكير** | خانة لتحديد قبل كم يوم يُرسل التذكير (1، 2، 3 أيام...) |
| 🔄 **تفعيل/تعطيل كل إشعار** | مفتاح تشغيل لكل نوع إشعار بشكل مستقل |

### المتغيرات المتاحة في القوالب:
- `{اسم_المريض}` - اسم المريض
- `{اسم_الطبيب}` - اسم الطبيب المعالج
- `{تاريخ_الموعد}` - تاريخ الموعد
- `{وقت_الموعد}` - وقت الموعد (صباحي/مسائي)
- `{اسم_العيادة}` - اسم العيادة
- `{رقم_الملف}` - رقم ملف المريض

---

## User Review Required

> [!IMPORTANT]
> **هيكل التبويبات الجديد:** صفحة الواتساب ستتحول من صفحة واحدة إلى 3 تبويبات:
> 1. ⚡ **ربط الواتساب** - الإعدادات الحالية + QR Code
> 2. 📝 **نصوص الإشعارات** - قوالب الرسائل + إعدادات التذكير
> 3. 📖 **توثيق الـ API** - جميع نقاط Evolution API v2

> [!WARNING]
> **تغيير في قاعدة البيانات:** سيتم إضافة حقول جديدة في جدول `ClinicSettings` لحفظ القوالب. يتطلب تشغيل `prisma migrate`.

---

## Proposed Changes

### 1. قاعدة البيانات (Prisma Schema)

#### [MODIFY] [schema.prisma](file:///d:/My%20Projects/clinic/server/prisma/schema.prisma)

إضافة حقول جديدة في `ClinicSettings`:

```diff
model ClinicSettings {
  ...existing fields...
  evolutionApiUrl        String?
  evolutionApiKey        String?
  evolutionInstanceName  String?
+ 
+ // إعدادات الإشعارات
+ followupReminderEnabled    Boolean @default(true)
+ followupReminderDays       Int     @default(1)   // قبل كم يوم يُرسل التذكير
+ followupReminderTemplate   String? // نص تذكير العودة
+ 
+ bookingConfirmEnabled      Boolean @default(true)
+ bookingConfirmTemplate     String? // نص تأكيد الحجز
+ 
+ bookingCancelEnabled       Boolean @default(true)
+ bookingCancelTemplate      String? // نص إلغاء الحجز
+ 
+ appointmentReminderEnabled Boolean @default(true)
+ appointmentReminderDays    Int     @default(1)
+ appointmentReminderTemplate String? // نص تذكير الموعد العادي
+ 
+ birthdayGreetingEnabled    Boolean @default(false)
+ birthdayGreetingTemplate   String? // نص تهنئة عيد الميلاد
+ 
+ postVisitEnabled           Boolean @default(false)
+ postVisitTemplate          String? // نص شكر بعد الزيارة
}
```

---

### 2. السيرفر (Backend Routes)

#### [MODIFY] [evolution.js](file:///d:/My%20Projects/clinic/server/src/routes/evolution.js)

- إضافة `GET /evolution/notification-settings` - جلب إعدادات الإشعارات
- إضافة `POST /evolution/notification-settings` - حفظ إعدادات الإشعارات
- إضافة `POST /evolution/test-message` - إرسال رسالة تجريبية

#### [MODIFY] [cron.service.js](file:///d:/My%20Projects/clinic/server/src/services/cron.service.js)

- تعديل منطق التذكير ليستخدم `followupReminderDays` بدلاً من القيمة الثابتة
- استخدام `followupReminderTemplate` مع المتغيرات الديناميكية
- إضافة cron job لتذكير المواعيد العادية
- إضافة cron job لتهنئة أعياد الميلاد
- إرسال الرسائل فعلياً عبر Evolution API

#### [MODIFY] [appointments.js](file:///d:/My%20Projects/clinic/server/src/routes/appointments.js)

- إرسال إشعار واتساب تلقائي عند تأكيد الحجز (إذا مفعّل)
- إرسال إشعار واتساب تلقائي عند إلغاء الحجز (إذا مفعّل)

#### [MODIFY] [utils.js](file:///d:/My%20Projects/clinic/server/src/lib/utils.js)

- تعديل `calculateReminderDate` لتقبل عدد أيام ديناميكي
- إضافة دالة `renderTemplate(template, variables)` لاستبدال المتغيرات في القوالب

---

### 3. الواجهة (Frontend)

#### [MODIFY] [index.jsx](file:///d:/My%20Projects/clinic/client/src/pages/whatsapp/index.jsx)

إعادة هيكلة كاملة للصفحة بنظام التبويبات:

**التبويب 1: ربط الواتساب** (المحتوى الحالي كما هو)
- إعدادات الاتصال بالسيرفر
- حالة الربط + QR Code

**التبويب 2: نصوص الإشعارات** ⭐ جديد
- كل نوع إشعار في بطاقة مستقلة مع:
  - مفتاح تفعيل/تعطيل
  - حقل نص القالب (textarea) مع placeholder يوضح المتغيرات
  - أزرار المتغيرات (نقرة واحدة لإدراج المتغير)
  - معاينة حية للرسالة النهائية
- إشعارات متوفرة:
  1. 🔔 تذكير موعد العودة/المراجعة + حقل "قبل كم يوم"
  2. ✅ تأكيد الحجز
  3. ❌ إلغاء الحجز
  4. 📅 تذكير الموعد العادي + حقل "قبل كم يوم"
  5. 🎂 تهنئة عيد الميلاد
  6. 🙏 شكر بعد الزيارة

**التبويب 3: توثيق الـ API** ⭐ جديد
واجهة منظمة تعرض جميع نقاط Evolution API v2 مقسمة بأقسام:

| القسم | النقاط |
|-------|--------|
| **Instance** | create, fetchInstances, connectionState, connect, logout, delete, restart, setPresence |
| **Messages** | sendText, sendMedia, sendWhatsAppAudio, sendSticker, sendLocation, sendContact, sendReaction, sendPoll, sendList, sendButtons, sendTemplate |
| **Chat** | whatsappNumbers, findMessages, markMessageAsRead, archiveChat, deleteMessage, fetchProfilePicture |
| **Group** | create, fetchAllGroups, findGroupInfos, updateGroupPicture, updateGroupSubject, updateGroupDescription, inviteCode, revokeInviteCode, sendInviteUrl, findParticipants, updateParticipants, updateSetting, toggleEphemeral, leaveGroup |
| **Profile** | fetchProfile, updateProfileName, updateProfilePicture, updateProfileStatus, fetchBusinessProfile |
| **Webhook** | set, find |
| **Settings** | set, find |
| **Labels** | fetchLabels, handleLabel |

كل endpoint يعرض:
- HTTP Method badge (GET/POST/PUT/DELETE) بألوان مميزة
- المسار الكامل
- الوصف
- Body/Parameters مع أمثلة JSON
- زر نسخ الـ endpoint

#### [MODIFY] [whatsapp.css](file:///d:/My%20Projects/clinic/client/src/pages/whatsapp/whatsapp.css)

إضافة styles للتبويبات، بطاقات الإشعارات، أزرار المتغيرات، معاينة الرسالة، وتوثيق API.

---

## Open Questions

> [!IMPORTANT]
> 1. **هل تريد إضافة جميع المقترحات (تهنئة عيد الميلاد، شكر بعد الزيارة)؟** أم تكتفي بالثلاثة الأساسية (تذكير العودة، تأكيد الحجز، إلغاء الحجز)؟
> 2. **هل تريد إرسال الرسائل فعلياً تلقائياً** عند تأكيد/إلغاء الحجز؟ أم فقط حفظ القوالب والإرسال اليدوي؟

---

## Verification Plan

### Automated Tests
- تشغيل `npx prisma migrate dev` للتأكد من نجاح migration
- تشغيل السيرفر والتأكد من عدم وجود أخطاء
- اختبار API endpoints عبر المتصفح

### Manual Verification
- فتح صفحة الواتساب والتنقل بين التبويبات الثلاثة
- حفظ قوالب الإشعارات والتأكد من الحفظ والاسترجاع
- معاينة الرسالة مع بيانات تجريبية
- التحقق من عرض توثيق API بشكل صحيح
- اختبار responsive design
