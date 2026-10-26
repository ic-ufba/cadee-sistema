import { useNavigate } from "react-router-dom";
import { GraduationCap, AlertCircle } from "lucide-react";

const NoCourseSelected = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-tracejado">
            <GraduationCap className="h-9 w-9 text-dende" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="font-mono text-[72px] font-bold leading-none tracking-[-0.04em] text-foreground">404</h1>
          <p className="text-[22px] font-black tracking-[-0.03em] text-foreground">Curso não selecionado</p>
          <p className="text-sm font-medium text-muted-foreground">
            Você precisa selecionar um curso para acessar esta página.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="inline-flex h-[52px] items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <AlertCircle className="w-4 h-4" />
          Selecionar um curso
        </button>
      </div>
    </div>
  );
};

export default NoCourseSelected;
