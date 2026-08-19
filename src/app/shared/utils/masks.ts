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

export function formatarCpf(valor: string): string {
  const bruto = apenasDigitos(valor).slice(0, 11);

  return bruto
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/**
 * Aplica a máscara de CPF enquanto o usuário digita até 11 dígitos, e passa
 * a formatar como CNPJ a partir do 12º — usado no campo único de login, que
 * aceita os dois documentos.
 */
export function formatarCpfOuCnpj(valor: string): string {
  const digitos = apenasDigitos(valor);
  return digitos.length > 11 ? formatarCnpj(valor) : formatarCpf(digitos);
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
