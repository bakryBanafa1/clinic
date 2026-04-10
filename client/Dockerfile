# المرحلة الأولى: بناء المشروع (Build Stage)
FROM node:20 AS build

WORKDIR /app
COPY package*.json ./
# إجبار التثبيت الشامل وتجاهل بيئة الانتاج الخاصة بـ Coolify
ENV NODE_ENV=development
RUN npm install

COPY . .
# تعطيل حدود الذاكرة وعرض ملف الأخطاء بالكامل في حال الفشل
RUN npm run build > build_logs.txt 2>&1 || (cat build_logs.txt && exit 1)

# المرحلة الثانية: التشغيل (Production Stage)
FROM nginx:alpine

# إزالة الإعدادات الافتراضية للـ nginx
RUN rm /etc/nginx/conf.d/default.conf

# نسخ إعداداتنا الخاصة المعرفة مسبقاً
COPY nginx.conf /etc/nginx/conf.d/

# نسخ الملفات المبنية من المرحلة الأولى
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
