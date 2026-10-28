// Отправка писем HwWach из ящика whitelynxteam.dev@gmail.com.
// Публикуется как веб-приложение (Execute as: Me, Who has access: Anyone) — инструкция в apps-script/README.md.
// Секрет — Project Settings → Script Properties, ключ SECRET (тот же, что APPS_SCRIPT_SECRET в Render)

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || req.secret !== secret) return reply({ ok: false, error: 'forbidden' });

    if (req.action === 'ping') {
      return reply({ ok: true, quota: MailApp.getRemainingDailyQuota() });
    }
    if (req.action === 'send') {
      if (!req.to || !req.subject || !req.text) return reply({ ok: false, error: 'to, subject, text required' });
      if (MailApp.getRemainingDailyQuota() < 1) return reply({ ok: false, error: 'daily quota exceeded' });
      MailApp.sendEmail({ to: req.to, subject: req.subject, body: req.text, name: req.name || 'HwWach' });
      return reply({ ok: true });
    }
    return reply({ ok: false, error: 'unknown action' });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Запустить один раз вручную из редактора: Google спросит разрешение на отправку почты
function authorize() {
  Logger.log('Квота на сегодня: ' + MailApp.getRemainingDailyQuota());
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
