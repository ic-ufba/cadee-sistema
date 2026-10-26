/**
 * Converte as expressões de requisito do SIGAA ("( MATA55 ) E ( MATA40 OU MATA57 )") no formato que o
 * CADEE já usa: uma lista de alternativas, cada uma com os códigos que precisam ser cumpridos juntos.
 */

type Token = { kind: 'code'; value: string } | { kind: 'and' } | { kind: 'or' } | { kind: 'open' } | { kind: 'close' };

const CODE = /^[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9.]*$/;

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  const parts = expr
    .toUpperCase()
    .replace(/[()]/g, (p) => ` ${p} `)
    .split(/\s+/)
    .filter(Boolean);
  for (const part of parts) {
    if (part === '(') tokens.push({ kind: 'open' });
    else if (part === ')') tokens.push({ kind: 'close' });
    else if (part === 'E' || part === 'AND' || part === '&&') tokens.push({ kind: 'and' });
    else if (part === 'OU' || part === 'OR' || part === '||') tokens.push({ kind: 'or' });
    else if (CODE.test(part)) tokens.push({ kind: 'code', value: part });
  }
  return tokens;
}

/** Forma normal disjuntiva: OU de E's. */
type Dnf = string[][];

const MAX_ALTERNATIVAS = 64;

function and(a: Dnf, b: Dnf): Dnf {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out: Dnf = [];
  for (const x of a) {
    for (const y of b) {
      out.push([...new Set([...x, ...y])]);
      if (out.length >= MAX_ALTERNATIVAS) return out;
    }
  }
  return out;
}

function parse(tokens: Token[]): Dnf {
  let pos = 0;

  // expr := term (OU term)*
  function expr(): Dnf {
    let result = term();
    while (tokens[pos]?.kind === 'or') {
      pos++;
      result = [...result, ...term()].slice(0, MAX_ALTERNATIVAS);
    }
    return result;
  }

  // term := factor (E? factor)*   — códigos colados sem operador contam como E
  function term(): Dnf {
    let result = factor();
    while (pos < tokens.length && tokens[pos].kind !== 'or' && tokens[pos].kind !== 'close') {
      if (tokens[pos].kind === 'and') pos++;
      result = and(result, factor());
    }
    return result;
  }

  function factor(): Dnf {
    const tok = tokens[pos];
    if (!tok) return [];
    if (tok.kind === 'code') {
      pos++;
      return [[tok.value]];
    }
    if (tok.kind === 'open') {
      pos++;
      const inner = expr();
      if (tokens[pos]?.kind === 'close') pos++;
      return inner;
    }
    pos++; // operador solto: ignora
    return [];
  }

  const result = expr();
  return result.filter((alt) => alt.length > 0);
}

export function parseRequisitos(expr: string | null | undefined): string[][] {
  if (!expr || !expr.trim() || expr.trim() === '-') return [];
  try {
    return parse(tokenize(expr));
  } catch {
    return [];
  }
}
