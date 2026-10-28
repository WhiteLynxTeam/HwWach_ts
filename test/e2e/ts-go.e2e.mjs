// Сквозная проверка ts + go: токены ts в go, внутренние запросы в обе стороны, роли, ремонт, журнал.
// Запуск после org-roles.e2e.mjs на тех же серверах: node test/e2e/ts-go.e2e.mjs. TS_URL / GO_URL — адреса
const TS = process.env.TS_URL || 'http://localhost:3099';
const GO = process.env.GO_URL || 'http://localhost:8099';
let fails = 0;

async function call(base, method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
const ts = (...a) => call(TS, ...a);
const go = (...a) => call(GO, ...a);
function check(name, cond, extra) {
  if (cond) console.log('OK  ', name);
  else { fails++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ''); }
}

let r = await ts('POST', '/auth/login', { login: 'admin', password: 'admin123' });
const admin = r.body;
check('admin login', r.status === 200, r.body);

// люди: МОЛ Мастер, работник Рабочий (без учётки)
r = await ts('POST', '/persons', { lastName: 'Мастеров', firstName: 'Мастер', position: 'Сервис', isMol: true }, admin.access_token);
const master = r.body;
r = await ts('POST', '/persons', { lastName: 'Рабочий', firstName: 'Иван' }, admin.access_token);
const worker = r.body;
check('persons', master.id && worker.id, [master, worker]);

// refresh-токен в go не принимается
r = await go('GET', '/assets', null, admin.refresh_token);
check('go rejects refresh token', r.status === 401, r.body);

// актив: админ создаёт, МОЛ — он сам (по умолчанию, admin is_mol)
r = await go('POST', '/assets', { name: 'Ноутбук', category: 'ноутбук', inventory_num: 'E2E-1', description: '' }, admin.access_token);
check('create asset', r.status === 201 && r.body.mol && r.body.mol.person_id === admin.user.personId && r.body.mol.ack_status === 'accepted', r.body);
const asset = r.body;

// передать МОЛ: не МОЛ нельзя (проверка через ts), МОЛ можно
r = await go('POST', `/assets/${asset.uuid}/mol`, { person_id: worker.id }, admin.access_token);
check('transfer to non-mol rejected (ts check)', r.status === 400, r.body);
r = await go('POST', `/assets/${asset.uuid}/mol`, { person_id: master.id, comment: 'в ремонт' }, admin.access_token);
check('transfer to mol', r.status === 200 && r.body.ack_status === 'pending', r.body);
r = await go('POST', `/assets/${asset.uuid}/users`, { person_id: worker.id }, admin.access_token);
check('add worker', r.status === 200, r.body);

// ts: снять МОЛ у мастера нельзя — за ним числится актив
r = await ts('POST', `/persons/${master.id}/mol`, { isMol: false }, admin.access_token);
check('cannot unset mol while holding asset (ts→go)', r.status === 409, r.body);
r = await ts('POST', `/persons/${master.id}/dismiss`, null, admin.access_token);
check('cannot dismiss mol with asset (ts→go)', r.status === 409, r.body);

// увольнение работника: роли «работает с активом» закрываются в go
r = await ts('POST', `/persons/${worker.id}/dismiss`, null, admin.access_token);
check('dismiss worker', r.status === 200 && r.body.isActive === false, r.body);
r = await go('GET', `/assets/${asset.uuid}`, null, admin.access_token);
check('worker role closed in go', r.status === 200 && r.body.users.length === 0 && r.body.mol.person_id === master.id, r.body);

// списание закрывает роль МОЛ → теперь мастера можно лишить МОЛ
r = await go('POST', `/assets/${asset.uuid}/status`, { accounting_status: 'decommissioned', comment: 'старый' }, admin.access_token);
check('decommission', r.status === 200 && r.body.accounting_status === 'decommissioned' && r.body.mol === null, r.body);
r = await ts('POST', `/persons/${master.id}/mol`, { isMol: false }, admin.access_token);
check('unset mol after decommission', r.status === 200 && r.body.isMol === false, r.body);

// «Без МОЛ», ремонт, заявка на ремонт
r = await go('POST', '/assets', { name: 'Принтер', category: 'принтер', mol_person_id: '' }, admin.access_token);
check('create without mol', r.status === 201 && r.body.mol === null, r.body);
const printer = r.body;
r = await go('GET', '/assets?no_mol=true', null, admin.access_token);
check('no_mol filter', r.status === 200 && r.body.assets.length === 1 && r.body.assets[0].uuid === printer.uuid, r.body);
r = await go('POST', '/requests', { asset_uuid: printer.uuid, message: 'Зажёвывает бумагу', mark_faulty: true }, admin.access_token);
check('repair request', r.status === 201 && r.body.status === 'new', r.body);
const req = r.body;
r = await go('POST', `/assets/${printer.uuid}/repair/start`, { kind: 'repair', expected_return_at: '2020-01-01', request_id: req.uuid }, admin.access_token);
check('repair start', r.status === 200 && r.body.accounting_status === 'repair' && r.body.open_repair && r.body.open_repair.overdue === true && r.body.condition === 'faulty', r.body);
r = await go('POST', `/assets/${printer.uuid}/repair/finish`, { result_condition: 'ok', work_done: 'почистили ролик' }, admin.access_token);
check('repair finish', r.status === 200 && r.body.accounting_status === 'in_use' && r.body.condition === 'ok', r.body);
r = await go('GET', `/requests/${req.uuid}`, null, admin.access_token);
check('request done', r.body.status === 'done', r.body);
r = await go('GET', `/assets/${printer.uuid}/history`, null, admin.access_token);
check('history', r.status === 200 && r.body.status.length >= 3 && r.body.repairs.length === 1, r.body);

// участник: регистрация через поиск, одобрение, видимость и «Мне назначено»
r = await ts('GET', '/organizations/search?q=' + encodeURIComponent('тест'));
const orgId = r.body[0].id;
r = await ts('POST', '/auth/register', { login: 'e2emember', password: 'pass1234', organizationId: orgId, lastName: 'Участников', firstName: 'Учас' });
const reg = r.body;
r = await ts('POST', `/registrations/${reg.id}/approve`, {}, admin.access_token);
check('approve', r.status === 201, r.body);
r = await ts('POST', '/auth/login', { login: 'e2emember', password: 'pass1234' });
const member = r.body;
r = await go('GET', '/assets', null, member.access_token);
check('member sees nothing yet', r.status === 200 && r.body.assets.length === 0, r.body);
r = await go('POST', `/assets/${printer.uuid}/users`, { person_id: member.user.personId }, admin.access_token);
check('assign member', r.status === 200, r.body);
r = await go('GET', '/me/assignments', null, member.access_token);
check('my assignments', r.status === 200 && r.body.length === 1 && r.body[0].asset.uuid === printer.uuid, r.body);
const roleId = r.body[0].id;
r = await go('POST', `/asset-roles/${roleId}/ack`, { action: 'dispute', reason: 'у меня его нет' }, member.access_token);
check('dispute', r.status === 200 && r.body.ack_status === 'disputed', r.body);
r = await go('GET', '/asset-roles/disputes', null, member.access_token);
check('member cannot see disputes', r.status === 403, r.body);
r = await go('GET', '/asset-roles/disputes', null, admin.access_token);
check('admin disputes', r.status === 200 && r.body.length === 1, r.body);
r = await go('POST', `/asset-roles/${roleId}/resolve`, { resolution: 'оставить' }, admin.access_token);
check('resolve', r.status === 200, r.body);
r = await go('POST', `/assets/${printer.uuid}/status`, { condition: 'needs_attention' }, member.access_token);
check('worker marks needs_attention', r.status === 200 && r.body.condition === 'needs_attention', r.body);
r = await go('POST', `/assets/${printer.uuid}/status`, { accounting_status: 'in_stock' }, member.access_token);
check('worker cannot change accounting', r.status === 403, r.body);
r = await go('POST', `/assets/${printer.uuid}/mol`, { person_id: admin.user.personId }, member.access_token);
check('worker cannot transfer', r.status === 403, r.body);

// старый эндпоинт без проверки прав (дыра этапа 0) теперь закрыт
r = await go('GET', '/assets/change-requests', null, member.access_token);
check('change-requests need review perm', r.status === 403, r.body);

// фото: presigned (заглушка Яндекса) и «наполнена» в ts
r = await go('POST', '/photos/upload-url', { filename: 'a.jpg', content_type: 'image/jpeg', file_size: 100 }, member.access_token);
check('photo upload url', r.status === 200 && r.body.photo_uuid, r.body);

// журнал go
r = await go('GET', '/audit', null, admin.access_token);
check('audit go', r.status === 200 && r.body.some((x) => x.action === 'transfer.apply') && r.body.some((x) => x.actor_type === 'system'), r.body.slice ? r.body.slice(0, 3) : r.body);

// категории: L1 общие видны, L2 — своей организации
r = await go('GET', '/categories/search?q=', null, member.access_token);
check('categories visible', r.status === 200 && r.body.length >= 5, r.body);
r = await go('POST', '/categories', { name: 'Общая', level: 1 }, admin.access_token);
check('L1 only for platform org', r.status === 403, r.body);
r = await go('POST', '/categories', { name: 'Своя', level: 2 }, admin.access_token);
check('L2 for own org', r.status === 201, r.body);

console.log(fails === 0 ? '\nALL OK' : `\n${fails} FAILED`);
process.exit(fails ? 1 : 0);
