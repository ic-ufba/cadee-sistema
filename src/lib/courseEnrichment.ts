import type { CourseDetail } from '@/services/api';
import type { ComponenteCurricular } from '@/services/sigaaApi';
import { parseRequisitos } from '@/lib/requisitos';

type Ref = { code: string; name?: string; id_ref?: string };

function toAlternatives(groups: string[][], names: Map<string, string>): Ref[][] {
  return groups.map((alt) => alt.map((code) => (names.has(code) ? { code, name: names.get(code)! } : { code })));
}

function collectNames(detail: CourseDetail | undefined, live: ComponenteCurricular | undefined): Map<string, string> {
  const names = new Map<string, string>();
  const lists = [detail?.prerequisites, detail?.corequisites, detail?.equivalences];
  for (const list of lists) {
    for (const alt of list ?? []) {
      for (const item of alt ?? []) {
        const ref = item as Ref;
        if (ref?.code && ref.name) names.set(ref.code, ref.name);
      }
    }
  }
  for (const ref of [...(live?.requisito_de ?? []), ...(live?.equivalente_de ?? [])]) {
    if (ref.codigo && ref.nome) names.set(ref.codigo, ref.nome);
  }
  return names;
}

/**
 * Junta o detalhe da API estática com o detalhe ao vivo do SIGAA público.
 * O dado ao vivo ganha quando existe (ementa, carga horária, requisitos); o estático cobre o resto
 * e continua sendo a resposta inteira quando a API ao vivo não está configurada ou falhou.
 */
export function mergeCourseDetail(
  code: string,
  staticDetail: CourseDetail | undefined,
  live: ComponenteCurricular | undefined,
  knownNames?: Map<string, string>,
): CourseDetail | undefined {
  if (!live) return staticDetail;

  const names = new Map([...(knownNames ?? []), ...collectNames(staticDetail, live)]);
  const livePre = parseRequisitos(live.pre_requisitos);
  const liveCo = parseRequisitos(live.co_requisitos);
  const liveEq = parseRequisitos(live.equivalencias);

  const base: CourseDetail = staticDetail ?? {
    code,
    name: live.nome ?? code,
    equivalences: [],
    prerequisites: [],
    corequisites: [],
  };

  return {
    ...base,
    name: base.name || live.nome || code,
    description: live.ementa?.trim() || base.description,
    workload: live.carga_horaria_total ?? base.workload,
    department: base.department ?? live.unidade_responsavel ?? undefined,
    mode: base.mode ?? live.modalidade ?? undefined,
    // só troca quando o SIGAA trouxe uma expressão que deu pra ler
    prerequisites: livePre.length ? toAlternatives(livePre, names) : base.prerequisites,
    corequisites: liveCo.length ? toAlternatives(liveCo, names) : base.corequisites,
    equivalences: liveEq.length ? toAlternatives(liveEq, names) : base.equivalences,
  };
}
