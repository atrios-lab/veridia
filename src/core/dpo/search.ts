import type { KnowledgeProvision } from "./knowledge/types.ts";

/**
 * Lexical search over the knowledge base, in memory (design of the change
 * `assistente-do-dpo`, decision 3): the base is a few hundred provisions,
 * so BM25 over normalised tokens answers in microseconds, is deterministic
 * and needs neither a database extension nor an embedding call per question.
 * The triage step rewrites the person's question into search terms, which
 * covers most of the distance between how people ask and how laws say it.
 */

const STOPWORDS = new Set(
  (
    "a o e é de da do das dos em no na nos nas um uma uns umas por para pra com sem " +
    "se que qual quais quando como onde ou ao aos à às pelo pela pelos pelas seu sua " +
    "seus suas ele ela eles elas isso isto esse essa este esta meu minha nos nós " +
    "mais menos já não sim ser estar ter há foi são está pode posso devo deve " +
    "lei art artigo inciso paragrafo parágrafo caput"
  )
    .split(" ")
    .map(fold),
);

const SUFFIXES = [
  "amentos",
  "imentos",
  "amento",
  "imento",
  "acoes",
  "icoes",
  "idades",
  "idade",
  "mente",
  "acao",
  "icao",
  "ados",
  "adas",
  "idos",
  "idas",
  "oes",
  "aes",
  "ais",
  "eis",
  "ado",
  "ada",
  "ido",
  "ida",
  "ao",
  "ar",
  "er",
  "ir",
];

function fold(word: string): string {
  return word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** A rough Portuguese stem: good enough to meet "exclusão" and "excluir". */
function stem(word: string): string {
  if (/^\d/.test(word) || word.length <= 4) return word;
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      return word.slice(0, -suffix.length);
    }
  }
  if (word.endsWith("s")) word = word.slice(0, -1);
  if (/[aeo]$/.test(word) && word.length > 4) word = word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return (fold(text).match(/[a-z0-9]+/g) ?? [])
    .filter((word) => !STOPWORDS.has(word))
    .map(stem);
}

interface IndexedProvision {
  provision: KnowledgeProvision;
  terms: Map<string, number>;
  length: number;
}

export interface SearchIndex {
  docs: IndexedProvision[];
  documentFrequency: Map<string, number>;
  averageLength: number;
}

export function buildIndex(base: readonly KnowledgeProvision[]): SearchIndex {
  const documentFrequency = new Map<string, number>();
  const docs = base.map((provision) => {
    const tokens = tokenize(`${provision.citation} ${provision.text}`);
    const terms = new Map<string, number>();
    for (const token of tokens) terms.set(token, (terms.get(token) ?? 0) + 1);
    for (const term of terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    return { provision, terms, length: tokens.length };
  });
  const averageLength =
    docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(docs.length, 1);
  return { docs, documentFrequency, averageLength };
}

const K1 = 1.2;
const B = 0.75;

/** The `limit` provisions that best match `query`, best first. */
export function search(
  index: SearchIndex,
  query: string,
  limit = 10,
): KnowledgeProvision[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) return [];
  const total = index.docs.length;
  const scored = index.docs.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const frequency = doc.terms.get(term);
      if (!frequency) continue;
      const df = index.documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      score +=
        (idf * (frequency * (K1 + 1))) /
        (frequency + K1 * (1 - B + (B * doc.length) / index.averageLength));
    }
    return { provision: doc.provision, score };
  });
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.provision);
}
