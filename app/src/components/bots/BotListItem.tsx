/**
 * Nexora Bots - Bot List Item
 * Card component for displaying a bot in the list
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import {
  Bot,
  BotMode,
  BotStatus,
  BotListItemProps,
} from '@/types/bots';
import { renderIcon } from '@/components/flow/nodes/FlowNodes';

// ============================================
// Avatar Component
// ============================================

const BotAvatar = memo(function BotAvatar({
  src,
  name,
  size = 40,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const initials = useMemo(() => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  const colors = [
    'bg-primary-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-danger-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];

  const colorIndex = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % colors.length;
  }, [name]);

  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" className="avatar-img" />
      ) : (
        <div className={`avatar-fallback ${colors[colorIndex]}`} style={{ fontSize: size * 0.35 }}>
          {initials}
        </div>
      )}
    </div>
  );
});

// ============================================
// Mode Badge
// ============================================

const ModeBadge = memo(function ModeBadge({ mode }: { mode: BotMode }) {
  return (
    <span
      className={`badge ${
        mode === 'simple' ? 'badge-success' : 'badge-primary'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {mode === 'simple' ? renderIcon('Zap', 10) : renderIcon('GitBranch', 10)}
        {mode === 'simple' ? 'Simple' : 'Advanced'}
      </span>
    </span>
  );
});

// ============================================
// Status Toggle
// ============================================

const StatusToggle = memo(function StatusToggle({
  status,
  onChange,
  disabled,
}: {
  status: BotStatus;
  onChange: (status: BotStatus) => void;
  disabled?: boolean;
}) {
  const isEnabled = status === 'enabled';

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(isEnabled ? 'disabled' : 'enabled')}
      disabled={disabled}
      className={`toggle relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-fast ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary`}
      aria-label={isEnabled ? 'Disable bot' : 'Enable bot'}
      aria-pressed={isEnabled}
    >
      <span
        className={`toggle-track w-full h-full ${
          isEnabled ? 'bg-success-500' : 'bg-surface-border-strong'
        }`}
      />
      <span className="toggle-thumb" />
    </button>
  );
});

// ============================================
// Dropdown Menu
// ============================================

const DropdownMenu = memo(function DropdownMenu({
  isOpen,
  onClose,
  children,
  anchorRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  anchorRef: React.RefObject<HTMLButtonElement>;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="dropdown-menu animate-slide-down"
      role="menu"
    >
      {children}
    </div>
  );
});

// ============================================
// Bot List Item
// ============================================

export const BotListItem = memo(function BotListItem({
  bot,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
  onViewExecutions,
}: BotListItemProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownAnchorRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);

  const modeColors = {
    simple: 'text-success-500',
    advanced: 'text-primary-500',
  };

  const modeIcons = {
    simple: Zap,
    advanced: GitBranch,
  };

  return (
    <div className="card-hover group relative">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <BotAvatar src={bot.avatarUrl} name={bot.name} size={48} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-text-primary truncate">{bot.name}</h3>
              <ModeBadge mode={bot.mode} />
            </div>

            {bot.description && (
              <p className="text-sm text-text-tertiary line-clamp-2 mt-1">{bot.description}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${bot.status === 'enabled' ? 'bg-success-500' : 'bg-surface-border-strong'}`} />
                {bot.status === 'enabled' ? 'Enabled' : 'Disabled'}
              </span>
              <span>{bot.executionCount} executions</span>
              {bot.lastExecutedAt && (
                <span>Last run: {new Date(bot.lastExecutedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Status Toggle */}
            <StatusToggle
              status={bot.status}
              onChange={onToggleStatus}
            />

            {/* Dropdown */}
            <div className="relative">
              <button
                ref={dropdownAnchorRef}
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="p-2 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
                aria-label="More options"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                {renderIcon('MoreHorizontal', 18)}
              </button>

              <DropdownMenu
                isOpen={dropdownOpen}
                onClose={() => setDropdownOpen(false)}
                anchorRef={dropdownAnchorRef}
              >
                <button
                  type="button"
                  onClick={() => { onEdit(bot); setDropdownOpen(false); }}
                  className="dropdown-item"
                  role="menuitem"
                >
                  {renderIcon('Settings', 14)}
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { onDuplicate(bot); setDropdownOpen(false); }}
                  className="dropdown-item"
                  role="menuitem"
                >
                  {renderIcon('Copy', 14)}
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => { onViewExecutions(bot); setDropdownOpen(false); }}
                  className="dropdown-item"
                  role="menuitem"
                >
                  {renderIcon('Eye', 14)}
                  View Executions
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  onClick={() => {
                    setDeleting(true);
                    setDropdownOpen(false);
                  }}
                  className="dropdown-item dropdown-item-danger"
                  role="menuitem"
                  disabled={deleting}
                >
                  {renderIcon('Trash2', 14)}
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Delete Confirmation */}
        {deleting && (
          <div className="mt-3 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg animate-slide-down">
            <div className="flex items-center gap-2 text-sm text-danger-500 mb-2">
              {renderIcon('AlertCircle', 16)}
              <span>Delete "{bot.name}"?</span>
            </div>
            <p className="text-xs text-text-tertiary mb-3">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(bot); setDeleting(false); }}
                className="btn btn-danger btn-sm flex-1"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleting(false)}
                className="btn btn-secondary btn-sm flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

BotListItem.displayName = 'BotListItem';