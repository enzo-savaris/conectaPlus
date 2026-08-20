import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { apenasCaracteresCnpj, apenasDigitos } from '../utils/masks';

export function validadorCnpj(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor = apenasCaracteresCnpj(controle.value ?? '');

    if (!valor) {
      return null;
    }

    return cnpjValido(valor) ? null : { cnpj: true };
  };
}

function calcularDigitoCpf(base: string): number {
  let soma = 0;
  let peso = base.length + 1;

  for (const caractere of base) {
    soma += Number(caractere) * peso--;
  }

  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(valor: string): boolean {
  if (valor.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(valor)) {
    return false;
  }

  const digito1 = calcularDigitoCpf(valor.slice(0, 9));
  const digito2 = calcularDigitoCpf(valor.slice(0, 10));

  return digito1 === Number(valor[9]) && digito2 === Number(valor[10]);
}

function cnpjValido(valor: string): boolean {
  if (valor.length !== 14) {
    return false;
  }

  if (!/^\d{2}$/.test(valor.slice(12))) {
    return false;
  }

  if (/^(\w)\1{13}$/.test(valor)) {
    return false;
  }

  const digitoVerificador = (tamanho: number): number => {
    let peso = tamanho - 7;
    let soma = 0;

    for (let i = 0; i < tamanho; i++) {
      soma += (valor.charCodeAt(i) - 48) * peso--;
      if (peso < 2) {
        peso = 9;
      }
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digitoVerificador(12) === Number(valor[12]) && digitoVerificador(13) === Number(valor[13]);
}

export function validadorCpf(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor = apenasDigitos(controle.value ?? '');

    if (!valor) {
      return null;
    }

    return cpfValido(valor) ? null : { cpf: true };
  };
}

/** Aceita tanto CPF (11 dígitos) quanto CNPJ (14), usado no campo único de login. */
export function validadorCpfOuCnpj(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const digitos = apenasDigitos(controle.value ?? '');

    if (!digitos) {
      return null;
    }

    if (digitos.length <= 11) {
      return cpfValido(digitos) ? null : { documento: true };
    }

    const cnpj = apenasCaracteresCnpj(controle.value ?? '');
    return cnpjValido(cnpj) ? null : { documento: true };
  };
}

export function validadorCep(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor = apenasDigitos(controle.value ?? '');
    if (!valor) {
      return null;
    }
    return valor.length === 8 ? null : { cep: true };
  };
}

export function validadorTelefone(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor = apenasDigitos(controle.value ?? '');
    if (!valor) {
      return null;
    }
    return valor.length === 10 || valor.length === 11 ? null : { telefone: true };
  };
}
