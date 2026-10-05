import { sql } from './db';

export type Source = 'bot' | 'manual';
export type Verdict = 'подходит' | 'не подходит' | 'уточнить';

export type LeadRow = {
  id: number;
  created_at: string;
  name: string;
  contact: string | null;
  source: Source;
  niche: string | null;
  budget: string | null;
  verdict: Verdict | null;
  tags: string[];
};

export type Message = { id: number; author: 'client' | 'bot'; text: string; created_at: string };

export type LeadDetail = LeadRow & {
  wants: string | null;
  reason: string | null;
  messages: Message[];
};

export function normalizeTag(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
}

const tagsSubquery = `coalesce((
  select array_agg(t.name order by t.name)
  from lead_tags lt join tags t on t.id = lt.tag_id
  where lt.lead_id = l.id
), '{}') as tags`;

export async function listLeads(): Promise<LeadRow[]> {
  return (await sql.query(
    `select l.id, l.created_at, l.name, l.contact, l.source, l.niche, l.budget, l.verdict, ${tagsSubquery}
     from leads l order by l.created_at desc`,
  )) as LeadRow[];
}

export async function listTags(): Promise<string[]> {
  const rows = await sql`select name from tags order by name`;
  return rows.map((r) => r.name as string);
}

export async function getLead(id: number): Promise<LeadDetail | null> {
  const [lead] = await sql.query(
    `select l.id, l.created_at, l.name, l.contact, l.source, l.niche, l.budget, l.wants,
            l.verdict, l.reason, ${tagsSubquery}
     from leads l where l.id = $1`,
    [id],
  );
  if (!lead) return null;
  const messages = await sql`
    select id, author, text, created_at from messages where lead_id = ${id} order by created_at, id`;
  return { ...(lead as LeadDetail), messages: messages as Message[] };
}

export async function createLead(input: { name: string; contact: string; source: Source; tgUserId?: number }) {
  const [row] = await sql`
    insert into leads (name, contact, source, tg_user_id)
    values (${input.name}, ${input.contact || null}, ${input.source}, ${input.tgUserId ?? null})
    returning id`;
  return row.id as number;
}

export type BotLead = { id: number; contact: string | null; awaiting: string | null; questions_asked: number };

// Один человек — одна заявка: повторные сообщения дописываются в неё.
export async function getOrCreateBotLead(tgUserId: number, name: string, username: string | null) {
  const [created] = await sql`
    insert into leads (name, contact, source, tg_user_id)
    values (${name}, ${username}, 'bot', ${tgUserId})
    on conflict (source, tg_user_id) where tg_user_id is not null do nothing
    returning id, contact, awaiting, questions_asked`;
  if (created) return { lead: created as BotLead, created: true };
  const [lead] = await sql`
    update leads set contact = coalesce(contact, ${username})
    where source = 'bot' and tg_user_id = ${tgUserId}
    returning id, contact, awaiting, questions_asked`;
  return { lead: lead as BotLead, created: false };
}

export async function setBotState(leadId: number, awaiting: string | null, contact?: string) {
  await sql`
    update leads set awaiting = ${awaiting}, contact = coalesce(${contact ?? null}, contact)
    where id = ${leadId}`;
}

// переписка и теги заявки удаляются каскадом
export async function deleteLead(id: number) {
  await sql`delete from leads where id = ${id}`;
}

export async function addMessage(leadId: number, author: 'client' | 'bot', text: string) {
  await sql`insert into messages (lead_id, author, text) values (${leadId}, ${author}, ${text})`;
}

export async function addTag(leadId: number, rawName: string, auto = false) {
  const name = normalizeTag(rawName);
  if (!name) return;
  // ручной тег «закрепляет» тег, даже если раньше его поставил ИИ
  await sql`
    with t as (
      insert into tags (name) values (${name})
      on conflict (name) do update set name = excluded.name
      returning id
    )
    insert into lead_tags (lead_id, tag_id, auto) select ${leadId}, id, ${auto} from t
    on conflict (lead_id, tag_id) do update set auto = lead_tags.auto and excluded.auto`;
}

export async function getTranscript(leadId: number) {
  const rows = await sql`select author, text from messages where lead_id = ${leadId} order by created_at, id`;
  return rows.map((m) => `${m.author === 'bot' ? 'Бот' : 'Клиент'}: ${m.text}`).join('\n');
}

export async function saveEvaluation(
  leadId: number,
  ev: { niche: string | null; budget: string | null; wants: string | null; verdict: Verdict; reason: string },
) {
  await sql`
    update leads set niche = ${ev.niche}, budget = ${ev.budget}, wants = ${ev.wants},
                     verdict = ${ev.verdict}, reason = ${ev.reason}
    where id = ${leadId}`;
  // ниша и оценка — автотеги: старые снимаем, ручные теги не трогаем
  await sql`delete from lead_tags where lead_id = ${leadId} and auto`;
  for (const name of [ev.niche, ev.verdict]) if (name) await addTag(leadId, name, true);
}

export async function countQuestion(leadId: number) {
  await sql`update leads set questions_asked = questions_asked + 1, awaiting = 'answer' where id = ${leadId}`;
}

export async function removeTag(leadId: number, rawName: string) {
  const name = normalizeTag(rawName);
  await sql`
    delete from lead_tags
    where lead_id = ${leadId} and tag_id = (select id from tags where name = ${name})`;
}
