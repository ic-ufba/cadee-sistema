import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useMySections } from '@/hooks/useMySections';
import { getSpplitedCode } from '@/lib/schedule';
import { CORES_GRADE_FUNDOS } from '@/lib/grade-cores';

const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hours = ['07:00', '07:55', '08:50', '09:45', '10:40', '11:35', '13:00', '13:55', '14:50', '15:45', '16:40', '17:35', '18:30', '19:25', '20:20', '21:15'];

const dayMap: Record<string, string> = {
  '2': 'Seg',
  '3': 'Ter',
  '4': 'Qua',
  '5': 'Qui',
  '6': 'Sex',
  '7': 'Sáb',
};

type ScheduledItem = {
  disciplineCode: string;
  disciplineName: string;
  classCode: string;
  professor: string;
  color: string;
  day: string; // 'Seg' | 'Ter' | ...
  startTime: string;
  endTime: string;
};

// Paleta CADEE (ver src/lib/grade-cores.ts) — o hash por código continua o mesmo.
const COLORS = CORES_GRADE_FUNDOS;

function colorFor(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = ((hash << 5) - hash) + code.charCodeAt(i);
  const idx = Math.abs(hash) % COLORS.length;
  return COLORS[idx];
}

export function MobileSchedule() {
  const [activeDay, setActiveDay] = useState('Seg');
  const { mySections, toggleSection } = useMySections();

  // Build items from mySections using cartesian time codes
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
      const slot = parseInt(slotStr, 10) - 1; // Convert para 0-based index
      
      // Mapeamento de horários conforme especificação
      const horariosManha = ['07:00', '07:55', '08:50', '09:45', '10:40', '11:35'];
      const horariosTarde = ['13:00', '13:55', '14:50', '15:45', '16:40', '17:35'];
      const horariosNoite = ['18:30', '19:25', '20:20', '21:15'];
      
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
        color: colorFor(disciplineCode),
        day,
        startTime,
        endTime,
      });
    }
  }

  const getItemsForDay = (day: string) => {
    return scheduledItems.filter(item => item.day === day);
  };

  const dayItems = getItemsForDay(activeDay);

  // Group by unique discipline-class
  const uniqueItems = dayItems.reduce((acc, item) => {
    const key = `${item.disciplineCode}-${item.classCode}`;
    if (!acc.find(i => `${i.disciplineCode}-${i.classCode}` === key)) {
      acc.push(item);
    }
    return acc;
  }, [] as ScheduledItem[]);

  // Sort by start time
  uniqueItems.sort((a, b) => {
    const aHour = parseInt(a.startTime.split(':')[0]);
    const bHour = parseInt(b.startTime.split(':')[0]);
    return aHour - bHour;
  });

  return (
    <div className="space-y-4">
      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {days.map((day) => {
          const count = getItemsForDay(day).length;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={cn(
                "relative h-10 flex-shrink-0 rounded-full px-4 text-sm font-bold transition-all",
                activeDay === day
                  ? "bg-primary text-primary-foreground"
                  : "bg-nevoa text-foreground-2 hover:bg-trilho"
              )}
            >
              {day}
              {count > 0 && (
                <span className={cn(
                  "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold",
                  activeDay === day
                    ? "bg-mar text-white"
                    : "bg-primary text-primary-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {uniqueItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma aula neste dia
          </div>
        ) : (
          uniqueItems.map((item) => (
            <div
              key={`${item.disciplineCode}-${item.classCode}`}
              className="flex gap-3 animate-fade-in"
            >
              {/* Time */}
              <div className="w-14 flex-shrink-0 text-right">
                <p className="font-mono text-sm font-bold text-foreground">
                  {item.startTime}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {item.endTime}
                </p>
              </div>

              {/* Line */}
              <div className="relative flex flex-col items-center">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="w-0.5 flex-1 bg-border" />
              </div>

              {/* Content */}
              <div
                className="mb-2 flex-1 rounded-[18px] border-l-[6px] bg-nevoa p-4"
                style={{ borderColor: item.color }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold uppercase text-foreground">
                      {item.disciplineName}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.classCode} • {item.professor}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const toRemove = mySections.find((s) => {
                        const dc = (s as any)?.course?.code || (s as any)?.course_code;
                        const cc = (s as any)?.section_code || s.id_ref;
                        return dc === item.disciplineCode && cc === item.classCode;
                      });
                      if (toRemove) toggleSection(toRemove);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-nevoa text-foreground-2 transition-colors hover:bg-pitanga-tint hover:text-pitanga-ink"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
