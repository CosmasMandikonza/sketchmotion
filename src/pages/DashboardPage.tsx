import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { GlassCard } from "@/components/layout/GlassCard";
import { GlassPanel } from "@/components/layout/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  Sparkles,
  Plus,
  Search,
  Grid3X3,
  List,
  MoreHorizontal,
  Clock,
  Copy,
  Trash2,
  Archive,
  FolderOpen,
  Settings,
  LogOut,
  ChevronDown,
  Film,
  Users,
  ArchiveRestore,
  ExternalLink,
  User,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Board type definition
interface Board {
  id: string;
  title: string;
  tagline?: string;
  thumbnailUrl: string;
  frameCount: number;
  updatedAt: Date;
  isShared: boolean;
  isArchived: boolean;
  collaborators: number;
}

// Initial mock data
const initialBoards: Board[] = [
  {
    id: "1",
    title: "Product Launch Animation",
    tagline: "Q4 marketing campaign hero video",
    thumbnailUrl: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=400&q=80",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    frameCount: 12,
    isShared: true,
    isArchived: false,
    collaborators: 3,
  },
  {
    id: "2",
    title: "Explainer Video Storyboard",
    tagline: "How our product works in 60 seconds",
    thumbnailUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80",
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    frameCount: 8,
    isShared: true,
    isArchived: false,
    collaborators: 2,
  },
  {
    id: "3",
    title: "Social Media Campaign",
    tagline: "Instagram reels and TikTok content",
    thumbnailUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80",
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    frameCount: 15,
    isShared: false,
    isArchived: false,
    collaborators: 5,
  },
  {
    id: "4",
    title: "App Onboarding Flow",
    tagline: "New user welcome sequence",
    thumbnailUrl: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&q=80",
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    frameCount: 6,
    isShared: false,
    isArchived: false,
    collaborators: 1,
  },
  {
    id: "5",
    title: "Brand Story Animation",
    tagline: "Company origin story for about page",
    thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
    frameCount: 20,
    isShared: true,
    isArchived: false,
    collaborators: 4,
  },
  {
    id: "6",
    title: "Tutorial Series",
    tagline: "Step-by-step feature walkthroughs",
    thumbnailUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80",
    updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
    frameCount: 10,
    isShared: false,
    isArchived: true,
    collaborators: 2,
  },
];

// Local storage key
const BOARDS_STORAGE_KEY = "sketchmotion_boards";

// Helper to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

// Filter types
type FilterType = "all" | "recent" | "shared" | "archived";

const recentActivity = [
  { action: "Created new frame", board: "Product Launch Animation", time: "2 hours ago" },
  { action: "AI Polish completed", board: "Explainer Video Storyboard", time: "5 hours ago" },
  { action: "Exported video", board: "Social Media Campaign", time: "Yesterday" },
  { action: "Added collaborator", board: "App Onboarding Flow", time: "2 days ago" },
];

// Custom hook for board management with Supabase
function useBoards() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch boards from Supabase with sharing and collaborator info
  const fetchBoards = useCallback(async () => {
    if (!user) {
      setBoards([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch user's own boards with frames
      const { data: ownBoards, error: ownError } = await supabase
        .from('boards')
        .select(`
          id,
          name,
          updated_at,
          is_archived,
          sharing_settings,
          frames (
            id,
            sketch_url,
            polished_url
          ),
          board_collaborators (
            id,
            user_id,
            email
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (ownError) throw ownError;

      // Fetch boards shared with user
      const { data: sharedCollabs, error: sharedError } = await supabase
        .from('board_collaborators')
        .select(`
          board_id,
          boards!inner (
            id,
            name,
            updated_at,
            is_archived,
            sharing_settings,
            user_id,
            frames (
              id,
              sketch_url,
              polished_url
            ),
            board_collaborators (
              id,
              user_id,
              email
            )
          )
        `)
        .or(`user_id.eq.${user.id},email.eq.${user.email}`);

      if (sharedError) throw sharedError;

      // Process own boards
      const ownBoardsData: Board[] = (ownBoards || []).map(board => {
        const sharingSettings = board.sharing_settings as { public_access?: string; allow_copy?: boolean } | null;
        const isPubliclyShared = sharingSettings?.public_access && sharingSettings.public_access !== 'none';
        const hasCollaborators = (board.board_collaborators?.length || 0) > 0;

        return {
          id: board.id,
          title: board.name,
          thumbnailUrl: board.frames?.[0]?.polished_url || board.frames?.[0]?.sketch_url || "",
          frameCount: board.frames?.length || 0,
          updatedAt: new Date(board.updated_at),
          isShared: isPubliclyShared || hasCollaborators,
          isArchived: board.is_archived || false,
          collaborators: (board.board_collaborators?.length || 0) + 1, // +1 for owner
        };
      });

      // Process shared boards (exclude duplicates if user owns them)
      const ownBoardIds = new Set(ownBoardsData.map(b => b.id));
      const sharedBoardsData: Board[] = (sharedCollabs || [])
        .filter(collab => {
          const board = collab.boards as any;
          return board && !ownBoardIds.has(board.id);
        })
        .map(collab => {
          const board = collab.boards as any;
          return {
            id: board.id,
            title: board.name,
            thumbnailUrl: board.frames?.[0]?.polished_url || board.frames?.[0]?.sketch_url || "",
            frameCount: board.frames?.length || 0,
            updatedAt: new Date(board.updated_at),
            isShared: true, // It's shared with this user
            isArchived: board.is_archived || false,
            collaborators: (board.board_collaborators?.length || 0) + 1,
          };
        });

      // Combine and sort by updated_at
      const allBoards = [...ownBoardsData, ...sharedBoardsData].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );

      setBoards(allBoards);
    } catch (error) {
      console.error('Error fetching boards:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const createBoard = useCallback(async () => {
    if (!user) return null;

    try {
      // Find max number from existing "Untitled Board X" titles
      const existingNumbers = boards
        .map(b => {
          const match = b.title.match(/^Untitled Board (\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
      const maxNumber = Math.max(0, ...existingNumbers);

      const { data, error } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          name: `Untitled Board ${maxNumber + 1}`,
        })
        .select()
        .single();

      if (error) throw error;

      const newBoard: Board = {
        id: data.id,
        title: data.name,
        thumbnailUrl: "",
        frameCount: 0,
        updatedAt: new Date(data.updated_at),
        isShared: false,
        isArchived: false,
        collaborators: 1,
      };

      setBoards(prev => [newBoard, ...prev]);
      return data.id;
    } catch (error) {
      console.error('Error creating board:', error);
      return null;
    }
  }, [user, boards]);

  const duplicateBoard = useCallback(async (boardId: string) => {
    if (!user) return;

    const board = boards.find(b => b.id === boardId);
    if (!board) return;

    try {
      // Create new board
      const { data: newBoardData, error: boardError } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          name: `${board.title} (Copy)`,
        })
        .select()
        .single();

      if (boardError) throw boardError;

      // Fetch original board's frames
      const { data: frames, error: framesError } = await supabase
        .from('frames')
        .select('*')
        .eq('board_id', boardId);

      if (framesError) throw framesError;

      // Duplicate frames to new board
      if (frames && frames.length > 0) {
        const newFrames = frames.map(frame => ({
          board_id: newBoardData.id,
          title: frame.title,
          position_x: frame.position_x,
          position_y: frame.position_y,
          status: frame.status,
          sketch_url: frame.sketch_url,
          polished_url: frame.polished_url,
          animation_style: frame.animation_style,
          duration_ms: frame.duration_ms,
          sort_order: frame.sort_order,
        }));

        await supabase.from('frames').insert(newFrames);
      }

      await fetchBoards();
    } catch (error) {
      console.error('Error duplicating board:', error);
    }
  }, [user, boards, fetchBoards]);

  const archiveBoard = useCallback(async (boardId: string) => {
    if (!user) return;

    const board = boards.find(b => b.id === boardId);
    if (!board) return;

    try {
      const newArchivedState = !board.isArchived;

      const { error } = await supabase
        .from('boards')
        .update({ is_archived: newArchivedState })
        .eq('id', boardId);

      if (error) throw error;

      // Update local state
      setBoards(prev => prev.map(b =>
        b.id === boardId ? { ...b, isArchived: newArchivedState } : b
      ));
    } catch (error) {
      console.error('Error archiving board:', error);
    }
  }, [user, boards]);

  const deleteBoard = useCallback(async (boardId: string) => {
    try {
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;

      setBoards(prev => prev.filter(b => b.id !== boardId));
    } catch (error) {
      console.error('Error deleting board:', error);
    }
  }, []);

  return { boards, isLoading, createBoard, duplicateBoard, archiveBoard, deleteBoard, refetch: fetchBoards };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { boards, isLoading, createBoard, duplicateBoard, archiveBoard, deleteBoard } = useBoards();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings state (stored in localStorage)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('sketchmotion_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'dark',
      autoSave: true,
      showTips: true,
      defaultDuration: 2000,
    };
  });

  // Save settings to localStorage when changed
  const updateSettings = useCallback((newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('sketchmotion_settings', JSON.stringify(newSettings));
  }, []);

  // Handle creating a new board
  const handleCreateBoard = useCallback(async () => {
    const newId = await createBoard();
    if (newId) {
      navigate(`/canvas/${newId}`);
    }
  }, [createBoard, navigate]);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/auth');
  }, [signOut, navigate]);

  // Filter boards based on active filter and search
  const filteredBoards = useMemo(() => {
    let result = boards;

    // Apply filter
    switch (activeFilter) {
      case "all":
        result = result.filter(b => !b.isArchived);
        break;
      case "recent":
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        result = result
          .filter(b => !b.isArchived && b.updatedAt >= sevenDaysAgo)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        break;
      case "shared":
        result = result.filter(b => !b.isArchived && b.isShared);
        break;
      case "archived":
        result = result.filter(b => b.isArchived);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(b => 
        b.title.toLowerCase().includes(query) || 
        (b.tagline && b.tagline.toLowerCase().includes(query))
      );
    }

    return result;
  }, [boards, activeFilter, searchQuery]);

  // Get most recent update time
  const mostRecentUpdate = useMemo(() => {
    if (filteredBoards.length === 0) return null;
    const sorted = [...filteredBoards].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return sorted[0]?.updatedAt;
  }, [filteredBoards]);

  // Filter labels
  const filterLabels: Record<FilterType, string> = {
    all: "All Boards",
    recent: "Recent",
    shared: "Shared with Me",
    archived: "Archived",
  };

  return (
    <TooltipProvider>
      <GradientBackground>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <GlassPanel position="left" className="w-64 p-4 flex flex-col fixed h-full">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 mb-8 px-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sm-magenta to-sm-purple flex items-center justify-center shadow-glow">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-white">
                SketchMotion
              </span>
            </Link>

            {/* New Board Button */}
            <Button 
              onClick={handleCreateBoard}
              className="w-full bg-sm-magenta hover:bg-sm-magenta/90 text-white font-semibold mb-6 shadow-glow hover:shadow-glow-lg transition-all btn-press"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Board
            </Button>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
              <button 
                onClick={() => setActiveFilter("all")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === "all" 
                    ? "bg-white/10 text-white" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
                All Boards
                <span className="ml-auto text-xs text-white/50">
                  {boards.filter(b => !b.isArchived).length}
                </span>
              </button>
              <button 
                onClick={() => setActiveFilter("recent")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === "recent" 
                    ? "bg-white/10 text-white" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Clock className="w-5 h-5" />
                Recent
              </button>
              <button 
                onClick={() => setActiveFilter("shared")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === "shared" 
                    ? "bg-white/10 text-white" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Users className="w-5 h-5" />
                Shared with Me
                <span className="ml-auto text-xs text-white/50">
                  {boards.filter(b => !b.isArchived && b.isShared).length}
                </span>
              </button>
              <button 
                onClick={() => setActiveFilter("archived")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === "archived" 
                    ? "bg-white/10 text-white" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Archive className="w-5 h-5" />
                Archived
                <span className="ml-auto text-xs text-white/50">
                  {boards.filter(b => b.isArchived).length}
                </span>
              </button>
            </nav>

            {/* Bottom Actions */}
            <div className="space-y-1 pt-4 border-t border-white/10">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </div>
          </GlassPanel>

          {/* Main Content */}
          <div className="flex-1 ml-64 p-8">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
              <div>
                <h1 className="font-display font-bold text-3xl text-white mb-1">
                  {filterLabels[activeFilter]}
                </h1>
                <p className="text-white/60">
                  {filteredBoards.length} board{filteredBoards.length !== 1 ? "s" : ""}
                  {mostRecentUpdate && ` • Last updated ${formatRelativeTime(mostRecentUpdate)}`}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sm-pink to-sm-purple flex items-center justify-center">
                        {user?.email ? (
                          <span className="text-white text-xs font-medium">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <User className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-white" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setShowProfileModal(true)}>
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {/* Search and Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <Input
                  placeholder="Search boards by title or tagline..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-sm-magenta"
                />
              </div>

              <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === "grid" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
                      }`}
                    >
                      <Grid3X3 className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Grid view</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === "list" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
                      }`}
                    >
                      <List className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>List view</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className={`grid gap-6 ${
                viewMode === "grid"
                  ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-1"
              }`}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <GlassCard key={i} className="overflow-hidden">
                    <Skeleton className="aspect-[4/3] bg-white/10" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-5 w-3/4 bg-white/10" />
                      <Skeleton className="h-4 w-1/2 bg-white/10" />
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredBoards.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center py-16"
              >
                <GlassCard className="p-8 text-center max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="w-8 h-8 text-white/40" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-2">
                    {searchQuery 
                      ? "No boards found" 
                      : `No boards in ${filterLabels[activeFilter].toLowerCase()}`}
                  </h3>
                  <p className="text-white/60 mb-6">
                    {searchQuery 
                      ? "Try adjusting your search terms"
                      : activeFilter === "archived" 
                        ? "Archived boards will appear here"
                        : "Create your first board to get started"}
                  </p>
                  {!searchQuery && activeFilter !== "archived" && (
                    <Button 
                      onClick={handleCreateBoard}
                      className="bg-sm-magenta hover:bg-sm-magenta/90 text-white font-semibold shadow-glow"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create your first board
                    </Button>
                  )}
                </GlassCard>
              </motion.div>
            )}

            {/* Boards Grid/List */}
            {!isLoading && filteredBoards.length > 0 && (
              <AnimatePresence mode="wait">
                {viewMode === "grid" ? (
                  <motion.div
                    key="grid"
                    className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* New Board Card */}
                    <Link
                      to="/canvas/new"
                      aria-label="Create New Board"
                      className="block"
                      onClick={(event) => {
                        event.preventDefault();
                        void handleCreateBoard();
                      }}
                    >
                      <GlassCard
                        hover
                        className="aspect-[4/3] flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/20 hover:border-sm-magenta/50 cursor-pointer"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                          <Plus className="w-8 h-8 text-white/60" />
                        </div>
                        <span className="text-white/60 font-medium">New Board</span>
                      </GlassCard>
                    </Link>

                    {/* Board Cards */}
                    {filteredBoards.map((board, index) => (
                      <motion.div
                        key={board.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link to={`/canvas/${board.id}`}>
                          <GlassCard hover className="overflow-hidden group">
                            {/* Thumbnail */}
                            <div className="aspect-[4/3] relative overflow-hidden">
                              <img
                                src={board.thumbnailUrl}
                                alt={board.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                              {/* Archived Badge */}
                              {board.isArchived && (
                                <div className="absolute top-3 left-3">
                                  <span className="px-2 py-1 rounded-md bg-white/20 backdrop-blur-sm text-xs text-white font-medium">
                                    <Archive className="w-3 h-3 inline mr-1" />
                                    Archived
                                  </span>
                                </div>
                              )}

                              {/* Quick Actions */}
                              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="p-2 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        navigate(`/canvas/${board.id}`);
                                      }}
                                    >
                                      <ExternalLink className="w-4 h-4 text-white" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Open</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="p-2 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        duplicateBoard(board.id);
                                      }}
                                    >
                                      <Copy className="w-4 h-4 text-white" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Duplicate</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="p-2 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        archiveBoard(board.id);
                                      }}
                                    >
                                      {board.isArchived ? (
                                        <ArchiveRestore className="w-4 h-4 text-white" />
                                      ) : (
                                        <Archive className="w-4 h-4 text-white" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>{board.isArchived ? "Restore" : "Archive"}</TooltipContent>
                                </Tooltip>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="p-2 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                                      onClick={(e) => e.preventDefault()}
                                    >
                                      <MoreHorizontal className="w-4 h-4 text-white" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => navigate(`/canvas/${board.id}`)}>
                                      <FolderOpen className="w-4 h-4 mr-2" />
                                      Open
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => duplicateBoard(board.id)}>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => archiveBoard(board.id)}>
                                      {board.isArchived ? (
                                        <>
                                          <ArchiveRestore className="w-4 h-4 mr-2" />
                                          Restore
                                        </>
                                      ) : (
                                        <>
                                          <Archive className="w-4 h-4 mr-2" />
                                          Archive
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-red-500"
                                      onClick={() => deleteBoard(board.id)}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Frame Count Badge */}
                              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                <span className="px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm text-xs text-white font-medium">
                                  <Film className="w-3 h-3 inline mr-1" />
                                  {board.frameCount} frames
                                </span>
                                {board.isShared && (
                                  <span className="px-2 py-1 rounded-md bg-sm-purple/40 backdrop-blur-sm text-xs text-white font-medium">
                                    <Users className="w-3 h-3 inline mr-1" />
                                    Shared
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Info */}
                            <div className="p-4">
                              <h3 className="font-semibold text-white mb-1 truncate">
                                {board.title}
                              </h3>
                              {board.tagline && (
                                <p className="text-sm text-white/50 truncate mb-2">{board.tagline}</p>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-white/60">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {formatRelativeTime(board.updatedAt)}
                                </span>
                                <div className="flex -space-x-2">
                                  {Array.from({ length: Math.min(board.collaborators, 3) }).map(
                                    (_, i) => (
                                      <div
                                        key={i}
                                        className="w-6 h-6 rounded-full border-2 border-white/20 bg-gradient-to-br from-sm-pink to-sm-purple"
                                      />
                                    )
                                  )}
                                  {board.collaborators > 3 && (
                                    <div className="w-6 h-6 rounded-full border-2 border-white/20 bg-white/20 flex items-center justify-center text-xs text-white">
                                      +{board.collaborators - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </GlassCard>
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  /* List View */
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <GlassCard className="overflow-hidden">
                      {/* List Header */}
                      <div className="grid grid-cols-[auto_1fr_100px_120px_150px] gap-4 px-4 py-3 border-b border-white/10 text-sm text-white/50 font-medium">
                        <div className="w-16"></div>
                        <div>Title</div>
                        <div>Frames</div>
                        <div>Updated</div>
                        <div className="text-right">Actions</div>
                      </div>
                      
                      {/* List Items */}
                      {filteredBoards.map((board, index) => (
                        <motion.div
                          key={board.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="grid grid-cols-[auto_1fr_100px_120px_150px] gap-4 px-4 py-3 items-center border-b border-white/5 hover:bg-white/5 transition-colors group"
                        >
                          {/* Thumbnail */}
                          <Link to={`/canvas/${board.id}`} className="block">
                            <div className="w-16 h-12 rounded-lg overflow-hidden">
                              <img
                                src={board.thumbnailUrl}
                                alt={board.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </Link>
                          
                          {/* Title & Tagline */}
                          <Link to={`/canvas/${board.id}`} className="block min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white truncate">{board.title}</h3>
                              {board.isArchived && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-white/10 text-white/60">
                                  Archived
                                </span>
                              )}
                              {board.isShared && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-sm-purple/30 text-white/80">
                                  Shared
                                </span>
                              )}
                            </div>
                            {board.tagline && (
                              <p className="text-sm text-white/50 truncate">{board.tagline}</p>
                            )}
                          </Link>
                          
                          {/* Frames */}
                          <div className="text-sm text-white/60">
                            <Film className="w-3 h-3 inline mr-1" />
                            {board.frameCount}
                          </div>
                          
                          {/* Updated */}
                          <div className="text-sm text-white/60">
                            {formatRelativeTime(board.updatedAt)}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                                  onClick={() => navigate(`/canvas/${board.id}`)}
                                >
                                  <ExternalLink className="w-4 h-4 text-white/60" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Open</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                                  onClick={() => duplicateBoard(board.id)}
                                >
                                  <Copy className="w-4 h-4 text-white/60" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Duplicate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                                  onClick={() => archiveBoard(board.id)}
                                >
                                  {board.isArchived ? (
                                    <ArchiveRestore className="w-4 h-4 text-white/60" />
                                  ) : (
                                    <Archive className="w-4 h-4 text-white/60" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{board.isArchived ? "Restore" : "Archive"}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-red-400"
                                  onClick={() => deleteBoard(board.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </motion.div>
                      ))}
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Recent Activity */}
            {!isLoading && activeFilter === "all" && filteredBoards.length > 0 && (
              <div className="mt-12">
                <h2 className="font-display font-bold text-xl text-white mb-4">
                  Recent Activity
                </h2>
                <GlassCard className="divide-y divide-white/10">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{activity.action}</p>
                        <p className="text-sm text-white/60">{activity.board}</p>
                      </div>
                      <span className="text-sm text-white/40">{activity.time}</span>
                    </div>
                  ))}
                </GlassCard>
              </div>
            )}
          </div>
        </div>

        {/* Profile Modal */}
        <AnimatePresence>
          {showProfileModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowProfileModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <GlassCard className="w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Profile</h2>
                    <button
                      onClick={() => setShowProfileModal(false)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Profile Avatar */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sm-pink to-sm-purple flex items-center justify-center mb-4">
                      <span className="text-white text-2xl font-bold">
                        {user?.email?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold text-lg">
                      {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                    </h3>
                    <p className="text-white/60 text-sm">{user?.email || 'No email'}</p>
                  </div>

                  {/* Profile Info */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-white/5">
                      <label className="text-white/50 text-xs uppercase tracking-wider">Email</label>
                      <p className="text-white mt-1">{user?.email || 'Not set'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5">
                      <label className="text-white/50 text-xs uppercase tracking-wider">Member Since</label>
                      <p className="text-white mt-1">
                        {user?.created_at
                          ? new Date(user.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'Unknown'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5">
                      <label className="text-white/50 text-xs uppercase tracking-wider">Boards Created</label>
                      <p className="text-white mt-1">{boards.length}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5">
                      <label className="text-white/50 text-xs uppercase tracking-wider">Auth Provider</label>
                      <p className="text-white mt-1 capitalize">
                        {user?.app_metadata?.provider || 'Email'}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => setShowProfileModal(false)}
                    className="w-full mt-6 bg-sm-magenta hover:bg-sm-magenta/90 text-white font-semibold"
                  >
                    Close
                  </Button>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettingsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSettingsModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <GlassCard className="w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Settings</h2>
                    <button
                      onClick={() => setShowSettingsModal(false)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Auto-save setting */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-medium">Auto-save</h3>
                        <p className="text-white/50 text-sm">Automatically save changes</p>
                      </div>
                      <button
                        onClick={() => updateSettings({ ...settings, autoSave: !settings.autoSave })}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          settings.autoSave ? 'bg-sm-magenta' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.autoSave ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Show tips setting */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-medium">Show Tips</h3>
                        <p className="text-white/50 text-sm">Display helpful tips and hints</p>
                      </div>
                      <button
                        onClick={() => updateSettings({ ...settings, showTips: !settings.showTips })}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          settings.showTips ? 'bg-sm-magenta' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.showTips ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Default duration */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-white font-medium">Default Frame Duration</h3>
                          <p className="text-white/50 text-sm">Duration for new frames</p>
                        </div>
                        <span className="text-white font-medium">{settings.defaultDuration / 1000}s</span>
                      </div>
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="500"
                        value={settings.defaultDuration}
                        onChange={(e) => updateSettings({ ...settings, defaultDuration: parseInt(e.target.value) })}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-sm-magenta"
                      />
                      <div className="flex justify-between text-xs text-white/40 mt-1">
                        <span>0.5s</span>
                        <span>5s</span>
                      </div>
                    </div>

                    {/* Theme setting */}
                    <div>
                      <h3 className="text-white font-medium mb-2">Theme</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateSettings({ ...settings, theme: 'dark' })}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                            settings.theme === 'dark'
                              ? 'bg-sm-magenta text-white'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          Dark
                        </button>
                        <button
                          onClick={() => updateSettings({ ...settings, theme: 'light' })}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                            settings.theme === 'light'
                              ? 'bg-sm-magenta text-white'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                          disabled
                          title="Light theme coming soon"
                        >
                          Light
                          <span className="text-xs ml-1">(Soon)</span>
                        </button>
                      </div>
                    </div>

                    {/* Clear onboarding data */}
                    <div className="pt-4 border-t border-white/10">
                      <button
                        onClick={() => {
                          // Clear all onboarding localStorage entries
                          Object.keys(localStorage).forEach(key => {
                            if (key.startsWith('onboarding_dismissed_')) {
                              localStorage.removeItem(key);
                            }
                          });
                          alert('Onboarding tutorials have been reset. They will show again when you open a board.');
                        }}
                        className="w-full py-2 px-4 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors text-sm"
                      >
                        Reset Onboarding Tutorials
                      </button>
                    </div>
                  </div>

                  <Button
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full mt-6 bg-sm-magenta hover:bg-sm-magenta/90 text-white font-semibold"
                  >
                    Done
                  </Button>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </GradientBackground>
    </TooltipProvider>
  );
}
