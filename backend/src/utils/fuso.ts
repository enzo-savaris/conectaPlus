/**
 * Horário de Brasília, usado em todas as datas da plataforma, seja qual for o
 * fuso do servidor (o MySQL do alwaysdata roda no fuso da Europa). O Brasil
 * não tem horário de verão desde 2019, então o deslocamento fixo é seguro.
 */
export const FUSO_BRASILIA = '-03:00';
