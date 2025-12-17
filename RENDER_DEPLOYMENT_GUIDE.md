# Деплой на Render.com

## Обзор

Этот документ описывает, как развернуть ваше приложение HwWach на Render.com с использованием отдельных сервисов для бэкенд-сервера и базы данных PostgreSQL.

## Архитектура

- Бэкенд-сервер (NestJS API)
- База данных PostgreSQL (Render External Database)

## Подготовка

1. Зарегистрируйтесь на [Render.com](https://render.com)
2. Свяжите ваш GitHub аккаунт с Render
3. Убедитесь, что ваш репозиторий доступен для Render

## Деплой PostgreSQL базы данных

1. Перейдите на [dashboard.render.com/database](https://dashboard.render.com/database)
2. Нажмите "New +" → "PostgreSQL" (External Database)
3. Выберите название (например, "hwwach-db")
4. Выберите регион (совпадающий с регионом вашего web-сервера)
5. Выберите бесплатный тарифный план
6. Нажмите "Create Database"

После создания базы данных вы получите:
- Hostname
- Port
- Database Name
- Username
- Password

## Деплой бэкенд-сервера

1. Перейдите на [dashboard.render.com/web](https://dashboard.render.com/select-repo)
2. Выберите "Web Service"
3. Выберите репозиторий с вашим проектом
4. Выберите ветку (обычно "main")
5. Укажите название сервиса (например, "hwwach-api")
6. Выберите регион (совпадающий с регионом базы данных)
7. В Environment Section:
   - Установите Environment: "Docker"
   - Docker Image Path оставьте пустым (Render будет использовать ваш Dockerfile)
8. В Health Check Path укажите: "/"
9. В Environment Variables:
   - NODE_ENV = production
   - DB_HOST = (hostname от PostgreSQL базы данных)
   - DB_PORT = (порт от PostgreSQL базы данных, обычно 5432)
   - DB_USERNAME = (username от PostgreSQL базы данных)
   - DB_PASSWORD = (password от PostgreSQL базы данных)
   - DB_NAME = (database name от PostgreSQL базы данных)
   - JWT_SECRET = (сгенерируйте надежный JWT секрет)
   - JWT_EXPIRES_IN = 24h
   - JWT_EXPIRATION_TIME = 15m
   - JWT_REFRESH_EXPIRATION_TIME = 7d
   - BCRYPT_ROUNDS = 10
   - PORT = 3000
10. Нажмите "Create Web Service"

## Альтернативный метод - через render.yaml

Render также поддерживает автоматический деплой через файл `render.yaml` в корне репозитория.

В файле `render.yaml` уже определены:
- Веб-сервис с именем "hwwach-api"
- Внешняя база данных PostgreSQL с именем "hwwach-db"

Для использования этого метода:
1. Убедитесь, что файл `render.yaml` находится в корне вашего репозитория
2. Следуйте инструкциям выше, но выберите репозиторий в Render
3. Render автоматически создаст все необходимые сервисы согласно файлу render.yaml

## Заметки

- При первом запуске после деплоя может потребоваться время на миграцию базы данных
- Для управления пользователями и ролями используйте endpoint-ы в /auth и /users
- Мониторинг и логирование доступны через панель управления Render