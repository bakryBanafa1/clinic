# المرحلة الأولى: بناء المشروع (Build Stage)
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
# إجبار التثبيت الشامل وتجاهل بيئة الانتاج الخاصة بـ Coolify
ENV NODE_ENV=development
RUN npm install

COPY . .
# تعطيل حدود الذاكرة التي قد تعيق النظام وعرض الخطأ بالتفصيل في حالة الفشل
RUN npm run build -- --debug || (echo "Build failed!" && exit 1)

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
