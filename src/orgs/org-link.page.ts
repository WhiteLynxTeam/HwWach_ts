import { formatOrgNumber, normalizeOrgNumber } from '../common/org-number';

// Ссылка на APK последней версии (README репозитория Android)
const APK_URL = 'https://github.com/WhiteLynxTeam/HwWach_android/releases/latest/download/HwWach.apk';

// Страница ссылки-приглашения для входа: /org/{номер}. Номер не секрет (без логина и пароля он ничего не даёт),
// но название организации не показываем — иначе перебором номеров можно собрать список организаций.
// QR в приложении ведёт сюда, а не сразу на hwwach://: камера телефона открывает https, и без приложения
// есть ссылка на скачивание.
export function orgLinkPage(raw: string): string {
  const number = normalizeOrgNumber(raw);
  const body = number
    ? `<h1>Вход в HwWach</h1>
<p>Номер вашей организации:</p>
<p class="code">${formatOrgNumber(number)}</p>
<p><a class="btn" href="hwwach://login?org=${number}">Открыть в приложении</a></p>
<p class="muted">Номер подставится на экране входа, останется ввести логин и пароль.</p>
<p><a class="btn light" href="${APK_URL}">Скачать приложение</a></p>
<p class="muted">Если приложения ещё нет: скачайте, установите и снова откройте эту ссылку.</p>`
    : '<h1>Неверная ссылка</h1><p>Номер организации в ссылке с ошибкой. Попросите у администратора новую.</p>';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HwWach — вход</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;color:#1f2937}
.code{font-size:32px;font-weight:700;letter-spacing:4px;text-align:center;background:#f3f4f6;border-radius:12px;padding:16px}
.btn{display:block;text-align:center;background:#1f2937;color:#fff;border-radius:36px;padding:14px;text-decoration:none}
.btn.light{background:#e5e7eb;color:#1f2937}.muted{color:#6b7280;font-size:14px}</style>
</head><body>${body}</body></html>`;
}
