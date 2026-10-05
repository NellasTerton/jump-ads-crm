const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function tg<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result as T;
}

export async function getBotUsername(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/getMe`, { next: { revalidate: 3600 } });
    const json = await res.json();
    return json.result?.username ?? null;
  } catch {
    return null;
  }
}
