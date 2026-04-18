import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Copy, Check, Link2, X, Trash2, Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSharing } from '@/hooks/useSharing';
import { usePresence } from '@/hooks/usePresence';

interface OnlineUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  status: 'active' | 'idle';
}

interface CollaboratorAvatarsProps {
  boardId: string;
  maxVisible?: number;
}

type PublicAccessLevel = 'none' | 'view' | 'comment' | 'edit';

function copyTextWithExecCommand(text: string) {
  const textarea = document.createElement('textarea');
  const activeElement = document.activeElement as HTMLElement | null;

  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
    activeElement?.focus?.();
  }

  return copied;
}

export function CollaboratorAvatars({
  boardId,
  maxVisible = 3,
}: CollaboratorAvatarsProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [updatingAccess, setUpdatingAccess] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [publicAccessValue, setPublicAccessValue] = useState<PublicAccessLevel>('none');

  const {
    collaborators,
    sharingSettings,
    isOwner,
    inviteCollaborator,
    removeCollaborator,
    updateRole,
    updateSharingSettings,
  } = useSharing(boardId);

  const { onlineUsers } = usePresence(boardId);

  const shareUrl = `${window.location.origin}/board/${boardId}`;

  const visibleUsers = onlineUsers.slice(0, maxVisible);
  const overflowCount = Math.max(0, onlineUsers.length - maxVisible);

  useEffect(() => {
    setPublicAccessValue(sharingSettings.public_access);
  }, [sharingSettings.public_access]);

  const handleCopyLink = async () => {
    setCopyError(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else if (!copyTextWithExecCommand(shareUrl)) {
        throw new Error('Clipboard API unavailable');
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return;
    } catch (clipboardError) {
      try {
        if (!copyTextWithExecCommand(shareUrl)) {
          throw clipboardError;
        }

        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        setCopied(false);
        setCopyError("Couldn't copy the share link automatically. You can still select and copy it manually.");
      }
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);

    const result = await inviteCollaborator(inviteEmail, inviteRole);

    if (result.error) {
      setInviteError(result.error);
    } else {
      setInviteEmail('');
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 2000);
    }

    setInviting(false);
  };

  const handleRemoveCollaborator = async (id: string) => {
    await removeCollaborator(id);
  };

  const handleUpdatePublicAccess = async (newAccess: PublicAccessLevel) => {
    const previousAccess = publicAccessValue;
    setAccessError(null);
    setPublicAccessValue(newAccess);
    setUpdatingAccess(true);
    const result = await updateSharingSettings({ public_access: newAccess });
    if (result.error) {
      console.error('Failed to update:', result.error);
      setPublicAccessValue(previousAccess);
      setAccessError("Couldn't update public access right now. Your previous setting is still active.");
    }
    setUpdatingAccess(false);
  };

  return (
    <div className="relative flex items-center">
      {/* Online user avatars */}
      <div className="flex items-center -space-x-2">
        <AnimatePresence mode="popLayout">
          {visibleUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ scale: 0, x: -20 }}
              animate={{ scale: 1, x: 0 }}
              exit={{ scale: 0, x: -20 }}
              transition={{ type: 'spring', damping: 20, delay: index * 0.05 }}
              className="relative group"
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-[#0d0d1a] cursor-pointer transition-transform hover:scale-110 hover:z-10",
                  user.status === 'idle' && "opacity-60"
                )}
                style={{
                  backgroundColor: user.avatar ? 'transparent' : user.color,
                  boxShadow: `0 0 0 2px ${user.status === 'active' ? user.color : 'transparent'}`
                }}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Status indicator */}
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d0d1a]",
                  user.status === 'active' ? "bg-emerald-400" : "bg-amber-400"
                )}
              />

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-[#1a1a2e] border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                <p className="text-xs font-medium text-white">{user.name}</p>
                <p className="text-[10px] text-white/50">
                  {user.status === 'active' ? 'Editing now' : 'Idle'}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#0d0d1a] flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors"
          >
            <span className="text-xs font-medium text-white/70">+{overflowCount}</span>
          </motion.div>
        )}
      </div>

      {/* Share button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowShareModal(true)}
        data-testid="share-open-button"
        aria-label="Open share board dialog"
        className={cn(
          "ml-2 w-8 h-8 rounded-full flex items-center justify-center transition-all",
          "bg-gradient-to-br from-pink-500/20 to-purple-500/20",
          "border border-white/10 hover:border-pink-500/30",
          "hover:from-pink-500/30 hover:to-purple-500/30"
        )}
      >
        <UserPlus className="w-4 h-4 text-pink-400" />
      </motion.button>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowShareModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute top-full right-0 mt-3 w-[380px] rounded-2xl bg-[#12121f]/95 backdrop-blur-2xl border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)_inset] z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-white/[0.08] bg-gradient-to-r from-pink-500/10 to-purple-500/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-pink-400" />
                    Share Board
                  </h3>
                  <p className="text-xs text-white/50 mt-1">Invite others to collaborate</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-5">
                {/* Share link */}
                <div>
                  <label className="text-xs font-medium text-white/60 mb-2 block">
                    Share link
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-black/30 border border-white/[0.08] overflow-hidden">
                      <Link2 className="w-4 h-4 text-white/40 flex-shrink-0" />
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        data-testid="share-link-input"
                        aria-label="Share link"
                        className="flex-1 text-xs text-white/70 bg-transparent outline-none truncate"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                    <button
                      type="button"
                      data-testid="share-copy-link-button"
                      aria-label="Copy share link"
                      onClick={handleCopyLink}
                      className={cn(
                        "relative z-10 shrink-0 px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium text-xs",
                        copied
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                          : "bg-pink-500/20 border border-pink-500/30 text-pink-400 hover:bg-pink-500/30"
                      )}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  {copyError && (
                    <p className="mt-1.5 text-xs text-amber-300" role="alert">
                      {copyError}
                    </p>
                  )}
                </div>

                {/* Invite by email - only for owner */}
                {isOwner && (
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-2 block">
                      Invite by email
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@email.com"
                        className="flex-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/[0.08] text-sm text-white placeholder-white/30 outline-none focus:border-pink-500/50 transition-colors"
                        onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                        className="px-2 py-2.5 rounded-xl bg-[#1a1a2e] border border-white/[0.08] text-xs text-white/70 outline-none cursor-pointer [&>option]:bg-[#1a1a2e] [&>option]:text-white/70"
                      >
                        <option value="viewer">View</option>
                        <option value="editor">Edit</option>
                      </select>
                      <button
                        onClick={handleInvite}
                        disabled={!inviteEmail || inviting}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                          inviteSuccess
                            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                            : "bg-pink-500/20 border border-pink-500/30 text-pink-400 hover:bg-pink-500/30"
                        )}
                      >
                        {inviting ? 'Inviting...' : inviteSuccess ? 'Sent!' : 'Invite'}
                      </button>
                    </div>
                    {inviteError && (
                      <p className="text-xs text-red-400 mt-1.5">{inviteError}</p>
                    )}
                    {inviteSuccess && (
                      <p className="text-xs text-emerald-400 mt-1.5">Invitation sent successfully!</p>
                    )}
                  </div>
                )}

                {/* Public access toggle - only for owner */}
                {isOwner && (
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-2 block">
                      Public access
                    </label>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-black/30 border transition-colors",
                        updatingAccess ? "border-pink-500/30" : "border-white/[0.08]"
                      )}>
                        {publicAccessValue === 'none' ? (
                          <Lock className="w-4 h-4 text-white/40" />
                        ) : (
                          <Globe className="w-4 h-4 text-emerald-400" />
                        )}
                        <select
                          data-testid="share-public-access-select"
                          aria-label="Public access level"
                          value={publicAccessValue}
                          onChange={(e) => handleUpdatePublicAccess(e.target.value as PublicAccessLevel)}
                          disabled={updatingAccess}
                          className="flex-1 text-sm text-white/70 bg-[#1a1a2e] outline-none cursor-pointer disabled:opacity-50 [&>option]:bg-[#1a1a2e] [&>option]:text-white/70"
                        >
                          <option value="none">Invite only</option>
                          <option value="view">Anyone with link can view</option>
                          <option value="edit">Anyone with link can edit</option>
                        </select>
                        {updatingAccess && (
                          <div className="w-4 h-4 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-white/40 mt-1.5 flex items-center gap-1">
                      {publicAccessValue === 'none' ? (
                        <>
                          <Lock className="w-3 h-3" />
                          Board is private - only you and invited collaborators can access
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 text-amber-400" />
                          <span className="text-amber-400/70">Anyone with the link can access this board</span>
                        </>
                      )}
                    </p>
                    {accessError && (
                      <p className="text-xs text-amber-300 mt-1.5" role="alert">
                        {accessError}
                      </p>
                    )}
                  </div>
                )}

                {/* Invited collaborators */}
                {collaborators.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-2 block">
                      Invited ({collaborators.length})
                    </label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {collaborators.map((collab) => (
                        <div
                          key={collab.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] group"
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center text-xs font-semibold text-white">
                            {collab.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/80 truncate">{collab.email}</p>
                            <p className="text-[10px] text-white/40">
                              {collab.accepted_at ? 'Accepted' : 'Pending'}
                            </p>
                          </div>
                          {isOwner && (
                            <>
                              <select
                                value={collab.role}
                                onChange={(e) => updateRole(collab.id, e.target.value as 'editor' | 'viewer')}
                                className="px-2 py-1 rounded-lg bg-[#1a1a2e] border border-white/[0.08] text-[10px] text-white/60 outline-none cursor-pointer [&>option]:bg-[#1a1a2e] [&>option]:text-white/60"
                              >
                                <option value="viewer">View</option>
                                <option value="editor">Edit</option>
                              </select>
                              <button
                                onClick={() => handleRemoveCollaborator(collab.id)}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </>
                          )}
                          {!isOwner && (
                            <span className="text-[10px] text-white/40 px-2 py-1 rounded-lg bg-white/[0.05]">
                              {collab.role}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Currently online */}
                {onlineUsers.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-2 block flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Online now ({onlineUsers.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {onlineUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                        >
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="w-full h-full rounded-full" />
                            ) : (
                              user.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="text-xs text-white/70">{user.name}</span>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            user.status === 'active' ? "bg-emerald-400" : "bg-amber-400"
                          )} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
