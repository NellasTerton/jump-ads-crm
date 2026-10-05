import { NextResponse } from 'next/server';
import { addTag, removeTag } from '@/lib/leads';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { name } = await req.json();
  await addTag(Number((await params).id), String(name ?? ''));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { name } = await req.json();
  await removeTag(Number((await params).id), String(name ?? ''));
  return NextResponse.json({ ok: true });
}
