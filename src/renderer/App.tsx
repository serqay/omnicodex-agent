import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Header } from './components/header/Header';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatPanel } from './components/chat/ChatPanel';
import { RightPanel } from './components/right/RightPanel';
import { SettingsModal } from './components/settings/SettingsModal';

export const App: React.FC = () => {
  const { initialize } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden font-sans select-none">
      {/* Top Application Header */}
      <Header />

      {/* Main 3-Column Studio Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Files & History Sidebar */}
        <Sidebar />

        {/* Center: Agentic Chat & Reasoning Stream */}
        <ChatPanel />

        {/* Right: Code, Diff & Live Terminal Studio */}
        <RightPanel />
      </div>

      {/* Global Modals */}
      <SettingsModal />
    </div>
  );
};
