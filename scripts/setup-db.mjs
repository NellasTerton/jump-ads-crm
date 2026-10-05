// Создаёт таблицы и, если заявок ещё нет, заливает демо-данные.
// Запуск: npm run db:setup
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';
import { demoLeads } from '../db/seed.mjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
console.log('Схема готова');

const { rows } = await pool.query('select count(*)::int as n from leads');
if (rows[0].n > 0) {
  console.log(`Заявок уже ${rows[0].n}, демо-данные не добавляю`);
} else {
  for (const l of demoLeads) {
    const created = new Date(Date.now() - l.daysAgo * 86400000 - Math.random() * 36e5 * 8);
    const { rows: [lead] } = await pool.query(
      `insert into leads (created_at, name, contact, source, niche, budget, wants, verdict, reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [created, l.name, l.contact, l.source, l.niche, l.budget, l.wants, l.verdict, l.reason],
    );
    for (const [i, [author, text]] of l.messages.entries()) {
      await pool.query(
        'insert into messages (lead_id, author, text, created_at) values ($1, $2, $3, $4)',
        [lead.id, author, text, new Date(created.getTime() + i * 60000)],
      );
    }
    const tags = [
      ...[l.niche, l.verdict].filter(Boolean).map((name) => [name, true]),
      ...(l.tags ?? []).map((name) => [name, false]),
    ];
    for (const [name, auto] of tags) {
      await pool.query(
        `with t as (insert into tags (name) values ($1) on conflict (name) do update set name = excluded.name returning id)
         insert into lead_tags (lead_id, tag_id, auto) select $2, id, $3 from t`,
        [name, lead.id, auto],
      );
    }
  }
  console.log(`Добавлено демо-заявок: ${demoLeads.length}`);
}

await pool.end();
