// CADEE — cores das disciplinas na grade horária (arquivo puramente visual).
// A 5ª cor usa variáveis CSS e se inverte sozinha no tema escuro.
export type CorGrade = { bg: string; fg: string };

export const CORES_GRADE: CorGrade[] = [
  { bg: "#00727B", fg: "#FFFFFF" }, // mar
  { bg: "#4C5FB0", fg: "#FFFFFF" }, // índigo
  { bg: "#F2B705", fg: "#1C1B19" }, // ouro
  { bg: "#F08CA0", fg: "#1C1B19" }, // rosa
  { bg: "hsl(var(--foreground))", fg: "hsl(var(--background))" }, // carvão
  { bg: "#8EC5E8", fg: "#1C1B19" }, // céu
  { bg: "#EE6A1F", fg: "#1C1B19" }, // dendê
  { bg: "#9BD3A8", fg: "#1C1B19" }, // folha
  { bg: "#B9A7F2", fg: "#1C1B19" }, // lilás
];

export function corDaGrade(indice: number): CorGrade {
  const n = CORES_GRADE.length;
  return CORES_GRADE[((Math.trunc(indice) % n) + n) % n];
}

// Lista só com os fundos (mesmo formato do antigo array COLORS) e o texto que combina com cada um.
export const CORES_GRADE_FUNDOS: string[] = CORES_GRADE.map((c) => c.bg);

export function textoDaCor(bg: string): string {
  return CORES_GRADE.find((c) => c.bg === bg)?.fg ?? "#FFFFFF";
}
