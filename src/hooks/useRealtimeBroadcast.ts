import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface FrameMovement {
  frameId: string;
  position: { x: number; y: number };
  userId: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  userId: string;
  userName: string;
  color: string;
}

export interface FrameSelection {
  frameId: string | null;
  userId: string;
  userName: string;
  color: string;
}

export function useRealtimeBroadcast(boardId: string | undefined, userId: string | undefined) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const movementCallbackRef = useRef<((movement: FrameMovement) => void) | null>(null);
  const cursorCallbackRef = useRef<((cursor: CursorPosition) => void) | null>(null);
  const selectionCallbackRef = useRef<((selection: FrameSelection) => void) | null>(null);

  useEffect(() => {
    if (!boardId || !userId) return;

    // Prevent duplicate channels
    if (channelRef.current) return;

    const channel = supabase.channel(`board-broadcast:${boardId}`, {
      config: { broadcast: { self: false } }, // Don't receive own broadcasts
    });

    channel
      .on('broadcast', { event: 'frame-move' }, ({ payload }) => {
        if (movementCallbackRef.current && payload.userId !== userId) {
          movementCallbackRef.current(payload as FrameMovement);
        }
      })
      .on('broadcast', { event: 'cursor-move' }, ({ payload }) => {
        if (cursorCallbackRef.current && payload.userId !== userId) {
          cursorCallbackRef.current(payload as CursorPosition);
        }
      })
      .on('broadcast', { event: 'frame-select' }, ({ payload }) => {
        if (selectionCallbackRef.current && payload.userId !== userId) {
          selectionCallbackRef.current(payload as FrameSelection);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Broadcast] Connected to board channel');
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [boardId, userId]);

  // Broadcast frame movement (call this during drag, throttled)
  const broadcastFrameMove = useCallback((frameId: string, position: { x: number; y: number }) => {
    if (!channelRef.current || !userId) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'frame-move',
      payload: { frameId, position, userId },
    });
  }, [userId]);

  // Broadcast cursor position
  const broadcastCursor = useCallback((x: number, y: number, userName: string, color: string) => {
    if (!channelRef.current || !userId) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor-move',
      payload: { x, y, userId, userName, color },
    });
  }, [userId]);

  // Broadcast frame selection
  const broadcastFrameSelect = useCallback((frameId: string | null, userName: string, color: string) => {
    if (!channelRef.current || !userId) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'frame-select',
      payload: { frameId, userId, userName, color },
    });
  }, [userId]);

  // Register callbacks
  const onFrameMove = useCallback((callback: (movement: FrameMovement) => void) => {
    movementCallbackRef.current = callback;
  }, []);

  const onCursorMove = useCallback((callback: (cursor: CursorPosition) => void) => {
    cursorCallbackRef.current = callback;
  }, []);

  const onFrameSelect = useCallback((callback: (selection: FrameSelection) => void) => {
    selectionCallbackRef.current = callback;
  }, []);

  return {
    broadcastFrameMove,
    broadcastCursor,
    broadcastFrameSelect,
    onFrameMove,
    onCursorMove,
    onFrameSelect,
  };
}

// Throttle utility for smooth 30fps updates
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
}
