const TIME_ZONE = 'Asia/Manila';

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const value = String(timeStr).trim();
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  const date = match
    ? new Date(`2024-01-01T${String(match[1]).padStart(2, '0')}:${match[2]}:00+08:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDate(dateValue, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!dateValue) return '';
  const value = String(dateValue).trim();
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Date.UTC(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 12))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', { ...options, timeZone: TIME_ZONE }).format(date);
}

export function formatDateTime(dateTimeValue) {
  if (!dateTimeValue) return '';
  const date = new Date(dateTimeValue);
  if (Number.isNaN(date.getTime())) return String(dateTimeValue);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatQueueNumber(num) {
  if (num === null || num === undefined || num === '') return '—';
  return `#${String(num).padStart(3, '0')}`;
}
