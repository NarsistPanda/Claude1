import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useCopilotAction } from '@copilotkit/react-core';

interface N8nAgent {
  id: string;
  name: string;
  url?: string;
  description?: string;
}

interface N8nAgentContextValue {
  agents: N8nAgent[];
  currentAgent: N8nAgent | null;
  isLoading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  setCurrentAgent: (agent: N8nAgent | null) => void;
}

const N8nAgentContext = createContext<N8nAgentContextValue | null>(null);

export function useN8nAgent(): N8nAgentContextValue {
  const context = useContext(N8nAgentContext);
  if (!context) {
    throw new Error('useN8nAgent must be used within an N8nAgentProvider');
  }
  return context;
}

interface N8nAgentProviderProps {
  children: ReactNode;
}

export function N8nAgentProvider({ children }: N8nAgentProviderProps) {
  const [agents, setAgents] = useState<N8nAgent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<N8nAgent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set default agent if fetch fails
      setAgents([{ id: 'default', name: 'Default Agent' }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Register CopilotKit actions that can be called by the agent
  useCopilotAction({
    name: 'listWorkflows',
    description: 'List available n8n workflows',
    handler: async () => {
      await fetchAgents();
      return `Found ${agents.length} available agents/workflows`;
    }
  });

  useCopilotAction({
    name: 'switchAgent',
    description: 'Switch to a different n8n agent/workflow',
    parameters: [
      {
        name: 'agentId',
        type: 'string',
        description: 'The ID of the agent to switch to'
      }
    ],
    handler: async ({ agentId }) => {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        setCurrentAgent(agent);
        return `Switched to agent: ${agent.name}`;
      }
      return `Agent with ID ${agentId} not found`;
    }
  });

  const value: N8nAgentContextValue = {
    agents,
    currentAgent,
    isLoading,
    error,
    fetchAgents,
    setCurrentAgent
  };

  return (
    <N8nAgentContext.Provider value={value}>
      {children}
    </N8nAgentContext.Provider>
  );
}
