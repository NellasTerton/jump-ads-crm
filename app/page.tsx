import Crm from './Crm';
import { getBotUsername } from '@/lib/telegram';

export default async function Page() {
  const bot = await getBotUsername();
  return (
    <>
      <header className="header">
        <div className="brand">
          <span className="logo">J</span>
          <div>
            <h1>Заявки агентства</h1>
            <span className="muted">Jump Ads · мини-CRM</span>
          </div>
        </div>
        {bot && (
          <a className="bot-link" href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">
            Бот @{bot} ↗
          </a>
        )}
      </header>
      <Crm />
    </>
  );
}
