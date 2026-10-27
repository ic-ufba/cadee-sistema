import { toast } from '@/hooks/use-toast';
import { fetchDocumento, fetchGradeIcs, type DocumentoSigaa } from '@/services/sigaaApi';

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

const NOMES: Record<DocumentoSigaa, string> = {
  comprovante: 'Comprovante de matrícula',
  declaracao: 'Declaração de vínculo',
  historico: 'Histórico escolar',
};

/** Abre um documento oficial do SIGAA numa aba nova (o SIGAA pode levar alguns segundos para gerar). */
export async function abrirDocumentoSigaa(tipo: DocumentoSigaa) {
  // abre a aba já no clique, senão o navegador bloqueia o pop-up depois da espera
  const aba = window.open('', '_blank');
  try {
    const blob = await fetchDocumento(tipo);
    const url = URL.createObjectURL(blob);
    if (aba) aba.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    aba?.close();
    toast({
      title: `Não foi possível abrir: ${NOMES[tipo]}`,
      description: e instanceof Error ? e.message : undefined,
      variant: 'destructive',
    });
  }
}
