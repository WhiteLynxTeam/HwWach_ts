// Сквозная проверка ts (организации, люди, учётки, приглашения, регистрация организации, передача админства).
// Нужны: запущенный ts на чистой базе с MAIL_DRIVER=console, DEFAULT_ADMIN_LOGIN=admin, DEFAULT_ADMIN_PASSWORD=admin123,
// DEFAULT_ORG_NAME="Тест пуща", INTERNAL_API_KEY=k и запущенный go (MAIN_INTERNAL_URL).
// Запуск: node test/e2e/org-roles.e2e.mjs <путь к логу ts> (коды из писем читаются из лога). TS_URL — адрес ts
import { readFileSync } from 'fs';

const BASE = process.env.TS_URL || 'http://localhost:3099';
const LOG = process.argv[2];
let fails = 0;

async function call(method, path, body, token, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
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

const decode = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());

// 1. Вход админом по умолчанию
let r = await call('POST', '/auth/login', { login: 'admin', password: 'admin123' });
check('login admin', r.status === 200 && r.body.access_token, r.body);
let admin = r.body;
const claims = decode(admin.access_token);
check('access claims', claims.typ === 'access' && claims.org && claims.person && claims.perms.includes('accounts.manage') && claims.mol === true, claims);
check('profile', admin.user.role === 'admin' && admin.user.organizationName === 'Тест пуща', admin.user);

// refresh-токен как access не подходит
r = await call('GET', '/auth/me', null, admin.refresh_token);
check('refresh token rejected as access', r.status === 401, r);
r = await call('GET', '/auth/me', null, admin.access_token);
check('me', r.status === 200 && r.body.perms.length > 10, r.body);

// 2. Люди
r = await call('POST', '/persons', { lastName: 'Петров', firstName: 'Пётр', position: 'Мастер', isMol: true }, admin.access_token);
check('create person (mol)', r.status === 201 && r.body.isMol === true, r.body);
const petrov = r.body;
r = await call('POST', '/persons', { lastName: 'Сидоров', firstName: 'Сидор' }, admin.access_token);
const sidorov = r.body;
check('create person', r.status === 201, r.body);
r = await call('GET', '/persons', null, admin.access_token);
check('list persons (full)', r.status === 200 && r.body.length === 3 && 'phone' in r.body[0], r.body);

// 3. Приглашение из карточки → регистрация → одобрение
r = await call('POST', '/invites', { personId: sidorov.id, roleCode: 'member' }, admin.access_token);
check('create invite', r.status === 201 && r.body.code && r.body.link, r.body);
const invite = r.body;
r = await call('GET', '/invites/resolve/' + encodeURIComponent(invite.code));
check('resolve invite', r.status === 200 && r.body.person && r.body.person.lastName === 'Сидоров', r.body);
r = await call('GET', '/invite/' + invite.link.split('/').pop());
check('invite page', r.status === 200 && String(r.body).includes(invite.code), String(r.body).slice(0, 200));
r = await call('POST', '/auth/register', { login: 'sidorov', password: 'pass1234', inviteCode: invite.code });
check('register by invite', r.status === 201 && r.body.source === 'invite' && r.body.lastName === 'Сидоров', r.body);
const regId = r.body.id;
r = await call('POST', '/auth/register', { login: 'other1', password: 'pass1234', inviteCode: invite.code, lastName: 'А', firstName: 'Б' });
check('invite used up', r.status === 400, r.body);
r = await call('GET', '/registration-status/' + regId);
check('registration status', r.status === 200 && r.body.status === 'PENDING' && r.body.organizationName, r.body);
r = await call('POST', `/registrations/${regId}/approve`, { comment: 'ok' }, admin.access_token);
check('approve registration', r.status === 201 && r.body.status === 'APPROVED' && r.body.personId === sidorov.id, r.body);

r = await call('POST', '/auth/login', { login: 'sidorov', password: 'pass1234' });
check('login member', r.status === 200 && r.body.user.role === 'member' && r.body.user.personId === sidorov.id, r.body);
let member = r.body;

// участник видит людей без телефонов, не может управлять
r = await call('GET', '/persons', null, member.access_token);
check('member persons limited', r.status === 200 && !('phone' in r.body[0]), r.body[0]);
r = await call('GET', '/accounts', null, member.access_token);
check('member cannot list accounts', r.status === 403, r.body);
r = await call('POST', '/persons', { lastName: 'Хохлов', firstName: 'Ушат' }, member.access_token);
check('member non-mol cannot create person', r.status === 403, r.body);

// просьба «я МОЛ» → одобрение админом
r = await call('POST', '/persons/me/mol-request', null, member.access_token);
check('mol request', r.status === 201 && r.body.isMol === true, r.body);
r = await call('GET', '/user-change-requests', null, admin.access_token);
const molReq = (r.body || []).find((x) => x.isMol && x.status === 'PENDING');
check('mol request visible to admin', !!molReq, r.body);
r = await call('PATCH', `/user-change-requests/${molReq.id}/approve`, { comment: 'да' }, admin.access_token);
check('approve mol request', r.status === 200 && r.body.status === 'APPROVED', r.body);
r = await call('GET', '/persons/' + sidorov.id, null, admin.access_token);
check('person is mol now', r.body.isMol === true && !r.body.molRequestedAt, r.body);

// refresh перечитывает права: теперь в токене mol=true
r = await call('POST', '/auth/refresh', { refresh_token: member.refresh_token });
check('refresh rereads', r.status === 200 && decode(r.body.access_token).mol === true, r.body);

// смена роли отзывает refresh
const accs = (await call('GET', '/accounts', null, admin.access_token)).body;
const sidAcc = accs.find((a) => a.login === 'sidorov');
r = await call('PUT', '/accounts/' + sidAcc.id, { roleCode: 'asset_manager' }, admin.access_token);
check('change role', r.status === 200 && r.body.role === 'asset_manager', r.body);
r = await call('POST', '/auth/refresh', { refresh_token: member.refresh_token });
check('old refresh revoked after role change', r.status === 401, r.body);
r = await call('PUT', '/accounts/' + sidAcc.id, { roleCode: 'admin' }, admin.access_token);
check('cannot assign admin role', r.status === 400, r.body);

// 4. Поиск организации и регистрация через поиск
r = await call('GET', '/organizations/search?q=' + encodeURIComponent('пущ'));
check('search min 4 chars', r.status === 400, r.body);
r = await call('GET', '/organizations/search?q=' + encodeURIComponent('ПУЩА'));
check('search finds', r.status === 200 && r.body.length === 1 && !('email' in r.body[0]), r.body);
const orgId = r.body[0].id;
r = await call('POST', '/auth/register', { login: 'stranger', password: 'pass1234', organizationId: orgId, lastName: 'Чужой', firstName: 'Человек' });
check('register by search', r.status === 201 && r.body.source === 'search', r.body);
r = await call('POST', '/auth/login', { login: 'stranger', password: 'pass1234' });
check('pending registrant cannot login', r.status === 401, r.body);

// 5. Регистрация организации (8.1)
const email = `office${Date.now()}@test.by`;
r = await call('POST', '/org-registration/send-code', { email });
check('send code', r.status === 200, r.body);
r = await call('POST', '/org-registration/send-code', { email });
check('resend throttled', r.status === 429, r.body);
const code = lastCode(email);
check('code in mail log', !!code, code);
r = await call('POST', '/org-registration/verify-code', { email, code: code === '000000' ? '111111' : '000000' });
check('wrong code', r.status === 400, r.body);
r = await call('POST', '/org-registration/verify-code', { email, code });
check('verify code', r.status === 200 && r.body.registration_token, r.body);
const regToken = r.body.registration_token;
r = await call('POST', '/org-registration/complete', {
  registration_token: regToken, name: 'ООО «Вторая пуща»', lastName: 'Иванов', firstName: 'Иван', password: 'secret12',
});
check('complete org registration', r.status === 201 && r.body.user.role === 'admin' && r.body.user.login === email, r.body);
const admin2 = r.body;
check('second org separate', admin2.user.organizationId !== orgId, admin2.user);
r = await call('GET', '/persons', null, admin2.access_token);
check('org isolation (persons)', r.status === 200 && r.body.length === 1, r.body);
r = await call('POST', '/org-registration/complete', { registration_token: regToken, name: 'Дубль', lastName: 'А', firstName: 'Б', password: 'secret12' });
check('one org per email', r.status === 400 || r.status === 429, r.body);

// 6. Передача администрирования (2.3) — во второй организации
r = await call('POST', '/persons', { lastName: 'Новый', firstName: 'Админ' }, admin2.access_token);
const newAdminPerson = r.body;
const newEmail = `newadmin${Date.now()}@test.by`;
r = await call('POST', '/accounts/admin-handover/send-code', { email: newEmail }, admin2.access_token);
check('handover code', r.status === 200, r.body);
r = await call('POST', '/accounts/admin-handover', {
  personId: newAdminPerson.id, login: newEmail, email: newEmail, code: lastCode(newEmail), changeOrgEmail: true, currentPassword: 'secret12',
}, admin2.access_token);
check('handover', r.status === 200 && r.body.tempPassword, r.body);
const temp = r.body.tempPassword;
r = await call('POST', '/auth/refresh', { refresh_token: admin2.refresh_token });
check('old admin refresh revoked', r.status === 401, r.body);
r = await call('POST', '/auth/login', { login: newEmail, password: temp });
check('new admin must change temp password', r.status === 412, r.body);
r = await call('POST', '/auth/change-temp-password', { login: newEmail, oldPassword: temp, newPassword: 'newpass1' });
check('change temp password', r.status === 200, r.body);
r = await call('POST', '/auth/login', { login: newEmail, password: 'newpass1' });
check('new admin login', r.status === 200 && r.body.user.personId === newAdminPerson.id && r.body.user.role === 'admin', r.body);
const admin3 = r.body;
r = await call('GET', '/organizations/me', null, admin3.access_token);
check('org email changed', r.body.email === newEmail, r.body);
r = await call('GET', '/audit', null, admin3.access_token);
const ho = (r.body || []).find((x) => x.action === 'account.admin_handover');
check('audit keeps previous person', ho && ho.actorPersonId !== newAdminPerson.id, ho);
// прежняя почта свободна: можно регистрировать организацию заново? — организация всё ещё на новой почте
r = await call('POST', '/auth/login', { login: email, password: 'secret12' });
check('old admin login gone', r.status === 401, r.body);

// 7. Увольнение: go недоступен → 503, ничего не меняется
r = await call('POST', `/persons/${admin.user.personId}/dismiss`, null, admin.access_token);
check('cannot dismiss admin', r.status === 409, r.body);

// 8. Внутренние запросы
r = await call('GET', '/internal/persons/' + petrov.id, null, null, { 'X-Internal-Key': 'k' });
check('internal person', r.status === 200 && r.body.is_mol === true && r.body.organization_id === orgId, r.body);
r = await call('GET', '/internal/persons/' + petrov.id, null, null, { 'X-Internal-Key': 'wrong' });
check('internal key required', r.status === 401, r.body);
r = await call('GET', '/internal/persons/' + petrov.id, null, admin.access_token);
check('user token not internal', r.status === 401, r.body);
r = await call('POST', '/internal/jobs/daily', null, null, { 'X-Internal-Key': 'k' });
check('daily job', r.status === 200 && r.body.runId, r.body);
r = await call('POST', '/internal/jobs/daily', null, null, { 'X-Internal-Key': 'k' });
check('daily job idempotent', r.status === 200, r.body);

r = await call('POST', `/persons/${petrov.id}/dismiss`, null, admin.access_token);
check('dismiss (go up)', r.status === 200 && r.body.isActive === false, r.body);

// занятая почта — тот же ответ, но письмо другое (после паузы: повтор на адрес не чаще раза в 60 с)
await new Promise((res) => setTimeout(res, 61_000));
r = await call('POST', '/org-registration/send-code', { email: 'free' + email });
// почта организации после передачи админства — newEmail (прежняя освободилась)
const taken = await call('POST', '/org-registration/send-code', { email: newEmail });
check('taken email same response', taken.status === 200 && taken.body.message === r.body.message, taken.body);
check('taken email letter', readFileSync(LOG, 'utf8').includes(`to=${newEmail} subject="HwWach: на этот адрес уже есть организация"`));

console.log(fails === 0 ? '\nALL OK' : `\n${fails} FAILED`);
process.exit(fails ? 1 : 0);
