import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, DbBoard, DbFrame, DbConnection } from '@/lib/supabase';
import { uploadFrameImage, deleteFrameImage } from '@/lib/storage';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Frame {
  id: string;
  title: string;
  x: number;
  y: number;
  status: 'sketch' | 'polished';
  sketchUrl: string | null;
  polishedUrl: string | null;
  thumbnailUrl: string | null;
  motionNotes: string | null;
  animationStyle: string;
  durationMs: number;
  sortOrder: number;
}

export interface Connection {
  id: string;
  fromFrameId: string;
  toFrameId: string;
  transitionType: string;
}

export interface Board {
  id: string;
  name: string;
  frames: Frame[];
  connections: Connection[];
  sharingSettings?: {
    public_access: 'none' | 'view' | 'edit';
    allow_copy: boolean;
  };
}

export type BoardErrorType = 'access_denied' | 'not_found' | 'load_failed' | null;

// Board cache with TTL for stale-while-revalidate pattern
interface CacheEntry {
  board: Board;
  timestamp: number;
  isReadOnly: boolean;
}

const boardCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useBoard(boardId: string | null) {
  const { user } = useAuth();

  // Initialize from cache if available (stale-while-revalidate)
  const cachedData = boardId ? boardCache.get(boardId) : null;
  const [board, setBoard] = useState<Board | null>(cachedData?.board || null);
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<BoardErrorType>(null);
  const [isReadOnly, setIsReadOnly] = useState(cachedData?.isReadOnly || false);
  const subscriptionsRef = useRef<RealtimeChannel[]>([]);
  const hasLoadedRef = useRef(false); // Track if we've done initial load

  // Convert database frame to app frame
  const dbFrameToFrame = useCallback((dbFrame: DbFrame): Frame => ({
    id: dbFrame.id,
    title: dbFrame.title,
    x: dbFrame.position_x,
    y: dbFrame.position_y,
    status: dbFrame.status,
    sketchUrl: dbFrame.sketch_url,
    polishedUrl: dbFrame.polished_url,
    thumbnailUrl: dbFrame.thumbnail_url,
    motionNotes: dbFrame.motion_notes,
    animationStyle: dbFrame.animation_style,
    durationMs: dbFrame.duration_ms,
    sortOrder: dbFrame.sort_order,
  }), []);

  // Convert database connection to app connection
  const dbConnectionToConnection = useCallback((dbConn: DbConnection): Connection => ({
    id: dbConn.id,
    fromFrameId: dbConn.from_frame_id,
    toFrameId: dbConn.to_frame_id,
    transitionType: dbConn.transition_type,
  }), []);

  // Fetch board data from Supabase with stale-while-revalidate caching
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!boardId) {
      setBoard(null);
      setLoading(false);
      return;
    }

    // Check cache first (stale-while-revalidate)
    const cached = boardCache.get(boardId);
    const now = Date.now();
    const isCacheValid = cached && (now - cached.timestamp < CACHE_TTL);

    // If we have valid cache and not forcing refresh, use it immediately
    if (isCacheValid && !forceRefresh && !hasLoadedRef.current) {
      setBoard(cached.board);
      setIsReadOnly(cached.isReadOnly);
      setLoading(false);
      hasLoadedRef.current = true;
      // Continue to fetch fresh data in background (revalidate)
    }

    // Only show loading spinner on initial load with no cache
    if (!cached && !hasLoadedRef.current) {
      setLoading(true);
    }

    try {
      setError(null);
      setErrorType(null);

      // Fetch board
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();

      if (boardError) {
        // Handle specific error types
        if (boardError.code === 'PGRST116') {
          // Row not found
          setErrorType('not_found');
          setError('Board not found');
          // Clear cache for deleted board
          boardCache.delete(boardId);
        } else if (boardError.code === '42501' || boardError.message?.includes('permission')) {
          // Permission denied
          setErrorType('access_denied');
          setError('You do not have permission to view this board');
          boardCache.delete(boardId);
        } else {
          setErrorType('load_failed');
          setError(boardError.message);
        }
        setLoading(false);
        return;
      }

      // Determine if read-only based on sharing settings and user
      const sharingSettings = boardData.sharing_settings || { public_access: 'none', allow_copy: false };
      const isOwner = user?.id === boardData.user_id;
      const publicAccess = sharingSettings.public_access;

      // Read-only if not owner and public access is view-only or user is not authenticated
      const readOnly = !isOwner && (publicAccess === 'view' || !user);
      setIsReadOnly(readOnly);

      // Fetch frames
      const { data: framesData, error: framesError } = await supabase
        .from('frames')
        .select('*')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true });

      if (framesError) {
        console.error('Error fetching frames:', framesError);
        // Continue with empty frames rather than failing completely
      }

      // Fetch connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('connections')
        .select('*')
        .eq('board_id', boardId);

      if (connectionsError) {
        console.error('Error fetching connections:', connectionsError);
        // Continue with empty connections rather than failing completely
      }

      const newBoard: Board = {
        id: boardData.id,
        name: boardData.name,
        frames: (framesData || []).map(dbFrameToFrame),
        connections: (connectionsData || []).map(dbConnectionToConnection),
        sharingSettings,
      };

      // Update cache
      boardCache.set(boardId, {
        board: newBoard,
        timestamp: now,
        isReadOnly: readOnly,
      });

      setBoard(newBoard);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Error fetching board:', err);
      setErrorType('load_failed');
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [boardId, user, dbFrameToFrame, dbConnectionToConnection]);

  // Setup real-time sync for frames and connections
  const setupRealtimeSync = useCallback((boardIdToSync: string) => {
    // Cleanup existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];

    // Subscribe to frames changes
    const framesChannel = supabase
      .channel(`frames-sync-${boardIdToSync}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'frames',
          filter: `board_id=eq.${boardIdToSync}`,
        },
        (payload) => {
          const newFrame = dbFrameToFrame(payload.new as DbFrame);
          setBoard(prev => {
            if (!prev) return prev;
            // Avoid duplicates
            if (prev.frames.some(f => f.id === newFrame.id)) return prev;
            return { ...prev, frames: [...prev.frames, newFrame] };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'frames',
          filter: `board_id=eq.${boardIdToSync}`,
        },
        (payload) => {
          const updatedFrame = dbFrameToFrame(payload.new as DbFrame);
          setBoard(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              frames: prev.frames.map(f => f.id === updatedFrame.id ? updatedFrame : f)
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'frames',
          filter: `board_id=eq.${boardIdToSync}`,
        },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setBoard(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              frames: prev.frames.filter(f => f.id !== deletedId),
              connections: prev.connections.filter(
                c => c.fromFrameId !== deletedId && c.toFrameId !== deletedId
              ),
            };
          });
        }
      )
      .subscribe();

    // Subscribe to connections changes
    const connectionsChannel = supabase
      .channel(`connections-sync-${boardIdToSync}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connections',
          filter: `board_id=eq.${boardIdToSync}`,
        },
        (payload) => {
          const newConnection = dbConnectionToConnection(payload.new as DbConnection);
          setBoard(prev => {
            if (!prev) return prev;
            if (prev.connections.some(c => c.id === newConnection.id)) return prev;
            return { ...prev, connections: [...prev.connections, newConnection] };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'connections',
          filter: `board_id=eq.${boardIdToSync}`,
        },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setBoard(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              connections: prev.connections.filter(c => c.id !== deletedId)
            };
          });
        }
      )
      .subscribe();

    subscriptionsRef.current = [framesChannel, connectionsChannel];
  }, [dbFrameToFrame, dbConnectionToConnection]);

  // Reset hasLoaded when boardId changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [boardId]);

  // Helper to update both state and cache
  const setBoardWithCache = useCallback((updater: (prev: Board | null) => Board | null) => {
    setBoard(prev => {
      const updated = updater(prev);
      // Update cache if we have a valid board
      if (updated && boardId) {
        boardCache.set(boardId, {
          board: updated,
          timestamp: Date.now(),
          isReadOnly,
        });
      }
      return updated;
    });
  }, [boardId, isReadOnly]);

  // Initial load and real-time setup
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup real-time sync when board is loaded
  useEffect(() => {
    if (board && boardId) {
      setupRealtimeSync(boardId);
    }

    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [board?.id, boardId, setupRealtimeSync]);

  // Create a new frame
  const createFrame = useCallback(async (
    title: string,
    x: number,
    y: number
  ): Promise<Frame | null> => {
    if (!boardId || !user || isReadOnly) return null;

    try {
      // Use max sort_order + 1 to ensure unique ordering even after deletions
      const maxSortOrder = board?.frames.reduce((max, f) => Math.max(max, f.sortOrder), -1) ?? -1;
      const sortOrder = maxSortOrder + 1;

      const { data, error } = await supabase
        .from('frames')
        .insert({
          board_id: boardId,
          title,
          position_x: x,
          position_y: y,
          status: 'sketch',
          animation_style: 'fade',
          duration_ms: 500,
          sort_order: sortOrder,
        })
        .select()
        .single();

      if (error) throw error;

      const newFrame = dbFrameToFrame(data);
      setBoardWithCache(prev => prev ? {
        ...prev,
        frames: [...prev.frames, newFrame],
      } : null);

      return newFrame;
    } catch (err) {
      console.error('Error creating frame:', err);
      setError(err instanceof Error ? err.message : 'Failed to create frame');
      return null;
    }
  }, [boardId, user, board?.frames, dbFrameToFrame, isReadOnly, setBoardWithCache]);

  // Update frame properties
  const updateFrame = useCallback(async (
    frameId: string,
    updates: Partial<Omit<Frame, 'id'>>
  ): Promise<boolean> => {
    if (!boardId || !user || isReadOnly) return false;

    try {
      const dbUpdates: Partial<DbFrame> = {};

      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.x !== undefined) dbUpdates.position_x = updates.x;
      if (updates.y !== undefined) dbUpdates.position_y = updates.y;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.sketchUrl !== undefined) dbUpdates.sketch_url = updates.sketchUrl;
      if (updates.polishedUrl !== undefined) dbUpdates.polished_url = updates.polishedUrl;
      if (updates.thumbnailUrl !== undefined) dbUpdates.thumbnail_url = updates.thumbnailUrl;
      if (updates.motionNotes !== undefined) dbUpdates.motion_notes = updates.motionNotes;
      if (updates.animationStyle !== undefined) dbUpdates.animation_style = updates.animationStyle;
      if (updates.durationMs !== undefined) dbUpdates.duration_ms = updates.durationMs;
      if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

      const { error } = await supabase
        .from('frames')
        .update(dbUpdates)
        .eq('id', frameId);

      if (error) throw error;

      setBoardWithCache(prev => prev ? {
        ...prev,
        frames: prev.frames.map(f =>
          f.id === frameId ? { ...f, ...updates } : f
        ),
      } : null);

      return true;
    } catch (err) {
      console.error('Error updating frame:', err);
      setError(err instanceof Error ? err.message : 'Failed to update frame');
      return false;
    }
  }, [boardId, user, isReadOnly, setBoardWithCache]);

  // Save frame image (upload and update URL)
  const saveFrameImage = useCallback(async (
    frameId: string,
    dataUrl: string,
    type: 'sketch' | 'polished'
  ): Promise<boolean> => {
    if (!boardId || !user || isReadOnly) return false;

    try {
      // Upload image to storage
      const publicUrl = await uploadFrameImage(
        user.id,
        boardId,
        frameId,
        dataUrl,
        type
      );

      if (!publicUrl) throw new Error('Failed to upload image');

      // Update frame with new URL
      // For polished images, only update polishedUrl and status, preserve sketchUrl
      // For sketch images, update sketchUrl and status
      const updates = type === 'sketch'
        ? { sketchUrl: publicUrl, status: 'sketch' as const }
        : { polishedUrl: publicUrl, status: 'polished' as const };

      return await updateFrame(frameId, updates);
    } catch (err) {
      console.error('Error saving frame image:', err);
      setError(err instanceof Error ? err.message : 'Failed to save image');
      return false;
    }
  }, [boardId, user, updateFrame, isReadOnly]);

  // Delete a frame
  const deleteFrame = useCallback(async (frameId: string): Promise<boolean> => {
    if (!boardId || !user || isReadOnly) return false;

    try {
      // Get frame to delete its images
      const frame = board?.frames.find(f => f.id === frameId);

      // Delete from database (connections will be cascade deleted)
      const { error } = await supabase
        .from('frames')
        .delete()
        .eq('id', frameId);

      if (error) throw error;

      // Delete images from storage
      if (frame?.sketchUrl) {
        await deleteFrameImage(frame.sketchUrl);
      }
      if (frame?.polishedUrl) {
        await deleteFrameImage(frame.polishedUrl);
      }

      setBoardWithCache(prev => prev ? {
        ...prev,
        frames: prev.frames.filter(f => f.id !== frameId),
        connections: prev.connections.filter(
          c => c.fromFrameId !== frameId && c.toFrameId !== frameId
        ),
      } : null);

      return true;
    } catch (err) {
      console.error('Error deleting frame:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete frame');
      return false;
    }
  }, [boardId, user, board?.frames, isReadOnly, setBoardWithCache]);

  // Update frame position
  const updateFramePosition = useCallback(async (
    frameId: string,
    x: number,
    y: number
  ): Promise<boolean> => {
    return await updateFrame(frameId, { x, y });
  }, [updateFrame]);

  // Create a connection between frames
  const createConnection = useCallback(async (
    fromFrameId: string,
    toFrameId: string,
    transitionType: string = 'fade'
  ): Promise<Connection | null> => {
    if (!boardId || !user || isReadOnly) return null;

    try {
      const { data, error } = await supabase
        .from('connections')
        .insert({
          board_id: boardId,
          from_frame_id: fromFrameId,
          to_frame_id: toFrameId,
          transition_type: transitionType,
        })
        .select()
        .single();

      if (error) throw error;

      const newConnection = dbConnectionToConnection(data);
      setBoardWithCache(prev => prev ? {
        ...prev,
        connections: [...prev.connections, newConnection],
      } : null);

      return newConnection;
    } catch (err) {
      console.error('Error creating connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to create connection');
      return null;
    }
  }, [boardId, user, dbConnectionToConnection, isReadOnly, setBoardWithCache]);

  // Delete a connection
  const deleteConnection = useCallback(async (connectionId: string): Promise<boolean> => {
    if (!boardId || !user || isReadOnly) return false;

    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      setBoardWithCache(prev => prev ? {
        ...prev,
        connections: prev.connections.filter(c => c.id !== connectionId),
      } : null);

      return true;
    } catch (err) {
      console.error('Error deleting connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
      return false;
    }
  }, [boardId, user, isReadOnly, setBoardWithCache]);

  // Update board name
  const updateBoardName = useCallback(async (name: string): Promise<boolean> => {
    if (!boardId || !user || isReadOnly) return false;

    try {
      const { error } = await supabase
        .from('boards')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', boardId);

      if (error) throw error;

      setBoardWithCache(prev => prev ? { ...prev, name } : null);
      return true;
    } catch (err) {
      console.error('Error updating board name:', err);
      setError(err instanceof Error ? err.message : 'Failed to update board name');
      return false;
    }
  }, [boardId, user, isReadOnly, setBoardWithCache]);

  return {
    board,
    loading,
    error,
    errorType,
    isReadOnly,
    refresh: fetchData,
    createFrame,
    updateFrame,
    saveFrameImage,
    deleteFrame,
    updateFramePosition,
    createConnection,
    deleteConnection,
    updateBoardName,
  };
}

// Export cache clear function for logout or manual refresh
export function clearBoardCache(boardId?: string) {
  if (boardId) {
    boardCache.delete(boardId);
  } else {
    boardCache.clear();
  }
}
