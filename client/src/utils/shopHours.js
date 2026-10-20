const SHOP_TIME_ZONE = 'Asia/Manila';

function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isShopOpen(openingTime, closingTime, now = new Date()) {
  const opening = toMinutes(openingTime) ?? 8 * 60;
  const closing = toMinutes(closingTime) ?? 20 * 60;
  if (opening === closing) return false;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHOP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  const current = hour * 60 + minute;

  return closing > opening
    ? current >= opening && current < closing
    : current >= opening || current < closing;
}
