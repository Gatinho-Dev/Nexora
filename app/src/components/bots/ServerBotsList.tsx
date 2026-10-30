/**
 * Nexora Bots - Server Bots List
 * Grid/list view of all bots for a server
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import { Bot, BotStatus, BotMode, BotListParams } from '@/types/bots';
import { BotListItem } from './BotListItem';
import { renderIcon } from '@/components/flow/nodes/FlowNodes';

// ============================================
// Empty State
// ============================================

const EmptyState = memo(function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-surface-tertiary flex items-center justify-center mb-6 text-text-tertiary">
        {renderIcon('Plus', 40)}
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">No bots yet</h3>
      <p className="text-text-tertiary mb-6 max-w-sm">
        Create your first bot to automate tasks, moderate chats, or build custom workflows.
      </p>
      <button onClick={onCreate} className="btn btn-primary">
        {renderIcon('Plus', 16)}
        Create Bot
      </button>
    </div>
  );
});

// ============================================
// Loading State
// ============================================

const LoadingState = memo(function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-tertiary" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-3/4 bg-surface-tertiary rounded" />
              <div className="h-4 w-1/2 bg-surface-tertiary rounded" />
              <div className="h-4 w-full bg-surface-tertiary rounded" />
              <div className="h-4 w-1/3 bg-surface-tertiary rounded mt-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

// ============================================
// Search and Filter Bar
// ============================================

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: BotStatus | 'all';
  onStatusChange: (status: BotStatus | 'all') => void;
  modeFilter: BotMode | 'all';
  onModeChange: (mode: BotMode | 'all') => void;
  sortBy: BotListParams['sortBy'];
  onSortChange: (sort: BotListParams['sortBy']) => void;
  sortOrder: BotListParams['sortOrder'];
  onSortOrderChange: (order: BotListParams['sortOrder']) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  totalCount: number;
}

const SearchFilterBar = memo(function SearchFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  modeFilter,
  onModeChange,
  sortBy,
  onSortChange,
  sortOrder,
  onSortOrderChange,
  viewMode,
  onViewModeChange,
  totalCount,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-surface-secondary border-b border-surface-border">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <div className="relative">
          {renderIcon('Search', 16, 'var(--color-text-tertiary)', 'absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none')}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search bots..."
            className="input pl-9 pr-3"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as BotStatus | 'all')}
          className="input input-sm w-auto px-3 py-1.5 text-xs appearance-none bg-surface-tertiary"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>

        {/* Mode Filter */}
        <select
          value={modeFilter}
          onChange={(e) => onModeChange(e.target.value as BotMode | 'all')}
          className="input input-sm w-auto px-3 py-1.5 text-xs appearance-none bg-surface-tertiary"
          aria-label="Filter by mode"
        >
          <option value="all">All Modes</option>
          <option value="simple">Simple</option>
          <option value="advanced">Advanced</option>
        </select>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as BotListParams['sortBy'])}
            className="input input-sm w-auto px-3 py-1.5 text-xs appearance-none bg-surface-tertiary"
            aria-label="Sort by"
          >
            <option value="name">Name</option>
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="executionCount">Executions</option>
          </select>
          <button
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
            aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {renderIcon(sortOrder === 'asc' ? ChevronDown : ChevronUp, 14)}
          </button>
        </div>
      </div>

      {/* View Mode & Count */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-text-tertiary">{totalCount} bot{totalCount !== 1 ? 's' : ''}</span>
        <div className="flex bg-surface-tertiary rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-surface-secondary text-text-primary shadow-sm' : 'text-text-tertiary'}`}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            {renderIcon('Grid', 16)}
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-surface-secondary text-text-primary shadow-sm' : 'text-text-tertiary'}`}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            {renderIcon('List', 16)}
          </button>
        </div>
      </div>
    </div>
  );
});

// ============================================
// Server Bots List
// ============================================

interface ServerBotsListProps {
  bots: Bot[];
  loading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onCreate: () => void;
  onEdit: (bot: Bot) => void;
  onDuplicate: (bot: Bot) => void;
  onDelete: (bot: Bot) => void;
  onToggleStatus: (bot: Bot, enabled: boolean) => void;
  onViewExecutions: (bot: Bot) => void;
  // Filters
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: BotStatus | 'all';
  onStatusChange?: (status: BotStatus | 'all') => void;
  modeFilter?: BotMode | 'all';
  onModeChange?: (mode: BotMode | 'all') => void;
  sortBy?: BotListParams['sortBy'];
  onSortChange?: (sort: BotListParams['sortBy']) => void;
  sortOrder?: BotListParams['sortOrder'];
  onSortOrderChange?: (order: BotListParams['sortOrder']) => void;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export const ServerBotsList = memo(function ServerBotsList({
  bots,
  loading = false,
  totalCount = 0,
  page = 1,
  pageSize = 12,
  onPageChange,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
  onViewExecutions,
  searchQuery = '',
  onSearchChange,
  statusFilter = 'all',
  onStatusChange,
  modeFilter = 'all',
  onModeChange,
  sortBy = 'updatedAt',
  onSortChange,
  sortOrder = 'desc',
  onSortOrderChange,
  viewMode = 'grid',
  onViewModeChange,
}: ServerBotsListProps) {
  const showFilters = searchQuery || statusFilter !== 'all' || modeFilter !== 'all';

  if (loading) {
    return <LoadingState />;
  }

  if (bots.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Bots</h2>
          <button onClick={onCreate} className="btn btn-primary btn-sm">
            {renderIcon('Plus', 14)}
            New Bot
          </button>
        </div>
        <EmptyState onCreate={onCreate} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-primary">
      {/* Header */}
      <div className="p-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-text-primary">Bots</h2>
          {showFilters && (
            <span className="badge badge-primary">
              {renderIcon('Filter', 12)}
              Filters active
            </span>
          )}
        </div>
        <button onClick={onCreate} className="btn btn-primary">
          {renderIcon('Plus', 14)}
          New Bot
        </button>
      </div>

      {/* Search & Filters */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange || (() => {})}
        statusFilter={statusFilter}
        onStatusChange={onStatusChange || (() => {})}
        modeFilter={modeFilter}
        onModeChange={onModeChange || (() => {})}
        sortBy={sortBy}
        onSortChange={onSortChange || (() => {})}
        sortOrder={sortOrder}
        onSortOrderChange={onSortOrderChange || (() => {})}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange || (() => {})}
        totalCount={totalCount}
      />

      {/* Bots Grid/List */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {bots.map((bot) => (
              <BotListItem
                key={bot.id}
                bot={bot}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onToggleStatus={onToggleStatus}
                onViewExecutions={onViewExecutions}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {bots.map((bot) => (
              <div key={bot.id} className="card p-4">
                <BotListItem
                  bot={bot}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  onToggleStatus={onToggleStatus}
                  onViewExecutions={onViewExecutions}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {onPageChange && totalCount > pageSize && (
        <div className="p-4 border-t border-surface-border flex items-center justify-between">
          <span className="text-sm text-text-tertiary">
            Page {page} of {Math.ceil(totalCount / pageSize)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= Math.ceil(totalCount / pageSize)}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

ServerBotsList.displayName = 'ServerBotsList';