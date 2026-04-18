import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Collaborator {
  id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  accepted_at: string | null;
  created_at: string;
  user?: {
    email: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

interface SharingSettings {
  public_access: 'none' | 'view' | 'comment' | 'edit';
  allow_copy: boolean;
}

export function useSharing(boardId: string | null) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [sharingSettings, setSharingSettings] = useState<SharingSettings>({
    public_access: 'none',
    allow_copy: false,
  });
  const [isOwner, setIsOwner] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch collaborators and settings
  const fetchSharing = useCallback(async () => {
    if (!boardId) return;

    setLoading(true);

    // Get board info
    const { data: board } = await supabase
      .from('boards')
      .select('user_id, sharing_settings')
      .eq('id', boardId)
      .single();

    if (board) {
      const ownerCheck = board.user_id === user?.id;
      setIsOwner(ownerCheck);
      setSharingSettings(board.sharing_settings || { public_access: 'none', allow_copy: false });

      if (ownerCheck) {
        setUserRole('owner');
      }
    }

    // Get collaborators
    const { data: collabs } = await supabase
      .from('board_collaborators')
      .select('*')
      .eq('board_id', boardId);

    if (collabs) {
      setCollaborators(collabs);

      // Check current user's role if not owner
      if (!isOwner) {
        const myCollab = collabs.find(
          c => c.user_id === user?.id || c.email === user?.email
        );
        if (myCollab) {
          setUserRole(myCollab.role);
        }
      }
    }

    setLoading(false);
  }, [boardId, user, isOwner]);

  useEffect(() => {
    fetchSharing();
  }, [fetchSharing]);

  // Invite a collaborator by email
  const inviteCollaborator = async (email: string, role: 'editor' | 'viewer' = 'viewer') => {
    if (!boardId || !user) {
      console.error('No boardId or user');
      return { error: 'Not authenticated' };
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return { error: 'Invalid email address' };
    }

    // Check if already invited
    const existing = collaborators.find(
      c => c.email?.toLowerCase() === email.toLowerCase()
    );
    if (existing) {
      return { error: 'User already invited' };
    }

    try {
      const { data, error } = await supabase
        .from('board_collaborators')
        .insert({
          board_id: boardId,
          email: email.toLowerCase().trim(),
          role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error inviting collaborator:', error);
        return { error: error.message };
      }

      console.log('Collaborator invited:', data);
      setCollaborators(prev => [...prev, data]);
      return { data };
    } catch (err) {
      console.error('Exception inviting collaborator:', err);
      return { error: 'Failed to invite' };
    }
  };

  // Remove a collaborator
  const removeCollaborator = async (collaboratorId: string) => {
    const { error } = await supabase
      .from('board_collaborators')
      .delete()
      .eq('id', collaboratorId);

    if (error) return { error: error.message };

    setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
    return { success: true };
  };

  // Update collaborator role
  const updateRole = async (collaboratorId: string, role: 'editor' | 'viewer') => {
    const { error } = await supabase
      .from('board_collaborators')
      .update({ role })
      .eq('id', collaboratorId);

    if (error) return { error: error.message };

    setCollaborators(prev =>
      prev.map(c => c.id === collaboratorId ? { ...c, role } : c)
    );
    return { success: true };
  };

  // Update sharing settings (public access)
  const updateSharingSettings = async (settings: Partial<SharingSettings>) => {
    if (!boardId) {
      console.error('No boardId');
      return { error: 'No board selected' };
    }

    const newSettings = { ...sharingSettings, ...settings };
    console.log('Updating sharing settings:', newSettings);

    try {
      const { error } = await supabase
        .from('boards')
        .update({ sharing_settings: newSettings })
        .eq('id', boardId);

      if (error) {
        console.error('Error updating sharing settings:', error);
        return { error: error.message };
      }

      console.log('Sharing settings updated successfully');
      setSharingSettings(newSettings);
      return { success: true };
    } catch (err) {
      console.error('Exception updating sharing settings:', err);
      return { error: 'Failed to update settings' };
    }
  };

  // Check if current user can edit
  const canEdit = userRole === 'owner' || userRole === 'editor';
  const canView = userRole !== null || sharingSettings.public_access !== 'none';

  return {
    collaborators,
    sharingSettings,
    isOwner,
    userRole,
    canEdit,
    canView,
    loading,
    inviteCollaborator,
    removeCollaborator,
    updateRole,
    updateSharingSettings,
    refresh: fetchSharing,
  };
}
