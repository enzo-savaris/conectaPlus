export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function onlyCnpjChars(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatCnpj(value: string): string {
  const raw = onlyCnpjChars(value).slice(0, 14);

  return raw
    .replace(/^(\w{2})(\w)/, '$1.$2')
    .replace(/^(\w{2})\.(\w{3})(\w)/, '$1.$2.$3')
    .replace(/\.(\w{3})(\w)/, '.$1/$2')
    .replace(/(\w{4})(\w{1,2})$/, '$1-$2');
}

export function formatCep(value: string): string {
  const raw = onlyDigits(value).slice(0, 8);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
}

export function formatPhone(value: string): string {
  const raw = onlyDigits(value).slice(0, 11);

  if (raw.length <= 2) {
    return raw;
  }

  const area = `(${raw.slice(0, 2)}) `;

  if (raw.length <= 6) {
    return area + raw.slice(2);
  }

  const split = raw.length > 10 ? 7 : 6;
  return `${area}${raw.slice(2, split)}-${raw.slice(split)}`;
}
