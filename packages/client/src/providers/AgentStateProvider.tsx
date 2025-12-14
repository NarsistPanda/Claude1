import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useCopilotAction } from '@copilotkit/react-core';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'active' | 'complete' | 'failed';
  tool?: string;
  result?: unknown;
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  currentStepIndex: number;
}

export interface ToolExecution {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: 'running' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface AgentState {
  phase: 'idle' | 'planning' | 'executing' | 'reviewing' | 'revision' | 'complete' | 'error';
  plan: Plan | null;
  toolExecutions: {
    active: ToolExecution[];
    completed: ToolExecution[];
  };
  qualityScore: number | null;
  iterations: number;
  error: string | null;
}

interface AgentStateContextValue {
  state: AgentState;
  updatePhase: (phase: AgentState['phase']) => void;
  setPlan: (plan: Plan | null) => void;
  updatePlanStep: (stepId: string, updates: Partial<PlanStep>) => void;
  addToolExecution: (tool: Omit<ToolExecution, 'status' | 'startedAt'>) => string;
  completeToolExecution: (id: string, result: unknown, success?: boolean) => void;
  setQualityScore: (score: number | null) => void;
  reset: () => void;
}

const initialState: AgentState = {
  phase: 'idle',
  plan: null,
  toolExecutions: {
    active: [],
    completed: []
  },
  qualityScore: null,
  iterations: 0,
  error: null
};

const AgentStateContext = createContext<AgentStateContextValue | null>(null);

export function useAgentState(): AgentStateContextValue {
  const context = useContext(AgentStateContext);
  if (!context) {
    throw new Error('useAgentState must be used within an AgentStateProvider');
  }
  return context;
}

interface AgentStateProviderProps {
  children: ReactNode;
}

export function AgentStateProvider({ children }: AgentStateProviderProps) {
  const [state, setState] = useState<AgentState>(initialState);

  const updatePhase = useCallback((phase: AgentState['phase']) => {
    setState(prev => ({ ...prev, phase }));
  }, []);

  const setPlan = useCallback((plan: Plan | null) => {
    setState(prev => ({ ...prev, plan }));
  }, []);

  const updatePlanStep = useCallback((stepId: string, updates: Partial<PlanStep>) => {
    setState(prev => {
      if (!prev.plan) return prev;
      const steps = prev.plan.steps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      );
      return {
        ...prev,
        plan: { ...prev.plan, steps }
      };
    });
  }, []);

  const addToolExecution = useCallback((tool: Omit<ToolExecution, 'status' | 'startedAt'>): string => {
    const execution: ToolExecution = {
      ...tool,
      status: 'running',
      startedAt: new Date().toISOString()
    };
    setState(prev => ({
      ...prev,
      toolExecutions: {
        ...prev.toolExecutions,
        active: [...prev.toolExecutions.active, execution]
      }
    }));
    return execution.id;
  }, []);

  const completeToolExecution = useCallback((id: string, result: unknown, success: boolean = true) => {
    setState(prev => {
      const activeIndex = prev.toolExecutions.active.findIndex(t => t.id === id);
      if (activeIndex === -1) return prev;

      const tool = prev.toolExecutions.active[activeIndex];
      const completedTool: ToolExecution = {
        ...tool,
        result,
        status: success ? 'complete' : 'failed',
        completedAt: new Date().toISOString(),
        duration: Date.now() - new Date(tool.startedAt).getTime()
      };

      return {
        ...prev,
        toolExecutions: {
          active: prev.toolExecutions.active.filter((_, i) => i !== activeIndex),
          completed: [...prev.toolExecutions.completed, completedTool]
        }
      };
    });
  }, []);

  const setQualityScore = useCallback((score: number | null) => {
    setState(prev => ({ ...prev, qualityScore: score }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Register CopilotKit action to receive state updates from AG-UI events
  useCopilotAction({
    name: '__internal_agent_state_update',
    description: 'Internal action to update agent state from AG-UI events',
    parameters: [
      { name: 'eventType', type: 'string', description: 'Type of AG-UI event' },
      { name: 'payload', type: 'object', description: 'Event payload' }
    ],
    handler: async ({ eventType, payload }) => {
      const data = payload as Record<string, unknown>;

      switch (eventType) {
        case 'RUN_STARTED':
          reset();
          updatePhase('planning');
          break;

        case 'STEP_STARTED':
          if (data.stepType === 'planning') updatePhase('planning');
          else if (data.stepType === 'review') updatePhase('reviewing');
          else if (data.stepType === 'revision') updatePhase('revision');
          else updatePhase('executing');

          if (data.stepId) {
            updatePlanStep(data.stepId as string, { status: 'active' });
          }
          break;

        case 'STEP_FINISHED':
          if (data.stepId) {
            updatePlanStep(data.stepId as string, {
              status: data.status === 'complete' ? 'complete' : 'failed',
              result: data.result
            });
          }
          break;

        case 'TOOL_CALL_START':
          addToolExecution({
            id: data.toolCallId as string,
            name: data.toolCallName as string
          });
          break;

        case 'TOOL_CALL_RESULT':
          completeToolExecution(
            data.toolCallId as string,
            data.result,
            true
          );
          break;

        case 'STATE_DELTA':
          const delta = data.delta as Array<{ op: string; path: string; value?: unknown }>;
          if (delta) {
            for (const op of delta) {
              if (op.path === '/phase') updatePhase(op.value as AgentState['phase']);
              if (op.path === '/qualityScore') setQualityScore(op.value as number);
              if (op.path === '/plan' && op.op === 'add') {
                setPlan(op.value as Plan);
              }
            }
          }
          break;

        case 'STATE_SNAPSHOT':
          if (data.plan) {
            const planData = data.plan as Record<string, unknown>;
            setPlan({
              id: (planData.id as string) || 'plan',
              goal: (planData.goal as string) || '',
              steps: ((planData.steps as unknown[]) || []).map((s: unknown, i: number) => {
                const step = s as Record<string, unknown>;
                return {
                  id: (step.id as string) || `step_${i}`,
                  description: (step.description as string) || '',
                  status: 'complete' as const,
                  tool: step.tool as string | undefined,
                  result: step.result
                };
              }),
              currentStepIndex: (planData.currentStepIndex as number) || 0
            });
          }
          if (data.qualityScore !== undefined) setQualityScore(data.qualityScore as number);
          if (data.iterations !== undefined) {
            setState(prev => ({ ...prev, iterations: data.iterations as number }));
          }
          break;

        case 'RUN_FINISHED':
          updatePhase('complete');
          break;

        case 'RUN_ERROR':
          setState(prev => ({
            ...prev,
            phase: 'error',
            error: data.message as string
          }));
          break;
      }

      return 'State updated';
    }
  });

  const value: AgentStateContextValue = {
    state,
    updatePhase,
    setPlan,
    updatePlanStep,
    addToolExecution,
    completeToolExecution,
    setQualityScore,
    reset
  };

  return (
    <AgentStateContext.Provider value={value}>
      {children}
    </AgentStateContext.Provider>
  );
}
