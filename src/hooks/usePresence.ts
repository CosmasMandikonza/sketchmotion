import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface PresenceUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  color: string;
  status: 'active' | 'idle';
}

const getPresenceColor = (userId: string): string => {
  const colors = [
    '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4',
    '#10b981', '#f59e0b', '#ef4444', '#84cc16',
  ];
  const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export function usePresence(boardId: string | null) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Don't subscribe if no boardId or user
    if (!boardId || !user) {
      return;
    }

    // Don't create duplicate channels
    if (channelRef.current) {
      return;
    }

    const channel = supabase.channel(`board-presence:${boardId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!mountedRef.current) return;

        const state = channel.presenceState();
        const users: PresenceUser[] = [];

        Object.entries(state).forEach(([key, presences]) => {
          const presence = presences[0] as any;
          if (key !== user.id) {
            users.push({
              id: key,
              email: presence.email || '',
              name: presence.name || 'Anonymous',
              avatar: presence.avatar,
              color: getPresenceColor(key),
              status: presence.status || 'active',
            });
          }
        });

        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (!mountedRef.current) return;

        console.log('[Presence] Channel status:', status);

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);

          await channel.track({
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            avatar: user.user_metadata?.avatar_url,
            online_at: new Date().toISOString(),
            status: 'active',
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      setIsConnected(false);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [boardId, user?.id]); // Only depend on boardId and user.id, not full user object

  return {
    onlineUsers,
    isConnected,
    userCount: onlineUsers.length,
  };
}
