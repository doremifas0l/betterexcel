// src/components/layout/ProjectLayout.tsx

import React, { useState } from 'react';
import { LeftSidebar } from './LeftSidebar'; // Import from the same folder
import { cn } from '@/lib/utils';

interface ProjectLayoutProps {
  children: React.ReactNode;
  projectId: string;
  currentTableId?: string;
  onCreateTable: () => void; // Pass down the function to create a table
  refreshSidebarTrigger?: number; // To force sidebar refresh
}

export function ProjectLayout({
  children,
  projectId,
  currentTableId,
  onCreateTable,
  refreshSidebarTrigger,
}: ProjectLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex h-[calc(100vh-4.5rem)]"> {/* Adjust height based on your header */}
      <LeftSidebar
        projectId={projectId}
        currentTableId={currentTableId}
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        onCreateTable={onCreateTable}
        refreshTrigger={refreshSidebarTrigger}
      />
      
      <main className={cn(
        "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 transition-all duration-300",
        // You can add margin-left when sidebar is not collapsed if needed
      )}>
        {children}
      </main>
    </div>
  );
}