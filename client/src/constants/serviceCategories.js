export const SERVICE_CATEGORIES = [
  { value: 'haircut', label: 'Haircut' },
  { value: 'beard', label: 'Beard & mustache' },
  { value: 'shave', label: 'Shave' },
  { value: 'color', label: 'Hair color' },
  { value: 'treatment', label: 'Hair & scalp treatment' },
  { value: 'kids', label: 'Kids haircut' },
  { value: 'massage', label: 'Head massage' },
  { value: 'other', label: 'Other service' },
];

export const normalizeServiceCategory = category => {
  const value = String(category || '').trim().toLowerCase();
  if (!value) return 'haircut';
  const normalized = value === 'coloring' ? 'color' : value;
  return SERVICE_CATEGORIES.some(option => option.value === normalized) ? normalized : 'other';
};
