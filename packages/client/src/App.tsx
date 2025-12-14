import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { N8nAgentProvider } from './providers/N8nAgentProvider';
import { AgentStateProvider } from './providers/AgentStateProvider';
import { MainContent } from './components/MainContent';
import { AgentSelector } from './components/AgentSelector';
import { ExecutionTimeline } from './components/ExecutionTimeline';
import { useState } from 'react';

// Configuration for the AG-UI bridge server
const AGENT_URL = import.meta.env.VITE_AGENT_URL || '/api/agent';

function App() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(true);

  return (
    <CopilotKit runtimeUrl={AGENT_URL}>
      <N8nAgentProvider>
        <AgentStateProvider>
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
                        <p className="text-sm text-gray-500">Multi-Agent ReAct Orchestration</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setShowTimeline(!showTimeline)}
                        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          showTimeline
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Timeline
                      </button>
                      <AgentSelector
                        selectedAgent={selectedAgent}
                        onSelectAgent={setSelectedAgent}
                      />
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 flex overflow-hidden">
                <MainContent selectedAgent={selectedAgent} />

                {/* Execution Timeline Panel */}
                {showTimeline && (
                  <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                    <ExecutionTimeline />
                  </div>
                )}
              </div>
            </div>

            {/* CopilotKit Sidebar */}
            <CopilotSidebar
              labels={{
                title: "n8n Agent",
                initial: "I'm your multi-agent assistant powered by ReAct orchestration. I can:\n\n• Plan complex tasks step-by-step\n• Browse the web with automation\n• Execute Python code\n• Research topics in depth\n• Search knowledge bases\n\nWhat would you like me to help you with?",
                placeholder: "Describe your task..."
              }}
              defaultOpen={true}
              clickOutsideToClose={false}
            />
          </div>
        </AgentStateProvider>
      </N8nAgentProvider>
    </CopilotKit>
  );
}

export default App;
