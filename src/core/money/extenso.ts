/**
 * Valores em reais por extenso, como um requerimento ou uma guia os escreve
 * entre parênteses depois do número: "R$ 27.000,00 (vinte e sete mil
 * reais)". Até centenas de bilhões, que é muito além de qualquer imóvel.
 */

const UNITS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const TENS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/** 0 a 999. */
function triple(n: number): string {
  if (n === 100) return "cem";
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred) parts.push(HUNDREDS[hundred] as string);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest] as string);
    else {
      const ten = Math.floor(rest / 10);
      const unit = rest % 10;
      parts.push(
        unit ? `${TENS[ten]} e ${UNITS[unit]}` : (TENS[ten] as string),
      );
    }
  }
  return parts.join(" e ");
}

const SCALES: [singular: string, plural: string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
];

/** Um inteiro não negativo por extenso: 1.234 → "mil duzentos e trinta e quatro". */
export function integerInWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("valor inválido");
  }
  if (value === 0) return "zero";
  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) {
    groups.push(rest % 1000);
  }
  if (groups.length > SCALES.length)
    throw new RangeError("valor grande demais");

  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index] as number;
    if (!group) continue;
    const [singular, plural] = SCALES[index] as [string, string];
    // "mil", não "um mil".
    const number = index === 1 && group === 1 ? "" : triple(group);
    const scale = index === 0 ? "" : group === 1 ? singular : plural;
    words.push([number, scale].filter(Boolean).join(" "));
  }

  // O "e" de ligação: antes do último grupo quando ele é menor que cem ou
  // é uma centena redonda ("mil e quinhentos", "dois mil e cem"); nos
  // demais casos, só a vírgula implícita da fala ("mil duzentos e três").
  const last = groups.find((group) => group !== 0) ?? 0;
  if (words.length > 1 && (last < 100 || last % 100 === 0)) {
    const tail = words.pop() as string;
    return `${words.join(" ")} e ${tail}`;
  }
  return words.join(" ");
}

/**
 * Um valor em centavos por extenso, em reais: 2700000 → "vinte e sete mil
 * reais"; 150 → "um real e cinquenta centavos"; 1000000_00 → "um milhão de
 * reais".
 */
export function reaisInWords(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("valor inválido");
  }
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const parts: string[] = [];
  if (reais > 0) {
    const words = integerInWords(reais);
    // "um milhão de reais", "dois bilhões de reais": "de" depois de milhão
    // e bilhão redondos.
    const round = reais % 1_000_000 === 0;
    parts.push(
      `${words}${round ? " de" : ""} ${reais === 1 ? "real" : "reais"}`,
    );
  }
  if (centavos > 0) {
    parts.push(
      `${integerInWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`,
    );
  }
  return parts.length ? parts.join(" e ") : "zero real";
}
