import { Fragment } from 'react';
import { useMySections } from '@/hooks/useMySections';
import { cn } from '@/lib/utils';
import { getSpplitedCode } from '@/lib/schedule';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Section } from '@/services/api';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CORES_GRADE_FUNDOS, textoDaCor, mapaDeCores, corDaGrade } from '@/lib/grade-cores';
import { getBlockCourseBaseCode } from '@/lib/blockCourses';

const days = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const hours = ['07:00', '07:55', '08:50', '09:45', '10:40', '11:35', '13:00', '13:55', '14:50', '15:45', '16:40', '17:35', '18:30', '19:25', '20:20', '21:15'];

const dayMap: Record<string, string> = {
  '2': 'SEG',
  '3': 'TER',
  '4': 'QUA',
  '5': 'QUI',
  '6': 'SEX',
  '7': 'SAB',
};

const horariosManha = ['07:00', '07:55', '08:50', '09:45', '10:40', '11:35'];
const horariosTarde = ['13:00', '13:55', '14:50', '15:45', '16:40', '17:35'];
const horariosNoite = ['18:30', '19:25', '20:20', '21:15'];

type ScheduledItem = {
  disciplineCode: string;
  disciplineName: string;
  classCode: string;
  professor: string;
  color: string;
  day: string;
  startTime: string;
  endTime: string;
  section: Section;
};

// Paleta CADEE (ver src/lib/grade-cores.ts) — o hash por código continua o mesmo.
const COLORS = CORES_GRADE_FUNDOS;

function colorFor(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = ((hash << 5) - hash) + code.charCodeAt(i);
  const idx = Math.abs(hash) % COLORS.length;
  return COLORS[idx];
}

interface ScheduleGridProps {
  onSectionClick?: (section: Section) => void;
  /** Clique num horário vazio (dia em sigla SEG..SAB e hora de início). */
  onSlotClick?: (dia: string, hora: string) => void;
  slotSelecionado?: { dia: string; hora: string } | null;
  /** Semana compacta: só os turnos que têm aula; os outros viram uma faixa fina. */
  compacta?: boolean;
}

const TURNOS = [
  { nome: 'Manhã', ini: 0, fim: 6 },
  { nome: 'Tarde', ini: 6, fim: 12 },
  { nome: 'Noite', ini: 12, fim: 16 },
];
const ALTURA_RECOLHIDO = 26;

export function ScheduleGrid({ onSectionClick, onSlotClick, slotSelecionado = null, compacta = false }: ScheduleGridProps = {}) {
  const { mySections, getConflictsForSection } = useMySections('ativa');
  const isMobile = useIsMobile();

  // Mapeia cada horário para um índice 0..15 (posição na lista de hours)
  const hourToIndex = new Map<string, number>();
  hours.forEach((h, i) => hourToIndex.set(h, i));

  // Uma cor diferente para cada disciplina, na ordem em que foram adicionadas (igual a "Minhas turmas")
  const coresPorDisciplina = mapaDeCores(
    mySections.map((s) => getBlockCourseBaseCode(s.course?.code || (s as { course_code?: string }).course_code || ''))
  );

  const scheduledItems: ScheduledItem[] = [];
  for (const s of mySections) {
    const disciplineCode = (s as any)?.course?.code || (s as any)?.course_code || '';
    const disciplineName = (s as any)?.course?.name || disciplineCode;
    const classCode = (s as any)?.section_code || s.id_ref;
    const professor = Array.isArray((s as any)?.teachers) && (s as any).teachers.length > 0
      ? (s as any).teachers.join(', ')
      : ((s as any)?.professor || '');

    const codes = Array.isArray(s.time_codes) ? s.time_codes : [];
    const discreteCodes = codes.flatMap((c) => getSpplitedCode(c));

    for (const code of discreteCodes) {
      const match = code.match(/^([2-7])([MTN])([1-6])$/i);
      if (!match) continue;
      const [, dayNum, shift, slotStr] = match;
      const day = dayMap[dayNum];
      const slot = parseInt(slotStr, 10) - 1;

      let startTime: string;
      let endTime: string;

      if (shift === 'M') {
        startTime = horariosManha[slot];
        endTime = slot < horariosManha.length - 1 ? horariosManha[slot + 1] : '12:00';
      } else if (shift === 'T') {
        startTime = horariosTarde[slot];
        endTime = slot < horariosTarde.length - 1 ? horariosTarde[slot + 1] : '18:00';
      } else if (shift === 'N') {
        startTime = horariosNoite[slot];
        endTime = slot < horariosNoite.length - 1 ? horariosNoite[slot + 1] : '22:00';
      } else {
        continue;
      }

      scheduledItems.push({
        disciplineCode,
        disciplineName,
        classCode,
        professor,
        color: (coresPorDisciplina.get(getBlockCourseBaseCode(disciplineCode)) ?? corDaGrade(0)).bg,
        day,
        startTime,
        endTime,
        section: s,
      });
    }
  }

  // Duração em slots (0..16)
  const getItemDurationInSlots = (item: ScheduledItem): number => {
    const startIdx = hourToIndex.get(item.startTime);
    const endIdx = hourToIndex.get(item.endTime);
    if (startIdx === undefined) return 1;
    if (endIdx === undefined) {
      // End time não está na lista (ex: 12:00, 18:00, 22:00) → acha o slot mais próximo depois
      const endHour = parseInt(item.endTime.split(':')[0]);
      const endMin = parseInt(item.endTime.split(':')[1]);
      let closest = hours.length;
      for (let i = 0; i < hours.length; i++) {
        const h = parseInt(hours[i].split(':')[0]);
        const m = parseInt(hours[i].split(':')[1]);
        if (h * 60 + m > endHour * 60 + endMin) { closest = i; break; }
      }
      return Math.max(1, closest - startIdx);
    }
    return Math.max(1, endIdx - startIdx);
  };

  // Pega os itens que começam exatamente nesse slot de (day, hour)
  const getStartingItemsForSlot = (day: string, hour: string) => {
    return scheduledItems.filter(item => item.day === day && item.startTime === hour);
  };

  const getConflictMessage = (conflicts: Array<{ code: string; section: Section }>) => {
    if (!conflicts.length) return '';
    const conflictList = conflicts.map(conflict => {
      const section = conflict.section;
      const courseCode = section.course?.code || (section as any)?.course_code || 'Desconhecido';
      const className = (section as any)?.section_code || section.id_ref || 'N/A';
      return `${courseCode} (${className})`;
    }).join(', ');
    return conflictList;
  };

  // Verifica se há conflito geral nessa célula (mais de um item começando aqui ou sobreposição detectada)
  const hasAnyConflictInCell = (day: string, hour: string) => {
    const itemsAtStart = getStartingItemsForSlot(day, hour);
    // também considera itens que passam por esse horário (overlap)
    const hourIdx = hourToIndex.get(hour);
    if (hourIdx === undefined) return itemsAtStart.length > 1;
    const overlapping = scheduledItems.filter(it => {
      if (it.day !== day) return false;
      const sIdx = hourToIndex.get(it.startTime);
      if (sIdx === undefined) return false;
      const dur = getItemDurationInSlots(it);
      return sIdx <= hourIdx && hourIdx < sIdx + dur && it.startTime !== hour;
    });
    const totalInCell = itemsAtStart.length + overlapping.length;
    if (totalInCell > 1) return true;
    for (const item of itemsAtStart) {
      if (getConflictsForSection(item.section).length > 0) return true;
    }
    return false;
  };

  // ---------- Blocos: junta períodos seguidos da mesma turma no mesmo dia ----------
  type Bloco = { item: ScheduledItem; inicio: number; fim: number; faixa: number; faixas: number };
  const blocosPorDia = new Map<string, Bloco[]>();
  for (const day of days) {
    const doDia = scheduledItems
      .filter((it) => it.day === day && hourToIndex.has(it.startTime))
      .map((it) => ({ it, s: hourToIndex.get(it.startTime)!, e: hourToIndex.get(it.startTime)! + getItemDurationInSlots(it) }))
      .sort((x, y) => x.s - y.s);
    const juntos: { item: ScheduledItem; inicio: number; fim: number }[] = [];
    for (const d of doDia) {
      const ultimo = [...juntos].reverse().find((j) => j.item.section.id_ref === d.it.section.id_ref);
      if (ultimo && ultimo.fim === d.s) ultimo.fim = d.e;
      else juntos.push({ item: d.it, inicio: d.s, fim: d.e });
    }
    // faixas lado a lado quando há choque de horário
    const faixasFim: number[] = [];
    const comFaixa = juntos
      .sort((x, y) => x.inicio - y.inicio)
      .map((j) => {
        let f = faixasFim.findIndex((fim) => fim <= j.inicio);
        if (f === -1) { f = faixasFim.length; faixasFim.push(j.fim); } else faixasFim[f] = j.fim;
        return { ...j, faixa: f, faixas: 1 };
      });
    comFaixa.forEach((b) => {
      const sobrepostos = comFaixa.filter((o) => o.inicio < b.fim && b.inicio < o.fim);
      b.faixas = Math.max(...sobrepostos.map((o) => o.faixa)) + 1;
    });
    blocosPorDia.set(day, comFaixa);
  }

  const alturaLinha = isMobile ? 28 : 30;

  // ---------- Linhas visíveis (semana completa ou compacta) ----------
  const linhasComAula = new Set<number>();
  blocosPorDia.forEach((bs) => bs.forEach((b) => { for (let l = b.inicio; l < b.fim; l++) linhasComAula.add(l); }));
  const topLinha: number[] = [];
  const faixasRecolhidas: { nome: string; top: number }[] = [];
  let alturaTotal = 0;
  for (const t of TURNOS) {
    const temAula = Array.from({ length: t.fim - t.ini }, (_, k) => t.ini + k).some((l) => linhasComAula.has(l));
    const visivel = !compacta || linhasComAula.size === 0 || temAula;
    for (let l = t.ini; l < t.fim; l++) {
      if (visivel) {
        topLinha[l] = alturaTotal;
        alturaTotal += alturaLinha;
      } else topLinha[l] = -1;
    }
    if (!visivel) {
      faixasRecolhidas.push({ nome: t.nome, top: alturaTotal });
      alturaTotal += ALTURA_RECOLHIDO;
    }
  }
  const primeiraDoTurno = new Set(TURNOS.map((t) => t.ini));
  const colunas = isMobile ? 'grid-cols-[42px_repeat(6,minmax(0,1fr))]' : 'grid-cols-[56px_repeat(6,minmax(0,1fr))]';
  const rotuloDia: Record<string, string> = { SEG: 'SEG', TER: 'TER', QUA: 'QUA', QUI: 'QUI', SEX: 'SEX', SAB: 'SÁB' };

  return (
    <TooltipProvider>
      <div className="w-full">
        {/* Cabeçalho dos dias */}
        <div className={cn('grid', colunas)}>
          <span />
          {days.map((day) => (
            <div key={day} className="flex h-9 items-center justify-center gap-1.5">
              <span className={cn('font-black tracking-[0.06em] text-foreground', isMobile ? 'text-[11px]' : 'text-[13px]')}>{rotuloDia[day]}</span>
            </div>
          ))}
        </div>

        {/* Corpo: horários + colunas dos dias */}
        <div className="relative">
        <div className={cn('grid', colunas)}>
          <div className="relative" style={{ height: alturaTotal }}>
            {hours.map((hour, l) =>
              topLinha[l] < 0 ? null : (
                <span
                  key={hour}
                  className={cn('absolute left-0 font-mono text-muted-foreground', isMobile ? 'text-[10px]' : 'text-[11px]')}
                  style={{ top: topLinha[l] - 7 }}
                >
                  {hour}
                </span>
              ),
            )}
          </div>

          {days.map((day) => {
            const blocos = blocosPorDia.get(day) ?? [];
            const ocupadas = new Set<number>();
            blocos.forEach((b) => { for (let l = b.inicio; l < b.fim; l++) ocupadas.add(l); });
            return (
              <div key={day} className="relative" style={{ height: alturaTotal }}>
                {/* linhas de cada período; linha mais forte na virada de turno */}
                {hours.map((hour, rowIdx) =>
                  topLinha[rowIdx] < 0 ? null : (
                    <span
                      key={hour}
                      aria-hidden
                      className={cn('absolute inset-x-0 border-t', primeiraDoTurno.has(rowIdx) && rowIdx > 0 ? 'border-foreground/25' : 'border-foreground/10')}
                      style={{ top: topLinha[rowIdx] }}
                    />
                  ),
                )}

                {/* horários vazios: clicar filtra as disciplinas com turma ali */}
                {onSlotClick &&
                  hours.map((hour, l) => {
                    if (topLinha[l] < 0 || ocupadas.has(l)) return null;
                    const sel = slotSelecionado?.dia === day && slotSelecionado?.hora === hour;
                    return (
                      <button
                        key={`vazio-${hour}`}
                        type="button"
                        aria-pressed={sel}
                        aria-label={`Ver disciplinas com turma em ${rotuloDia[day]} ${hour}`}
                        onClick={() => onSlotClick(day, hour)}
                        className={cn(
                          'absolute inset-x-[1px] flex items-center justify-center rounded-md font-mono text-[10px] font-bold text-mar-ink transition-colors',
                          sel ? 'z-[2] border-2 border-dashed border-mar bg-mar-claro' : 'hover:bg-mar-claro/70 focus-visible:bg-mar-claro',
                        )}
                        style={{ top: topLinha[l] + 1, height: alturaLinha - 2 }}
                      >
                        {sel && !isMobile ? hour : ''}
                      </button>
                    );
                  })}

                {blocos.map((b) => {
                  const item = b.item;
                  const conflicts = getConflictsForSection(item.section);
                  const hasItemConflict = conflicts.length > 0 || b.faixas > 1;
                  const conflictMessage = getConflictMessage(conflicts);
                  const largura = 100 / b.faixas;
                  return (
                    <Tooltip key={`${item.section.id_ref}-${day}-${b.inicio}`}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSectionClick) onSectionClick(item.section);
                          }}
                          className={cn(
                            'event-block absolute flex overflow-hidden text-left transition-[filter] hover:z-10 hover:brightness-95',
                            isMobile
                              ? 'rounded-[7px] border border-black/10 dark:border-white/15 shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                              : 'flex-col gap-0.5 rounded-[10px] px-2 py-1.5',
                            hasItemConflict && 'ring-2 ring-pitanga ring-offset-1 ring-offset-background'
                          )}
                          style={{
                            top: topLinha[b.inicio] + 2,
                            height: (b.fim - b.inicio) * alturaLinha - 4,
                            left: `calc(${b.faixa * largura}% + 2px)`,
                            width: `calc(${largura}% - 4px)`,
                            backgroundColor: item.color,
                            color: textoDaCor(item.color),
                          }}
                        >
                          {isMobile ? (
                            <div className="relative flex h-full w-full items-center justify-center p-1 text-center">
                              <span className="max-w-full truncate font-mono text-[10.5px] font-black leading-none tracking-tight">
                                {item.disciplineCode}
                              </span>
                              {hasItemConflict && (
                                <span
                                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-pitanga ring-1 ring-white"
                                  title="Choque de horário"
                                />
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 font-mono text-[11px] font-bold leading-tight">
                              {hasItemConflict && <AlertTriangle className="h-3 w-3 shrink-0" />}
                              {item.disciplineCode}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="z-50 max-w-xs">
                        <div className="space-y-1">
                          <p className="text-sm font-extrabold">{item.disciplineName}</p>
                          <p className="font-mono text-xs opacity-75">
                            {item.disciplineCode} • Turma {item.classCode} • {hours[b.inicio]}–{item.endTime && hours[b.fim] ? hours[b.fim] : ''}
                          </p>
                          <p className="truncate text-xs opacity-75">{item.professor}</p>
                          {hasItemConflict && (
                            <div className="my-1.5 border-t border-background/20 pt-1.5">
                              <p className="flex items-center gap-1 text-xs font-bold text-red-300">
                                <AlertTriangle className="h-3 w-3" />
                                Conflito de horário
                              </p>
                              {conflictMessage && <p className="mt-0.5 text-xs opacity-75">{conflictMessage}</p>}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
        {faixasRecolhidas.map((f) => (
          <div
            key={f.nome}
            className="pointer-events-none absolute right-0 flex items-center justify-center rounded-md border border-dashed border-tracejado bg-nevoa/60 text-[11px] font-bold text-muted-foreground"
            style={{ top: f.top + 3, height: ALTURA_RECOLHIDO - 6, left: isMobile ? 42 : 56 }}
          >
            {f.nome} · livre
          </div>
        ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
