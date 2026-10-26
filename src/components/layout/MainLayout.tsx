import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';
import { MobileHeader } from './MobileHeader';
import { NewSemesterModal } from '@/components/semester/NewSemesterModal';
import { useSemesterTransition } from '@/hooks/useSemesterTransition';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const {
    showNewSemesterModal,
    planningTerm,
    currentTerm,
    unresolvedCodes,
    canAdvance,
    advanceToNewSemester,
    dismissModalToResolve,
  } = useSemesterTransition();

  const handleResolveOnHome = () => {
    dismissModalToResolve();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <AppSidebar isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className={cn("flex-1 pb-32 md:pb-12 pt-[60px] md:pt-0")}>
        <MobileHeader />
        <div className="mx-auto w-full max-w-[1328px]">{children}</div>
      </main>
      <MobileNav />
      <NewSemesterModal
        open={showNewSemesterModal}
        planningTerm={planningTerm}
        currentTerm={currentTerm}
        unresolvedCodes={unresolvedCodes}
        canAdvance={canAdvance}
        onAdvance={advanceToNewSemester}
        onResolveOnHome={handleResolveOnHome}
      />
    </div>
  );
}
