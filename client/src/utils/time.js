export function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatQueueNumber(num) {
  if (num === null || num === undefined || num === '') return '—';
  return `#${String(num).padStart(3, '0')}`;
}
