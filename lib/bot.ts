import type { Evaluation } from './ai';
import { evaluateAndSave } from './evaluate';
import { addMessage, countQuestion, getOrCreateBotLead, setBotState } from './leads';
import { tg } from './telegram';

const MAX_QUESTIONS = 2;

const TEXT = {
  start:
    'Здравствуйте! Я приму заявку на рекламу для вашего бизнеса. ' +
    'Напишите, чем вы занимаетесь, что нужно и какой бюджет.',
  askPhone: 'Подскажите, пожалуйста, номер телефона, чтобы менеджер мог с вами связаться. Можно нажать кнопку ниже.',
  askBoth: 'Расскажите, пожалуйста, чем занимается ваш бизнес и какой бюджет на рекламу в месяц вы рассматриваете?',
  askBusiness: 'Расскажите, пожалуйста, чем занимается ваш бизнес — что вы продаёте?',
  askBudget: 'Какой примерно бюджет на рекламу в месяц вы рассматриваете?',
  thanks: 'Спасибо! Заявка принята, менеджер скоро свяжется с вами.',
  added: 'Спасибо, добавили это к вашей заявке.',
};

type TgUser = { id: number; first_name: string; last_name?: string; username?: string };
export type TgMessage = {
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  contact?: { phone_number: string; user_id?: number };
};

const phoneKeyboard = {
  keyboard: [[{ text: '📱 Отправить номер', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

const isPhone = (s: string) => /^\+?[\d\s()-]{7,20}$/.test(s);
// 8 912 … и 912 … → +7912…
const normalizePhone = (s: string) => {
  let digits = s.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return `+${digits}`;
};

async function reply(chatId: number, leadId: number | null, text: string, keyboard?: object) {
  await tg('sendMessage', { chat_id: chatId, text, reply_markup: keyboard ?? { remove_keyboard: true } });
  if (leadId) await addMessage(leadId, 'bot', text);
}

export async function handleBotMessage(msg: TgMessage) {
  if (msg.chat.type !== 'private' || !msg.from) return;
  const chatId = msg.chat.id;
  const from = msg.from;
  const text = (msg.text ?? msg.caption ?? '').trim();

  if (text.startsWith('/start')) {
    await reply(chatId, null, TEXT.start);
    return;
  }

  // номер принимаем только свой, не пересланный чужой контакт
  const sharedPhone = msg.contact && msg.contact.user_id === from.id ? msg.contact.phone_number : null;
  if (!text && !sharedPhone) return;

  const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
  const { lead, created } = await getOrCreateBotLead(from.id, name, from.username ? `@${from.username}` : null);
  const alreadyDone = !created && !lead.awaiting;

  await addMessage(lead.id, 'client', sharedPhone ? normalizePhone(sharedPhone) : text);

  // Контакт: @username, а если его нет — телефон.
  let phone: string | undefined;
  if (!lead.contact) {
    const raw = sharedPhone ?? (lead.awaiting === 'phone' && isPhone(text) ? text : null);
    if (!raw) {
      await setBotState(lead.id, 'phone');
      await reply(chatId, lead.id, TEXT.askPhone, phoneKeyboard);
      return;
    }
    phone = normalizePhone(raw);
  }

  await setBotState(lead.id, null, phone);

  let ev: Evaluation | null = null;
  try {
    await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
    ev = await evaluateAndSave(lead.id);
  } catch (e) {
    // без оценки заявка всё равно сохранена — просто благодарим
    console.error('evaluate failed', lead.id, e);
  }

  const question = ev && lead.questions_asked < MAX_QUESTIONS ? questionFor(ev) : null;
  if (question) {
    await countQuestion(lead.id);
    await reply(chatId, lead.id, question);
    return;
  }
  await reply(chatId, lead.id, alreadyDone ? TEXT.added : TEXT.thanks);
}

// Спрашиваем, если непонятно, что за бизнес или какой бюджет.
function questionFor(ev: Evaluation) {
  if (!ev.niche && !ev.budget) return TEXT.askBoth;
  if (!ev.niche) return TEXT.askBusiness;
  if (!ev.budget) return TEXT.askBudget;
  return null;
}
