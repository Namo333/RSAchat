FROM node:16-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Добавляем вывод для отладки
RUN ls -la
RUN npm run build
RUN ls -la build/

FROM nginx:alpine

# Копируем собранные файлы
COPY --from=build /app/build /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем директорию для логов
RUN mkdir -p /var/log/nginx

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"] 