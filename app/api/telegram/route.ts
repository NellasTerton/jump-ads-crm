import { NextResponse } from 'next/server';
import { handleBotMessage } from '@/lib/bot';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const update = await req.json();
  try {
    // Telegram может прислать один апдейт повторно — обрабатываем один раз
    const [fresh] = await sql`
      insert into tg_updates (update_id) values (${update.update_id})
      on conflict do nothing returning update_id`;
    if (fresh && update.message) await handleBotMessage(update.message);
  } catch (e) {
    // отвечаем 200, иначе Telegram будет бесконечно повторять апдейт
    console.error('telegram update failed', update.update_id, e);
  }
  return NextResponse.json({ ok: true });
}
