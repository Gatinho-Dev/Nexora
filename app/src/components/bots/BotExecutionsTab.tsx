import { memo, useState, useCallback, useEffect, useRef } from 'react';
import type {
  BotExecution,
  ExecutionStatus,
} from '@/types/bots';
import { renderIcon } from '@/components/flow/nodes/FlowNodes';
import { useBots } from '@/hooks/useBots';

// ============================================
// Status Badge
// ============================================

const StatusBadge = memo(function StatusBadge({ status }: { status: ExecutionStatus }) {
  const configs: Record<ExecutionStatus, { label: string; className: string; icon: string }> = {
    success: { label: 'Success', className: 'badge-success', icon: 'CheckCircle' },
    failed: { label: 'Failed', className: 'badge-danger', icon: 'AlertCircle' },
    timeout: { label: 'Timeout', className: 'badge-warning', icon: 'Clock' },
    running: { label: 'Running', className: 'badge-primary', icon: 'Clock' },
  };

  const config = configs[status];

  return (
    <span className={`badge ${config.className} flex items-center gap-1.5`}>
      {renderIcon(config.icon, 10)}
      {config.label}
    </span>
  );
});

// ============================================
// Duration Format
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

// ============================================
// Execution Row
// ============================================

interface ExecutionRowProps {
  execution: BotExecution;
  onView: (execution: BotExecution) => void;
  onRetry?: (execution: BotExecution) => void;
}

const ExecutionRow = memo(function ExecutionRow({
  execution,
  onView,
  onRetry,
}: ExecutionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownAnchorRef.current &&
        !dropdownAnchorRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div className="card hover:bg-surface-hover transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Status & Trigger */}
          <div className="flex-shrink-0 w-10 flex flex-col items-center gap-2">
            <StatusBadge status={execution.status} />
          </div>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-tertiary">{execution.trigger.type}</span>
              <span className="text-text-tertiary">·</span>
              <span className="font-mono text-xs text-text-tertiary">
                {formatDuration(execution.duration)}
              </span>
              <span className="text-text-tertiary">·</span>
              <span className="text-xs text-text-tertiary">
                {new Date(execution.startedAt).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
              <span className="font-mono text-text-tertiary truncate max-w-[200px]">
                {execution.context.user?.username || 'Unknown'}
              </span>
              {execution.context.channel && (
                <>
                  <span className="text-text-tertiary">in</span>
                  <span className="font-mono text-text-tertiary">#{execution.context.channel.name}</span>
                </>
              )}
            </div>

            {execution.error && (
              <div className="mt-2 p-2 bg-danger-500/10 border border-danger-500/20 rounded text-xs text-danger-500 font-mono">
                {execution.error.message}
              </div>
            )}

            {/* Expanded Details */}
            {expanded && (
              <div className="mt-3 pt-3 border-t border-surface-border space-y-2 text-xs">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <span className="font-mono w-24">Execution ID</span>
                  <span className="font-mono text-text-secondary truncate">{execution.id}</span>
                </div>
                <div className="flex items-center gap-2 text-text-tertiary">
                  <span className="font-mono w-24">Bot ID</span>
                  <span className="font-mono text-text-secondary truncate">{execution.botId}</span>
                </div>
                <div className="flex items-center gap-2 text-text-tertiary">
                  <span className="font-mono w-24">Nodes Run</span>
                  <span className="font-mono text-text-secondary">{execution.result.nodesExecuted}</span>
                </div>
                <div className="flex items-center gap-2 text-text-tertiary">
                  <span className="font-mono w-24">Actions</span>
                  <span className="font-mono text-text-secondary">{execution.result.actionsPerformed.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {renderIcon(expanded ? 'ChevronUp' : 'ChevronDown', 16)}
            </button>
            <button
              onClick={() => onView(execution)}
              className="btn btn-secondary btn-sm"
            >
              {renderIcon('Eye', 14)}
              View
            </button>
            {onRetry && execution.status === 'failed' && (
              <button
                onClick={() => onRetry(execution)}
                className="btn btn-primary btn-sm"
              >
                {renderIcon('RefreshCw', 14)}
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================
// Execution Detail Modal
// ============================================

interface ExecutionDetailModalProps {
  execution: BotExecution | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExecutionDetailModal = memo(function ExecutionDetailModal({
  execution,
  isOpen,
  onClose,
}: ExecutionDetailModalProps) {
  if (!isOpen || !execution) return null;

  const formatJson = (obj: any) => JSON.stringify(obj, null, 2);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="execution-detail-title">
      <div className="modal-content max-w-4xl w-full mx-4 max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <StatusBadge status={execution.status} />
            <h2 id="execution-detail-title" className="text-lg font-semibold text-text-primary">
              Execution Details
            </h2>
            <span className="font-mono text-xs text-text-tertiary px-2 py-0.5 rounded bg-surface-tertiary">
              {execution.id.slice(0, 12)}...
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" aria-label="Close">
            {renderIcon('X', 20)}
          </button>
        </div>

        <div className="modal-body overflow-y-auto">
          {/* Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-4">
              <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">General</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Status</dt>
                  <dd><StatusBadge status={execution.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Duration</dt>
                  <dd className="font-mono text-text-primary">{formatDuration(execution.duration)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Started</dt>
                  <dd className="font-mono text-text-primary">{new Date(execution.startedAt).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Completed</dt>
                  <dd className="font-mono text-text-primary">{execution.completedAt ? new Date(execution.completedAt).toLocaleString() : '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="card p-4">
              <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Trigger</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Type</dt>
                  <dd className="font-mono text-text-primary">{execution.trigger.type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">User</dt>
                  <dd className="font-mono text-text-primary">{execution.trigger.userId || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Channel</dt>
                  <dd className="font-mono text-text-primary">{execution.trigger.channelId || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Guild</dt>
                  <dd className="font-mono text-text-primary">{execution.trigger.guildId || '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="card p-4">
              <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Result</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Nodes Executed</dt>
                  <dd className="font-mono text-text-primary">{execution.result.nodesExecuted}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Actions Performed</dt>
                  <dd className="font-mono text-text-primary">{execution.result.actionsPerformed.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Error</dt>
                  <dd className={execution.error ? 'text-danger-500' : 'text-success-500'}>
                    {execution.error ? 'Yes' : 'No'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Error Details */}
          {execution.error && (
            <div className="card p-4 mb-6 border-danger-500/30 bg-danger-500/5">
              <div className="flex items-center gap-2 text-danger-500 mb-2">
                {renderIcon('AlertCircle', 16)}
                <h4 className="font-medium">Execution Error</h4>
              </div>
              <pre className="code-block text-xs text-danger-500/90 overflow-x-auto max-h-40">
                {execution.error.message}
                {execution.error.stack && `\n\n${execution.error.stack}`}
              </pre>
            </div>
          )}

          {/* Trigger Data */}
          <div className="card p-4 mb-4">
            <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Trigger Data</h4>
            <pre className="code-block text-xs overflow-x-auto max-h-60">
              {formatJson(execution.trigger.data)}
            </pre>
          </div>

          {/* Context */}
          <div className="card p-4 mb-4">
            <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Context</h4>
            <pre className="code-block text-xs overflow-x-auto max-h-60">
              {formatJson(execution.context)}
            </pre>
          </div>

          {/* Result */}
          <div className="card p-4 mb-4">
            <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Execution Result</h4>
            <pre className="code-block text-xs overflow-x-auto max-h-60">
              {formatJson(execution.result)}
            </pre>
          </div>

          {/* Action Details */}
          {execution.result.actionsPerformed.length > 0 && (
            <div className="card p-4">
              <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Action Details</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {execution.result.actionsPerformed.map((action, i) => (
                  <div key={i} className="p-3 bg-surface-tertiary/50 rounded-lg border border-surface-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-text-primary">{action.nodeType}</span>
                      <StatusBadge status={action.success ? 'success' : 'failed'} />
                    </div>
                    <div className="text-xs text-text-secondary font-mono">{action.nodeId}</div>
                    {action.output && (
                      <pre className="code-block text-xs mt-2 max-h-30 overflow-x-auto">
                        {formatJson(action.output)}
                      </pre>
                    )}
                    {action.error && (
                      <pre className="code-block text-xs mt-2 max-h-30 overflow-x-auto text-danger-500/90">
                        {action.error}
                      </pre>
                    )}
                    <div className="flex justify-between mt-2 text-xs text-text-tertiary">
                      <span>Duration: {formatDuration(action.duration)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

// ============================================
// Executions Toolbar
// ============================================

interface ExecutionsToolbarProps {
  totalCount: number;
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
  statusFilter: ExecutionStatus | 'all';
  onStatusChange: (status: ExecutionStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ExecutionsToolbar = memo(function ExecutionsToolbar({
  totalCount,
  loading,
  onRefresh,
  onExport,
  statusFilter,
  onStatusChange,
  searchQuery,
  onSearchChange,
}: ExecutionsToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-surface-secondary border-b border-surface-border">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md">
          {renderIcon('Search', 16)}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search executions..."
            className="input pl-9 pr-3"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as ExecutionStatus | 'all')}
          className="input input-sm w-auto px-3 py-1.5 text-xs appearance-none bg-surface-tertiary"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="timeout">Timeout</option>
          <option value="running">Running</option>
        </select>

        <button onClick={onRefresh} disabled={loading} className="btn btn-secondary btn-sm">
          {loading ? renderIcon('RefreshCw', 14, 'animate-spin') : renderIcon('RefreshCw', 14)}
          Refresh
        </button>

        <button onClick={onExport} className="btn btn-secondary btn-sm">
          {renderIcon('Download', 14)}
          Export
        </button>
      </div>

      <div className="text-sm text-text-tertiary">
        {totalCount} execution{totalCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
});

// ============================================
// Empty State
// ============================================

const ExecutionsEmptyState = memo(function ExecutionsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-surface-tertiary flex items-center justify-center mb-6 text-text-tertiary">
        {renderIcon('Clock', 40)}
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">
        {hasFilters ? 'No executions found' : 'No executions yet'}
      </h3>
      <p className="text-text-tertiary mb-6 max-w-sm">
        {hasFilters
          ? 'Try adjusting your filters or search query.'
          : 'Executions will appear here when your bot runs.'}
      </p>
    </div>
  );
});

// ============================================
// Bot Executions Tab
// ============================================

interface BotExecutionsTabProps {
  botId: number;
  serverId: number;
}

export const BotExecutionsTab = memo(function BotExecutionsTab({
  botId,
}: BotExecutionsTabProps) {
  const { listExecutions, adaptExecutions } = useBots();
  
  const [executions, setExecutions] = useState<BotExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<BotExecution | null>(null);

  const query = listExecutions({ botId, limit: pageSize, cursor });

  useEffect(() => {
    if (query.data) {
      const adapted = adaptExecutions(query.data.items as any);
      setExecutions(adapted);
      setHasMore(query.data.hasMore);
      if (adapted.length > 0) {
        setCursor(Number(adapted[adapted.length - 1].id));
      }
    }
  }, [query.data, adaptExecutions]);

  useEffect(() => {
    if (!query.isLoading && !query.isFetching) {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [query.isLoading, query.isFetching]);

  const handleView = useCallback((execution: BotExecution) => {
    setSelectedExecution(execution);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedExecution(null);
  }, []);

  const handleRetry = useCallback(async (_execution: BotExecution) => {
    // In real app: await api.retryExecution(_execution.id);
    query.refetch();
  }, [query]);

  const handleExport = useCallback(() => {
    // const _csvData = executions.map((e) => ({
    //   id: e.id,
    //   status: e.status,
    //   trigger: e.trigger.type,
    //   duration: e.duration,
    //   startedAt: e.startedAt,
    //   error: e.error?.message || '',
    // }));
    // Convert to CSV and download
  }, [executions]);

  return (
    <div className="flex flex-col h-full bg-surface-primary">
      {/* Toolbar */}
      <ExecutionsToolbar
        totalCount={totalCount}
        loading={loading}
        onRefresh={() => query.refetch()}
        onExport={handleExport}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && executions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin text-primary-500">{renderIcon('RefreshCw', 32)}</div>
          </div>
        ) : executions.length === 0 ? (
          <ExecutionsEmptyState hasFilters={!!searchQuery || statusFilter !== 'all'} />
        ) : (
          <div className="p-4 space-y-3">
            {executions.map((execution) => (
              <ExecutionRow
                key={execution.id}
                execution={execution}
                onView={handleView}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="p-4 border-t border-surface-border flex justify-center">
            <button
              onClick={() => query.refetch()}
              disabled={loading}
              className="btn btn-secondary"
            >
              {loading ? (
                <>
                  {renderIcon('RefreshCw', 14, 'animate-spin')} Loading...
                </>
              ) : (
                <>
                  {renderIcon('Download', 14)} Load More
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ExecutionDetailModal
        execution={selectedExecution}
        isOpen={!!selectedExecution}
        onClose={handleCloseDetail}
      />
    </div>
  );
});

BotExecutionsTab.displayName = 'BotExecutionsTab';