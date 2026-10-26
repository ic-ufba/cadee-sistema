import { toast } from '@/hooks/use-toast';
import { fetchGradeIcs } from '@/services/sigaaApi';

/** Baixa a grade horária do SIGAA em .ics (Google Agenda, Apple Calendário...). */
export async function baixarGradeIcs() {
  try {
    const blob = await fetchGradeIcs();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grade-horaria.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: 'Grade baixada', description: 'Abra o arquivo .ics no Google Agenda ou no calendário do celular.' });
  } catch (e) {
    toast({
      title: 'Não foi possível baixar a grade',
      description: e instanceof Error ? e.message : undefined,
      variant: 'destructive',
    });
  }
}
