// Локальная проверка бота без деплоя: забирает сообщения через getUpdates
// и пересылает их в локальный вебхук. Работает, только пока вебхук не установлен.
// Запуск: npm run dev, затем в другом окне npm run bot:poll
const token = process.env.TELEGRAM_BOT_TOKEN;
const target = process.argv[2] ?? 'http://localhost:3000/api/telegram';
let offset = 0;

console.log(`Слушаю бота, пересылаю в ${target}`);
for (;;) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offset, timeout: 30, allowed_updates: ['message'] }),
  }).then((r) => r.json());
  if (!res.ok) {
    console.error(res.description);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }
  for (const update of res.result) {
    offset = update.update_id + 1;
    const r = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET,
      },
      body: JSON.stringify(update),
    });
    console.log(update.update_id, JSON.stringify(update.message?.text ?? update.message?.contact ?? ''), r.status);
  }
}
