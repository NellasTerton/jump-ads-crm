// Ставит вебхук бота на задеплоенный сайт.
// Запуск: npm run webhook:set -- https://<ваш-домен>.vercel.app
const base = process.argv[2]?.replace(/\/$/, '');
if (!base) {
  console.error('Укажите адрес сайта: npm run webhook:set -- https://<ваш-домен>.vercel.app');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: `${base}/api/telegram`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }),
}).then((r) => r.json());
console.log(res);
