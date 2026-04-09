# المرحلة الأولى: بناء المشروع (Build Stage)
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

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
