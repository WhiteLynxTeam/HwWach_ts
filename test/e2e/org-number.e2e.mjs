// Сквозная проверка номера организации и логина внутри организации (org-roles-plan.md, 9.2, этап 10).
// Нужны: запущенный ts на чистой базе с MAIL_DRIVER=console, DEFAULT_ADMIN_LOGIN=admin, DEFAULT_ADMIN_PASSWORD=admin123,
// DEFAULT_ORG_NAME="Тест пуща". go не нужен.
// Запуск: node test/e2e/org-number.e2e.mjs <путь к логу ts> (коды из писем читаются из лога). TS_URL — адрес ts
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

function lastCode(email) {
  const log = readFileSync(LOG, 'utf8');
  const re = new RegExp(`to=${email.replace(/[.+]/g, '\\$&')} subject="Код подтверждения HwWach: (\\d{6})"`, 'g');
  let m, code = null;
  while ((m = re.exec(log))) code = m[1];
  return code;
}

// Контрольная цифра Луна — как в src/common/org-number.ts
function luhn(payload) {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    let d = Number(payload[payload.length - 1 - i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}
const spaced = (n) => `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;

// 1. Номер у организации по умолчанию
let r = await call('POST', '/auth/login', { login: 'admin', password: 'admin123' });
check('login admin without number (login unique)', r.status === 200, r.body);
const admin1 = r.body;
r = await call('GET', '/organizations/me', null, admin1.access_token);
const num1 = r.body.number;
check('org has number', /^[1-9]\d{6}$/.test(num1 ?? '') && luhn(num1.slice(0, 6)) === Number(num1[6]), r.body);

r = await call('GET', '/organizations/by-number/' + encodeURIComponent(spaced(num1)));
check('by number (spaced)', r.status === 200 && r.body.name === 'Тест пуща' && !('email' in r.body), r.body);
const typo = num1.slice(0, 6) + ((Number(num1[6]) + 1) % 10);
r = await call('GET', '/organizations/by-number/' + typo);
check('typo caught by check digit', r.status === 404, r.body);

// 2. Вторая организация
const email2 = `num${Date.now()}@test.by`;
await call('POST', '/org-registration/send-code', { email: email2 });
r = await call('POST', '/org-registration/verify-code', { email: email2, code: lastCode(email2) });
r = await call('POST', '/org-registration/complete', {
  registration_token: r.body.registration_token, name: 'ООО «Номерная пуща»', lastName: 'Второй', firstName: 'Админ', password: 'secret12',
});
check('second org', r.status === 201, r.body);
const admin2 = r.body;
r = await call('GET', '/organizations/me', null, admin2.access_token);
const num2 = r.body.number;
check('numbers differ', num2 && num2 !== num1, { num1, num2 });

// 3. Один логин в двух организациях
r = await call('POST', '/accounts', { lastName: 'Иванов', firstName: 'Первый', login: 'ivanov', password: 'temp1111' }, admin1.access_token);
check('ivanov in org 1', r.status === 201, r.body);
r = await call('POST', '/accounts', { lastName: 'Иванов', firstName: 'Второй', login: 'IVANOV', password: 'temp2222' }, admin2.access_token);
check('ivanov in org 2 (same login, other org)', r.status === 201, r.body);
r = await call('POST', '/accounts', { lastName: 'Иванов', firstName: 'Дубль', login: 'Ivanov', password: 'temp3333' }, admin1.access_token);
check('same login twice in one org', r.status === 409, r.body);

r = await call('POST', '/auth/login', { login: 'ivanov', password: 'temp1111' });
check('ambiguous login asks for number', r.status === 409 && r.body.error_code === 'ORG_NUMBER_REQUIRED', r.body);
r = await call('POST', '/auth/change-temp-password', { login: 'ivanov', oldPassword: 'temp1111', newPassword: 'ivan1111', organizationNumber: spaced(num1) });
check('change temp password with number', r.status === 200, r.body);
r = await call('POST', '/auth/change-temp-password', { login: 'ivanov', oldPassword: 'temp2222', newPassword: 'ivan2222', organizationNumber: num2 });
check('change temp password in org 2', r.status === 200, r.body);
r = await call('POST', '/auth/login', { login: 'ivanov', password: 'ivan1111', organizationNumber: spaced(num1) });
check('login with number org 1', r.status === 200 && r.body.user.organizationId === admin1.user.organizationId, r.body);
r = await call('POST', '/auth/login', { login: 'ivanov', password: 'ivan2222', organizationNumber: num2 });
check('login with number org 2', r.status === 200 && r.body.user.organizationId === admin2.user.organizationId, r.body);
r = await call('POST', '/auth/login', { login: 'ivanov', password: 'ivan1111', organizationNumber: num2 });
check('wrong org number = wrong credentials', r.status === 401, r.body);
r = await call('POST', '/auth/forgot-password', { login: 'ivanov' });
check('forgot password ambiguous', r.status === 409 && r.body.error_code === 'ORG_NUMBER_REQUIRED', r.body);
r = await call('POST', '/auth/forgot-password', { login: 'ivanov', organizationNumber: num1 });
check('forgot password with number', r.status === 200 || r.status === 201, r.body);

// 4. Вход по почте без номера (новое устройство)
r = await call('POST', '/auth/login', { login: email2, password: 'secret12' });
check('login by email without number', r.status === 200 && r.body.user.organizationId === admin2.user.organizationId, r.body);

// 5. Регистрация по номеру
r = await call('POST', '/auth/register', { login: 'ivanov', password: 'pass1234', organizationNumber: spaced(num2), lastName: 'Иванов', firstName: 'Третий' });
check('register by number: login taken in that org', r.status === 409, r.body);
r = await call('POST', '/auth/register', { login: 'petrov', password: 'pass1234', organizationNumber: spaced(num2), lastName: 'Петров', firstName: 'Пётр' });
check('register by number', r.status === 201 && r.body.source === 'number' && r.body.organizationId === admin2.user.organizationId, r.body);
r = await call('POST', '/auth/register', { login: 'petrov', password: 'pass1234', organizationNumber: num1, lastName: 'Петров', firstName: 'Другой' });
check('same login pending in other org is fine', r.status === 201, r.body);
r = await call('POST', '/auth/register', { login: 'sidorov', password: 'pass1234', organizationNumber: typo, lastName: 'Сидоров', firstName: 'Сидор' });
check('register by wrong number', r.status === 404, r.body);

// 6. Смена номера
r = await call('POST', '/organizations/me/number', null, admin2.access_token);
const num2b = r.body.number;
check('change number', r.status === 200 && num2b && num2b !== num2, r.body);
r = await call('GET', '/organizations/by-number/' + num2);
check('old number stops working', r.status === 404, r.body);
r = await call('GET', '/organizations/by-number/' + num2b);
check('new number works', r.status === 200, r.body);
r = await call('POST', '/organizations/me/number', null, (await call('POST', '/auth/login', { login: 'ivanov', password: 'ivan1111', organizationNumber: num1 })).body.access_token);
check('member cannot change number', r.status === 403, r.body);

console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
