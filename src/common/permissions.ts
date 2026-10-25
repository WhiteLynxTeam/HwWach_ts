// Системные роли и права (org-roles-plan.md, 2.4 и 3.6).
// uuid встроенных ролей фиксированы: роль admin используется литералом
// в частичном индексе «один админ на организацию» (миграция OrgRoles).

export const ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000001';
export const ASSET_MANAGER_ROLE_ID = '00000000-0000-4000-8000-000000000002';
export const REVIEWER_ROLE_ID = '00000000-0000-4000-8000-000000000003';
export const MEMBER_ROLE_ID = '00000000-0000-4000-8000-000000000004';
export const OBSERVER_ROLE_ID = '00000000-0000-4000-8000-000000000005';

export enum RoleCode {
  ADMIN = 'admin',
  ASSET_MANAGER = 'asset_manager',
  REVIEWER = 'reviewer',
  MEMBER = 'member',
  OBSERVER = 'observer',
}

export enum Perm {
  ORG_MANAGE = 'org.manage',
  PERSONS_MANAGE = 'persons.manage',
  PERSONS_CREATE_BASIC = 'persons.create_basic',
  ACCOUNTS_MANAGE = 'accounts.manage',
  ASSETS_MANAGE = 'assets.manage',
  ASSETS_VIEW_ALL = 'assets.view_all',
  ASSETS_PROPOSE = 'assets.propose',
  ASSETS_STATUS = 'assets.status',
  ASSETS_DECOMMISSION = 'assets.decommission',
  ASSET_ROLES_ASSIGN = 'asset_roles.assign',
  TRANSFERS_OWN = 'transfers.own',
  CATEGORIES_MANAGE = 'categories.manage',
  CHANGE_REQUESTS_REVIEW = 'change_requests.review',
  PHOTOS_REVIEW = 'photos.review',
  REQUESTS_CREATE = 'requests.create',
  AUDIT_VIEW = 'audit.view',
}

export const PERMISSION_DESCRIPTIONS: Record<Perm, string> = {
  [Perm.ORG_MANAGE]: 'Настройки организации, приглашения',
  [Perm.PERSONS_MANAGE]: 'Люди: изменение, увольнение, признак МОЛ',
  [Perm.PERSONS_CREATE_BASIC]: 'Завести человека (ФИО, должность) без учётной записи; участнику — только если он МОЛ',
  [Perm.ACCOUNTS_MANAGE]: 'Учётные записи, роли, заявки на регистрацию, сброс пароля',
  [Perm.ASSETS_MANAGE]: 'Карточки активов: одобрение, изменение, удаление',
  [Perm.ASSETS_VIEW_ALL]: 'Все активы организации',
  [Perm.ASSETS_PROPOSE]: 'Съёмка, предложение карточек',
  [Perm.ASSETS_STATUS]: 'Учётный статус и техническое состояние любого актива',
  [Perm.ASSETS_DECOMMISSION]: 'Списать / вернуть из списанных',
  [Perm.ASSET_ROLES_ASSIGN]: 'Назначать бизнес-роли и передавать любые активы',
  [Perm.TRANSFERS_OWN]: 'МОЛ: передавать свои активы, назначать работающих',
  [Perm.CATEGORIES_MANAGE]: 'Категории организации',
  [Perm.CHANGE_REQUESTS_REVIEW]: 'Заявки на изменение актива',
  [Perm.PHOTOS_REVIEW]: 'Очередь фото',
  [Perm.REQUESTS_CREATE]: 'Заявка на ремонт',
  [Perm.AUDIT_VIEW]: 'Журнал действий',
};

const ALL = Object.values(Perm);

export const ROLE_PERMISSIONS: Record<RoleCode, Perm[]> = {
  [RoleCode.ADMIN]: ALL,
  [RoleCode.ASSET_MANAGER]: [
    Perm.PERSONS_CREATE_BASIC,
    Perm.ASSETS_MANAGE,
    Perm.ASSETS_VIEW_ALL,
    Perm.ASSETS_PROPOSE,
    Perm.ASSETS_STATUS,
    Perm.ASSET_ROLES_ASSIGN,
    Perm.TRANSFERS_OWN,
    Perm.CATEGORIES_MANAGE,
    Perm.CHANGE_REQUESTS_REVIEW,
    Perm.PHOTOS_REVIEW,
    Perm.REQUESTS_CREATE,
  ],
  [RoleCode.REVIEWER]: [
    Perm.PHOTOS_REVIEW,
    Perm.ASSETS_VIEW_ALL,
    Perm.ASSETS_PROPOSE,
    Perm.TRANSFERS_OWN,
    Perm.REQUESTS_CREATE,
  ],
  // transfers.own и persons.create_basic у участника действуют, только если он МОЛ
  [RoleCode.MEMBER]: [Perm.ASSETS_PROPOSE, Perm.TRANSFERS_OWN, Perm.PERSONS_CREATE_BASIC, Perm.REQUESTS_CREATE],
  [RoleCode.OBSERVER]: [Perm.ASSETS_VIEW_ALL],
};

export const BUILTIN_ROLES: { id: string; code: RoleCode; name: string; sortOrder: number }[] = [
  { id: ADMIN_ROLE_ID, code: RoleCode.ADMIN, name: 'Администратор', sortOrder: 1 },
  { id: ASSET_MANAGER_ROLE_ID, code: RoleCode.ASSET_MANAGER, name: 'Менеджер активов', sortOrder: 2 },
  { id: REVIEWER_ROLE_ID, code: RoleCode.REVIEWER, name: 'Ревьюер', sortOrder: 3 },
  { id: MEMBER_ROLE_ID, code: RoleCode.MEMBER, name: 'Участник', sortOrder: 4 },
  { id: OBSERVER_ROLE_ID, code: RoleCode.OBSERVER, name: 'Наблюдатель', sortOrder: 5 },
];

export function roleIdByCode(code: string): string | undefined {
  return BUILTIN_ROLES.find((r) => r.code === code)?.id;
}
