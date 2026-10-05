import { evaluateLead } from './ai';
import { getTranscript, saveEvaluation } from './leads';

// Оценивает заявку по всей переписке и ставит теги. Возвращает оценку.
export async function evaluateAndSave(leadId: number) {
  const ev = await evaluateLead(await getTranscript(leadId));
  await saveEvaluation(leadId, ev);
  return ev;
}
