import { useAgentState, ToolExecution, PlanStep } from '../providers/AgentStateProvider';

interface ExecutionTimelineProps {
  className?: string;
}

export function ExecutionTimeline({ className = '' }: ExecutionTimelineProps) {
  const { state } = useAgentState();
  const { phase, plan, toolExecutions, qualityScore, iterations } = state;

  if (phase === 'idle') {
    return null;
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Execution Timeline
          </h3>
          <PhaseIndicator phase={phase} />
        </div>
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        {/* Plan Display */}
        {plan && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Plan: {plan.goal}
            </div>
            <div className="space-y-2">
              {plan.steps.map((step, index) => (
                <PlanStepCard
                  key={step.id}
                  step={step}
                  index={index}
                  isCurrent={index === plan.currentStepIndex}
                />
              ))}
            </div>
          </div>
        )}

        {/* Active Tool Executions */}
        {toolExecutions.active.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
              Active Tools
            </div>
            <div className="space-y-2">
              {toolExecutions.active.map(tool => (
                <ToolExecutionCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Tool Executions */}
        {toolExecutions.completed.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Completed Tools ({toolExecutions.completed.length})
            </div>
            <div className="space-y-2">
              {toolExecutions.completed.slice(-5).reverse().map(tool => (
                <ToolExecutionCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        )}

        {/* Quality Score & Stats */}
        {(qualityScore !== null || iterations > 0) && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              {qualityScore !== null && (
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">Quality:</span>
                  <QualityBadge score={qualityScore} />
                </div>
              )}
              {iterations > 0 && (
                <div className="text-gray-500">
                  Iterations: {iterations}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: string }) {
  const phaseConfig: Record<string, { label: string; color: string; icon: string }> = {
    idle: { label: 'Idle', color: 'bg-gray-400', icon: '○' },
    planning: { label: 'Planning', color: 'bg-blue-400', icon: '◐' },
    executing: { label: 'Executing', color: 'bg-yellow-400', icon: '◑' },
    reviewing: { label: 'Reviewing', color: 'bg-purple-400', icon: '◒' },
    revision: { label: 'Revising', color: 'bg-orange-400', icon: '◓' },
    complete: { label: 'Complete', color: 'bg-green-400', icon: '●' },
    error: { label: 'Error', color: 'bg-red-400', icon: '✕' }
  };

  const config = phaseConfig[phase] || phaseConfig.idle;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${config.color}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}

function PlanStepCard({ step, index, isCurrent }: { step: PlanStep; index: number; isCurrent: boolean }) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: {
      color: 'border-gray-200 bg-gray-50',
      icon: <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-xs">{index + 1}</span>
    },
    active: {
      color: 'border-blue-300 bg-blue-50',
      icon: (
        <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      )
    },
    complete: {
      color: 'border-green-300 bg-green-50',
      icon: (
        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )
    },
    failed: {
      color: 'border-red-300 bg-red-50',
      icon: (
        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      )
    }
  };

  const config = statusConfig[step.status];

  return (
    <div className={`flex items-start p-2 rounded-lg border ${config.color} ${isCurrent ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex-shrink-0 mr-3 mt-0.5">
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {step.description}
        </p>
        {step.tool && (
          <p className="text-xs text-gray-500 mt-0.5">
            Tool: {step.tool}
          </p>
        )}
      </div>
    </div>
  );
}

function ToolExecutionCard({ tool }: { tool: ToolExecution }) {
  const isRunning = tool.status === 'running';
  const isComplete = tool.status === 'complete';
  const isFailed = tool.status === 'failed';

  return (
    <div className={`p-2 rounded-lg border ${
      isRunning ? 'border-blue-200 bg-blue-50' :
      isComplete ? 'border-green-200 bg-green-50' :
      'border-red-200 bg-red-50'
    }`}>
      <div className="flex items-center">
        <div className="flex-shrink-0 mr-2">
          {isRunning && (
            <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {isComplete && (
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isFailed && (
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {tool.name}
          </p>
          {tool.duration && (
            <p className="text-xs text-gray-500">
              {(tool.duration / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function QualityBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getColor()}`}>
      {score}/10
    </span>
  );
}
