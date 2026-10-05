'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LeadDetail, LeadRow, Source } from '@/lib/leads';

const SOURCE_LABEL: Record<Source, string> = { bot: 'бот', manual: 'вручную' };
const SOURCE_ICON: Record<Source, string> = { bot: '🤖', manual: '✍️' };
const VERDICTS = ['подходит', 'не подходит', 'уточнить'];
const REFRESH_MS = 5000;

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const fmtDate = (s: string) => dateFmt.format(new Date(s));

type Filters = {
  date: string; name: string; contact: string; source: string; niche: string; budget: string; verdict: string; tag: string;
};
const emptyFilters: Filters = { date: '', name: '', contact: '', source: '', niche: '', budget: '', verdict: '', tag: '' };

const includes = (value: string | null, query: string) =>
  !query || (value ?? '').toLowerCase().includes(query.trim().toLowerCase());

export default function Crm() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/leads', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setLeads(data.leads);
    setTags(data.tags);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const niches = useMemo(
    () => [...new Set(leads.map((l) => l.niche).filter(Boolean) as string[])].sort(),
    [leads],
  );

  const visible = leads.filter((l) =>
    includes(fmtDate(l.created_at), filters.date) &&
    includes(l.name, filters.name) &&
    includes(l.contact, filters.contact) &&
    (!filters.source || l.source === filters.source) &&
    (!filters.niche || l.niche === filters.niche) &&
    includes(l.budget, filters.budget) &&
    (!filters.verdict || l.verdict === filters.verdict) &&
    (!filters.tag || l.tags.includes(filters.tag)),
  );

  const set = (key: keyof Filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  const filtered = Object.values(filters).some(Boolean);

  return (
    <main>
      <div className="toolbar">
        <div className="counter">
          <strong>{visible.length}</strong>
          <span className="muted"> {filtered ? `из ${leads.length}` : 'заявок'}</span>
          {filtered && (
            <button className="link" onClick={() => setFilters(emptyFilters)}>Сбросить фильтры</button>
          )}
        </div>
        <button className="primary" onClick={() => setAdding(true)}>+ Добавить заявку</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Дата</th><th>Имя</th><th>Контакт</th><th>Источник</th><th>Ниша</th><th>Бюджет</th><th>Оценка</th><th>Теги</th>
            </tr>
            <tr className="filters">
              <th><input placeholder="05.10" value={filters.date} onChange={set('date')} /></th>
              <th><input placeholder="Поиск" value={filters.name} onChange={set('name')} /></th>
              <th><input placeholder="Поиск" value={filters.contact} onChange={set('contact')} /></th>
              <th>
                <select value={filters.source} onChange={set('source')}>
                  <option value="">Все</option>
                  {Object.entries(SOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </th>
              <th>
                <select value={filters.niche} onChange={set('niche')}>
                  <option value="">Все</option>
                  {niches.map((n) => <option key={n}>{n}</option>)}
                </select>
              </th>
              <th><input placeholder="Поиск" value={filters.budget} onChange={set('budget')} /></th>
              <th>
                <select value={filters.verdict} onChange={set('verdict')}>
                  <option value="">Все</option>
                  {VERDICTS.map((v) => <option key={v}>{v}</option>)}
                </select>
              </th>
              <th>
                <select value={filters.tag} onChange={set('tag')}>
                  <option value="">Все</option>
                  {tags.map((t) => <option key={t}>{t}</option>)}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.id} className="row" onClick={() => setOpenId(l.id)}>
                <td className="nowrap muted">{fmtDate(l.created_at)}</td>
                <td>
                  <div className="person">
                    <Avatar name={l.name} />
                    <span className="person-name">{l.name}</span>
                  </div>
                </td>
                <td className="nowrap">{l.contact ?? <span className="muted">—</span>}</td>
                <td><SourceBadge source={l.source} /></td>
                <td>{l.niche ?? <span className="muted">—</span>}</td>
                <td className="nowrap">{l.budget ?? <span className="muted">—</span>}</td>
                <td>{l.verdict ? <Verdict v={l.verdict} /> : <span className="pending">оценивается…</span>}</td>
                <td><div className="tags">{l.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
              </tr>
            ))}
            {loaded && visible.length === 0 && (
              <tr><td colSpan={8} className="empty">Ничего не найдено</td></tr>
            )}
            {!loaded && (
              <tr><td colSpan={8} className="empty">Загрузка…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openId !== null && (
        <LeadModal id={openId} allTags={tags} onClose={() => setOpenId(null)} onChange={load} />
      )}
      {adding && (
        <AddModal
          onClose={() => setAdding(false)}
          onSaved={(id) => { setAdding(false); load(); setOpenId(id); }}
        />
      )}
    </main>
  );
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 45% 32%)` }}
    >
      {initials}
    </span>
  );
}

function SourceBadge({ source }: { source: Source }) {
  return <span className="source">{SOURCE_ICON[source]} {SOURCE_LABEL[source]}</span>;
}

function Verdict({ v }: { v: string }) {
  const cls = v === 'подходит' ? 'good' : v === 'не подходит' ? 'bad' : 'maybe';
  return <span className={`verdict ${cls}`}>{v}</span>;
}

function Modal({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="icon" title="Закрыть" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LeadModal({ id, allTags, onClose, onChange }: {
  id: number; allTags: string[]; onClose: () => void; onChange: () => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [newTag, setNewTag] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${id}`, { cache: 'no-store' });
    if (res.ok) setLead(await res.json());
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const changeTag = async (method: 'POST' | 'DELETE', name: string) => {
    await fetch(`/api/leads/${id}/tags`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await load();
    onChange();
  };

  const remove = async () => {
    if (!confirm(`Удалить заявку «${lead?.name}» вместе с перепиской?`)) return;
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    onChange();
    onClose();
  };

  if (!lead) return <Modal title="Заявка" onClose={onClose}><p className="muted">Загрузка…</p></Modal>;

  const title = (
    <div className="person">
      <Avatar name={lead.name} size={42} />
      <div>
        <h2>{lead.name}</h2>
        <div className="muted">{lead.contact ?? 'контакт не указан'}</div>
      </div>
    </div>
  );

  return (
    <Modal title={title} onClose={onClose}>
      <div className="facts">
        <Fact label="Оценка">
          {lead.verdict ? <Verdict v={lead.verdict} /> : <span className="pending">оценивается…</span>}
        </Fact>
        <Fact label="Ниша">{lead.niche ?? '—'}</Fact>
        <Fact label="Бюджет">{lead.budget ?? '—'}</Fact>
        <Fact label="Источник"><SourceBadge source={lead.source} /></Fact>
        <Fact label="Дата">{fmtDate(lead.created_at)}</Fact>
        <Fact label="Что хочет" wide>{lead.wants ?? '—'}</Fact>
      </div>

      <div className="ai-note">
        <span className="ai-label">Пояснение ИИ</span>
        {lead.reason ?? '—'}
      </div>

      <h3>Теги</h3>
      <div className="tags">
        {lead.tags.map((t) => (
          <span key={t} className="tag removable">
            {t}
            <button title="Убрать тег" onClick={() => changeTag('DELETE', t)}>×</button>
          </span>
        ))}
        {lead.tags.length === 0 && <span className="muted">Тегов нет</span>}
      </div>
      <form
        className="tag-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (newTag.trim()) changeTag('POST', newTag).then(() => setNewTag(''));
        }}
      >
        <input
          list="all-tags"
          placeholder="Новый или существующий тег"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
        />
        <datalist id="all-tags">
          {allTags.filter((t) => !lead.tags.includes(t)).map((t) => <option key={t} value={t} />)}
        </datalist>
        <button type="submit" className="primary">Добавить</button>
      </form>

      <h3>Переписка</h3>
      <div className="chat">
        {lead.messages.map((m) => (
          <div key={m.id} className={`msg ${m.author}`}>
            <div>{m.text}</div>
            <time>{m.author === 'bot' ? 'бот · ' : ''}{fmtDate(m.created_at)}</time>
          </div>
        ))}
        {lead.messages.length === 0 && <p className="muted">Сообщений нет</p>}
      </div>

      <div className="modal-foot">
        <button className="danger" onClick={remove}>Удалить заявку</button>
      </div>
    </Modal>
  );
}

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`fact${wide ? ' wide' : ''}`}>
      <span className="fact-label">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const [form, setForm] = useState({ name: '', contact: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? 'Ошибка');
    onSaved(data.id);
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Modal title={<h2>Новая заявка</h2>} onClose={onClose}>
      <form className="add-form" onSubmit={submit}>
        <label>Имя<input required {...field('name')} /></label>
        <label>Контакт<input placeholder="@username или телефон" {...field('contact')} /></label>
        <label>Текст запроса<textarea required rows={4} {...field('text')} /></label>
        <p className="muted hint">После сохранения ИИ оценит заявку и поставит теги.</p>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
      </form>
    </Modal>
  );
}
