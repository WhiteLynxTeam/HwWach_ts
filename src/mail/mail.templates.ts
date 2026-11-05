import { MailMessage } from './mail.service';

// Тексты писем (8.2, 8.6). Код — в теме, чтобы его было видно в уведомлении
export const MailTemplates = {
  code(to: string, code: string, purpose: 'org_registration' | 'admin_handover' | 'password_reset'): MailMessage {
    const what = { org_registration: 'регистрации организации', admin_handover: 'передачи администрирования', password_reset: 'сброса пароля' }[purpose];
    return {
      to,
      subject: `Код подтверждения HwWach: ${code}`,
      text: `Код для ${what} в HwWach: ${code}\n\nКод действует 10 минут. Если вы ничего не запрашивали — просто удалите это письмо.`,
    };
  },

  emailTaken(to: string, orgName: string): MailMessage {
    return {
      to,
      subject: 'HwWach: на этот адрес уже есть организация',
      text:
        `На адрес ${to} уже зарегистрирована организация «${orgName}».\n\n` +
        'Войдите в приложение под этой почтой или восстановите пароль на экране входа («Забыли пароль?»).\n' +
        'Если вы ничего не запрашивали — просто удалите это письмо.',
    };
  },

  // Код сброса не отправлен: учётной записи с этой почтой нет или почта не подтверждена
  resetNoAccount(to: string, unverified: boolean): MailMessage {
    return {
      to,
      subject: 'HwWach: сброс пароля',
      text:
        (unverified
          ? `Адрес ${to} не подтверждён в вашей учётной записи HwWach, поэтому код по нему не отправляем.\n\n`
          : `Учётной записи HwWach с адресом ${to} нет.\n\n`) +
        'Восстановите пароль через администратора организации: на экране входа «Забыли пароль?» введите логин — заявка уйдёт ему.\n' +
        'Если вы ничего не запрашивали — просто удалите это письмо.',
    };
  },

  passwordChanged(to: string, login: string, orgName: string): MailMessage {
    return {
      to,
      subject: 'HwWach: пароль изменён',
      text:
        `Пароль учётной записи «${login}»${orgName ? ` в организации «${orgName}»` : ''} изменён по коду с этой почты. Все входы на других устройствах завершены.\n\n` +
        'Если это были не вы — сразу смените пароль через «Забыли пароль?» и сообщите администратору организации.',
    };
  },

  welcome(to: string, orgName: string, emptyDays: number): MailMessage {
    return {
      to,
      subject: `HwWach: организация «${orgName}» зарегистрирована`,
      text:
        `Организация «${orgName}» зарегистрирована, вы — её администратор. Логин — этот адрес почты.\n\n` +
        `Если за ${emptyDays} дней в организации ничего не появится (активы, фото, люди), она удалится автоматически.`,
    };
  },

  deletionWarning(to: string, orgName: string, daysLeft: number, date: Date): MailMessage {
    return {
      to,
      subject: `HwWach: организация «${orgName}» будет удалена через ${daysLeft} дн.`,
      text:
        `В организации «${orgName}» давно не было входов и изменений. ${date.toLocaleDateString('ru-RU')} она будет удалена.\n\n` +
        'Чтобы оставить организацию — просто войдите в приложение любым участником.\n' +
        'После удаления данные ещё 30 дней можно восстановить по просьбе.',
    };
  },
};
