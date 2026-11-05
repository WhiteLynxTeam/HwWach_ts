// Сквозная проверка сброса пароля кодом на почту (org-roles-plan.md, 8.2).
// Нужны: запущенный ts на чистой базе с MAIL_DRIVER=console, DEFAULT_ADMIN_LOGIN=admin, DEFAULT_ADMIN_PASSWORD=admin123. go не нужен.
// Запуск: node test/e2e/password-reset.e2e.mjs <путь к логу ts> (коды из писем читаются из лога). TS_URL — адрес ts
import { readFileSync } from 'fs';

const BASE = process.env.TS_URL || 'http://localhost:3099';
const LOG = process.argv[2];
let fails = 0;

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

function check(name, cond, extra) {
  if (cond) console.log('OK  ', name);
  else { fails++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
}

const esc = (s) => s.replace(/[.+]/g, '\\$&');
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
function lastCodeNow(email) {
  const re = new RegExp(`to=${esc(email)} subject="Код подтверждения HwWach: (\\d{6})"`, 'g');
  const log = readFileSync(LOG, 'utf8');
  let m, code = null;
  while ((m = re.exec(log))) code = m[1];
  return code;
}
// Лог ts пишется с задержкой — ждём новый код (отличный от prev) до 5 с
async function lastCode(email, prev = null) {
  for (let i = 0; i < 25; i++) {
    const code = lastCodeNow(email);
    if (code && code !== prev) return code;
    await sleep(200);
  }
  return null;
}
const mails = (email, subject) => readFileSync(LOG, 'utf8').split(`to=${email} subject="${subject}"`).length - 1;

// 1. Организация с админом (почта подтверждена при регистрации)
const adminEmail = `reset${Date.now()}@test.by`;
await call('POST', '/org-registration/send-code', { email: adminEmail });
const regCode = await lastCode(adminEmail);
let r = await call('POST', '/org-registration/verify-code', { email: adminEmail, code: regCode });
r = await call('POST', '/org-registration/complete', {
  registration_token: r.body.registration_token, name: 'ООО «Сбросная пуща»', lastName: 'Админ', firstName: 'Сброс', password: 'oldpass1',
});
check('org registered', r.status === 201, r.body);
const admin = r.body;
r = await call('GET', '/organizations/me', null, admin.access_token);
const orgNumber = r.body.number;

// Человек с почтой, которую админ вписал сам (не подтверждена)
const memberEmail = `member${Date.now()}@test.by`;
r = await call('POST', '/accounts', { lastName: 'Петров', firstName: 'Пётр', login: 'petrov', email: memberEmail, password: 'temp1111' }, admin.access_token);
check('member with unverified email', r.status === 201, r.body);

// Заявка админу «Забыли пароль?» по логину — после сброса по коду она закрывается
r = await call('POST', '/auth/forgot-password', { login: adminEmail });
check('admin request by login', r.status === 200 && r.body.status === 'PENDING', r.body);

// Лимит «письмо раз в 60 с» на адрес общий для регистрации и сброса
console.log('... ждём 61 с (лимит писем на адрес)');
await sleep(61_000);

// 2. Ответ одинаковый для любого адреса; код — только на подтверждённую почту
r = await call('POST', '/auth/password-reset/send-code', { email: adminEmail.toUpperCase() });
const same = r.body;
const code = await lastCode(adminEmail, regCode);
check('send code: admin', r.status === 200 && !!code, r.body);
const unknown = `nobody${Date.now()}@test.by`;
r = await call('POST', '/auth/password-reset/send-code', { email: unknown });
const unknownBody = r.body;
r = await call('POST', '/auth/password-reset/send-code', { email: memberEmail });
const memberBody = r.body;
await sleep(1000);
check('send code: unknown — same answer, notice without code', JSON.stringify(unknownBody) === JSON.stringify(same)
  && !lastCodeNow(unknown) && mails(unknown, 'HwWach: сброс пароля') === 1, unknownBody);
check('send code: unverified — same answer, notice without code', JSON.stringify(memberBody) === JSON.stringify(same)
  && !lastCodeNow(memberEmail) && mails(memberEmail, 'HwWach: сброс пароля') === 1, memberBody);
r = await call('POST', '/auth/password-reset/send-code', { email: adminEmail });
check('resend within 60 s — 429', r.status === 429, r.body);

// 3. Неверный код, затем верный
const wrong = code === '000000' ? '111111' : '000000';
r = await call('POST', '/auth/password-reset/confirm', { email: adminEmail, code: wrong, newPassword: 'newpass1' });
check('wrong code — attempts left', r.status === 400 && /Осталось попыток: 4/.test(r.body.message), r.body);
r = await call('POST', '/auth/password-reset/confirm', { email: adminEmail, code, newPassword: 'newpass1' });
check('confirm', r.status === 200 && r.body.login === adminEmail && r.body.organization?.number === orgNumber, r.body);
check('mail «password changed»', mails(adminEmail, 'HwWach: пароль изменён') === 1);
r = await call('POST', '/auth/password-reset/confirm', { email: adminEmail, code, newPassword: 'newpass2' });
check('code is single-use', r.status === 400, r.body);

// 4. Старые токены и пароль не работают, новый — работает
r = await call('POST', '/auth/refresh', { refresh_token: admin.refresh_token });
check('old refresh revoked', r.status === 401, r.body);
r = await call('POST', '/auth/login', { login: adminEmail, password: 'oldpass1' });
check('old password rejected', r.status === 401, r.body);
r = await call('POST', '/auth/login', { login: adminEmail, password: 'newpass1' });
check('login with new password', r.status === 200 && r.body.access_token, r.body);
r = await call('GET', '/reset-pass', null, r.body.access_token);
check('admin request closed', r.status === 200 && Array.isArray(r.body) && r.body.length === 0, r.body);

// 5. Проверка полей
r = await call('POST', '/auth/password-reset/confirm', { email: adminEmail, code: '12', newPassword: 'x' });
check('validation', r.status === 400, r.body);

console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
