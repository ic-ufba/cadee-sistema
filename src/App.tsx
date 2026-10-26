import { useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppProvider, useApp } from "./contexts/AppContext";
import { useMyPrograms } from "./hooks/useMyPrograms";
import { Onboarding } from "./components/onboarding/Onboarding";
import Index from "./pages/Index";
import Disciplinas from "./pages/Disciplinas";
import Planejador from "./pages/Planejador";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import NoCourseSelected from "./pages/NoCourseSelected";
import { SigaaRoot } from "./components/sigaa/SigaaAccount";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { isOnboarded } = useApp();
  const { selectedPrograms } = useMyPrograms();

  const hasCourseSelected = selectedPrograms.length > 0;

  return (
    <BrowserRouter>
      {!isOnboarded ? (
        <Onboarding />
      ) : (
        <Routes>
          <Route 
            path="/" 
            element={hasCourseSelected ? <Index /> : <NoCourseSelected />} 
          />
          <Route 
            path="/disciplinas" 
            element={hasCourseSelected ? <Disciplinas /> : <NoCourseSelected />} 
          />
          <Route 
            path="/planejador" 
            element={hasCourseSelected ? <Planejador /> : <NoCourseSelected />} 
          />
          <Route 
            path="/configuracoes" 
            element={hasCourseSelected ? <Configuracoes /> : <NoCourseSelected />} 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SigaaRoot />
          <AppContent />
        </TooltipProvider>
      </AppProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
