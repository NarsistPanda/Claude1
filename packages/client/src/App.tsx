import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { N8nAgentProvider } from './providers/N8nAgentProvider';
import { MainContent } from './components/MainContent';
import { AgentSelector } from './components/AgentSelector';
import { useState } from 'react';

// Configuration for the AG-UI bridge server
const AGENT_URL = import.meta.env.VITE_AGENT_URL || '/api/agent';

function App() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <CopilotKit runtimeUrl={AGENT_URL}>
      <N8nAgentProvider>
        <div className="flex min-h-screen">
          {/* Main content area */}
          <div className="flex-1 flex flex-col">
            <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src="/n8n-logo.svg" alt="n8n" className="w-10 h-10" />
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">n8n Agent Chat</h1>
                      <p className="text-sm text-gray-500">Powered by AG-UI & CopilotKit</p>
                    </div>
                  </div>
                  <AgentSelector
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                  />
                </div>
              </div>
            </header>

            <MainContent selectedAgent={selectedAgent} />
          </div>

          {/* CopilotKit Sidebar */}
          <CopilotSidebar
            labels={{
              title: "n8n Agent",
              initial: "How can I help you today? Ask me anything or describe what you'd like to accomplish.",
              placeholder: "Type your message..."
            }}
            defaultOpen={true}
            clickOutsideToClose={false}
          />
        </div>
      </N8nAgentProvider>
    </CopilotKit>
  );
}

export default App;
