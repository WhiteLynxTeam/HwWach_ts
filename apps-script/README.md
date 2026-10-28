# Отправка писем через Google Apps Script

`MAIL_DRIVER=appsscript`. Письма уходят с ящика whitelynxteam.dev@gmail.com через веб-приложение Apps Script (`mailer.gs`). Google Cloud Console для этого не нужен. ts вызывает скрипт по HTTPS, а такие запросы на бесплатном Render не блокируются.

Лимит обычного аккаунта Gmail — около **100 получателей в сутки**. Остаток квоты ежесуточная задача пишет в лог ts.

## Настройка (один раз, около 10 минут)

1. Откройте https://script.google.com и войдите как **whitelynxteam.dev@gmail.com** → **New project** (Новый проект).
2. Слева вверху переименуйте проект: «Untitled project» → `HwWach mailer`.
3. Удалите всё из файла `Code.gs` и вставьте содержимое `mailer.gs` → **Save** (значок дискеты).
4. Задайте секрет:
   - **Project Settings** (шестерёнка слева) → внизу **Script Properties** → **Add script property**;
   - Property: `SECRET`, Value: длинная случайная строка → **Save script properties**.
   - Строку можно получить в PowerShell: `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`
5. Дайте разрешение на отправку почты:
   - вернитесь в редактор (**Editor**, значок `< >`);
   - в списке функций над кодом выберите `authorize` → **Run**;
   - **Review permissions** → выберите ящик;
   - на предупреждении «Google hasn't verified this app» нажмите **Advanced → Go to HwWach mailer (unsafe)** → **Allow**;
   - внизу, в журнале выполнения, появится «Квота на сегодня: 100» (или около того).
6. Опубликуйте:
   - **Deploy → New deployment** → шестерёнка у «Select type» → **Web app**;
   - Description: `v1`;
   - **Execute as: Me** (whitelynxteam.dev@gmail.com);
   - **Who has access: Anyone**: без этого ts получит страницу входа Google вместо ответа;
   - **Deploy** → скопируйте **Web app URL**: он заканчивается на `/exec`.
7. В Render, сервис ts → **Environment**:

| Переменная | Значение |
|---|---|
| `MAIL_DRIVER` | `appsscript` |
| `APPS_SCRIPT_URL` | Web app URL из шага 6 |
| `APPS_SCRIPT_SECRET` | тот же секрет, что в шаге 4 |
| `MAIL_FROM_NAME` | `HwWach` (имя отправителя) |

`GMAIL_*` и `MAIL_FROM` для этого способа не нужны: адрес отправителя — это ящик, под которым опубликован скрипт.

## Проверка

Из PowerShell (подставьте URL и секрет):

```powershell
Invoke-RestMethod -Method Post -Uri "<Web app URL>" -ContentType "application/json" -Body '{"secret":"<секрет>","action":"ping"}'
```

Ответ `ok: True, quota: 100` значит, что всё работает. Затем начните в приложении регистрацию организации на свою почту: должен прийти код.

## Если поменяли код скрипта

Сохранить код недостаточно. Нужно **Deploy → Manage deployments** → карандаш → Version: **New version** → **Deploy**. URL остаётся прежним.

## Ошибки (в логах ts на Render)

| Ошибка | Причина и что делать |
|---|---|
| `Apps Script: не JSON (…)` с HTML | при публикации выбрано не «Anyone», или URL неверный (нужен `/exec`, а не `/dev`) |
| `Apps Script: forbidden` | `APPS_SCRIPT_SECRET` не совпадает со `SECRET` в Script Properties |
| `Apps Script: daily quota exceeded` или `Service invoked too many times` | исчерпан суточный лимит, он сбросится через сутки |
| `Exception: You do not have permission…` / `Authorization is required` | не выполнен шаг 5, или доступ отозван на https://myaccount.google.com/permissions. Повторите шаг 5 |

Если сменить пароль ящика, этот способ, в отличие от Gmail API, обычно продолжает работать.
