import { after, NextResponse } from 'next/server';
import { evaluateAndSave } from '@/lib/evaluate';
import { addMessage, createLead, listLeads, listTags } from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [leads, tags] = await Promise.all([listLeads(), listTags()]);
  return NextResponse.json({ leads, tags });
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name ?? '').trim();
  const contact = String(body.contact ?? '').trim();
  const text = String(body.text ?? '').trim();
  if (!name || !text) {
    return NextResponse.json({ error: 'Нужны имя и текст запроса' }, { status: 400 });
  }
  const id = await createLead({ name, contact, source: 'manual' });
  await addMessage(id, 'client', text);
  // оцениваем после ответа: заявка сразу видна в таблице, оценка подтянется автообновлением
  after(() => evaluateAndSave(id).catch((e) => console.error('evaluate failed', id, e)));
  return NextResponse.json({ id });
}
