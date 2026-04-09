FROM node:18-alpine

# تثبيت الحزم اللازمة لـ SQLite عبر Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# نسخ ملفات تعريف المشروع
COPY package*.json ./

# تثبيت الحزم
RUN npm ci

# نسخ باقي الملفات
COPY . .

# توليد Prisma Client
# نستخدم --skip-generate في ال db push لاحقاً لأننا ولدناه هنا
RUN npx prisma generate

# تحديد المنفذ
EXPOSE 5000

# الأمر لبدء التشغيل مع دفع مخطط قاعدة البيانات
CMD ["sh", "-c", "mkdir -p /data && touch /data/clinic.db && ln -sf /data/clinic.db /app/clinic.db && npx prisma db push --skip-generate --accept-data-loss && npm start"]
