export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function apenasCaracteresCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatarCnpj(valor: string): string {
  const bruto = apenasCaracteresCnpj(valor).slice(0, 14);

  return bruto
    .replace(/^(\w{2})(\w)/, '$1.$2')
    .replace(/^(\w{2})\.(\w{3})(\w)/, '$1.$2.$3')
    .replace(/\.(\w{3})(\w)/, '.$1/$2')
    .replace(/(\w{4})(\w{1,2})$/, '$1-$2');
}

export function formatarCep(valor: string): string {
  const bruto = apenasDigitos(valor).slice(0, 8);
  return bruto.length > 5 ? `${bruto.slice(0, 5)}-${bruto.slice(5)}` : bruto;
}

export function formatarTelefone(valor: string): string {
  const bruto = apenasDigitos(valor).slice(0, 11);

  if (bruto.length <= 2) {
    return bruto;
  }

  const ddd = `(${bruto.slice(0, 2)}) `;

  if (bruto.length <= 6) {
    return ddd + bruto.slice(2);
  }

  const corte = bruto.length > 10 ? 7 : 6;
  return `${ddd}${bruto.slice(2, corte)}-${bruto.slice(corte)}`;
}
