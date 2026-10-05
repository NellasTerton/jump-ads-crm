import { NextResponse } from 'next/server';
import { deleteLead, getLead } from '@/lib/leads';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const lead = await getLead(Number((await params).id));
  if (!lead) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  return NextResponse.json(lead);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await deleteLead(Number((await params).id));
  return NextResponse.json({ ok: true });
}
