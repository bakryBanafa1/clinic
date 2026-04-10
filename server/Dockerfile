FROM node:18

# تثبيت متطلبات أساسية لبناء الحزم المعقدة
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# نسخ ملفات تعريف المشروع
COPY package*.json ./

# تثبيت الحزم
RUN npm install

# نسخ باقي الملفات
COPY . .

# إعداد متغير البيئة الخاص بقاعدة البيانات
ENV DATABASE_URL="file:/data/clinic.db"

# توليد Prisma Client
# نستخدم --skip-generate في ال db push لاحقاً لأننا ولدناه هنا
RUN npx prisma generate

# تحديد المنفذ
EXPOSE 5000

# الأمر لبدء التشغيل مع دفع مخطط قاعدة البيانات
CMD ["sh", "-c", "mkdir -p /data && npx prisma db push --skip-generate --accept-data-loss && npm start"]
