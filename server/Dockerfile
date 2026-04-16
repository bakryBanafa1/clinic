FROM node:20

# تثبيت متطلبات أساسية لبناء الحزم المعقدة
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# نسخ ملفات تعريف المشروع
COPY package*.json ./

# تثبيت الحزم وعرض تقرير الأخطاء كاملًا في حالة الفشل
RUN npm install > install_logs.txt 2>&1 || (cat install_logs.txt && exit 1)

# نسخ باقي الملفات
COPY . .

# إعداد متغير البيئة الخاص بقاعدة البيانات ومسار المرفقات
ENV DATABASE_URL="file:/app/data/clinic.db"
ENV UPLOADS_DIR="/app/data/uploads"

# توليد Prisma Client
# نستخدم --skip-generate في ال db push لاحقاً لأننا ولدناه هنا
RUN npx prisma generate

# تحديد المنفذ
EXPOSE 5000

# الأمر لبدء التشغيل مع دفع مخطط قاعدة البيانات وبذر البيانات الافتراضية
CMD ["sh", "-c", "mkdir -p /app/data && npx prisma db push --skip-generate --accept-data-loss && npm run db:seed && npm start"]
