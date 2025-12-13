import { useEffect } from 'react';
import { useN8nAgent } from '../providers/N8nAgentProvider';

interface AgentSelectorProps {
  selectedAgent: string | null;
  onSelectAgent: (agentId: string | null) => void;
}

export function AgentSelector({ selectedAgent, onSelectAgent }: AgentSelectorProps) {
  const { agents, isLoading, error, fetchAgents, setCurrentAgent } = useN8nAgent();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = e.target.value || null;
    onSelectAgent(agentId);

    // Update the current agent in context
    const agent = agents.find(a => a.id === agentId);
    setCurrentAgent(agent || null);
  };

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Error loading agents
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="agent-select" className="text-sm font-medium text-gray-700">
        Agent:
      </label>
      <select
        id="agent-select"
        value={selectedAgent || ''}
        onChange={handleChange}
        disabled={isLoading}
        className="block w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50"
      >
        <option value="">Default Agent</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      {isLoading && (
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
    </div>
  );
}
