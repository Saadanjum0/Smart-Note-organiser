import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotes, getFavoriteNotes, Note, searchNotes as apiSearchNotes, getRecentlyViewedNotes, toggleFavorite as apiToggleFavorite } from '@/services/notesService';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Search, Upload, FileText, Tags as TagsIcon, DownloadCloud, Edit3, X, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import NotesList from '@/components/notes/NotesList';
import { NoteCardProps } from '@/components/notes/NoteCard';
import { getTags, Tag } from '@/services/tagsService';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Helper to get contrasting text color
const getContrastingTextColor = (hexColor: string): string => {
  if (!hexColor) return '#000000'; // Default to black if no color
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF'; // Black for light backgrounds, white for dark
};

const Dashboard = () => {
  const queryClient = useQueryClient(); // For manual cache updates or refetches if needed
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [activeFilterTagIds, setActiveFilterTagIds] = useState<string[]>([]);
  const [activeDocumentTab, setActiveDocumentTab] = useState<"all" | "favorites" | "recent">("all");

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      if (searchTerm.trim() !== "") { // If user starts typing a search, clear active tag filters
        setActiveFilterTagIds([]);
      }
    }, 250); 
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { 
    data: allNotes = [], 
    isLoading: isLoadingAllNotes,
    refetch: refetchAllNotes 
  } = useQuery<Note[]>({ queryKey: ['notes'], queryFn: getNotes });

  const { 
    data: favoriteNotes = [], 
    isLoading: isLoadingFavorites,
    refetch: refetchFavorites,
    isFetching: isFetchingFavorites
  } = useQuery<Note[]>({
    queryKey: ['favorite-notes'],
    queryFn: getFavoriteNotes,
    enabled: activeDocumentTab === "favorites",
  });

  const { 
    data: titleContentSearchedNotes, 
    isLoading: isLoadingTitleContentSearch,
    isFetching: isFetchingTitleContentSearch,
    refetch: refetchTitleContentSearch 
  } = useQuery<Note[]>({ 
    queryKey: ['titleContentSearchedNotes', debouncedSearchTerm], 
    queryFn: () => apiSearchNotes(debouncedSearchTerm), 
    enabled: !!debouncedSearchTerm, // Search runs if debouncedSearchTerm exists, overriding tag filter display priority
  });

  const {
    data: tags = [],
    isLoading: isLoadingTags
  } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => getTags(),
  });

  const { 
    data: recentlyViewedNotes = [], 
    isLoading: isLoadingRecent,
    isFetching: isFetchingRecent,
    refetch: refetchRecent 
  } = useQuery<Note[]>({ 
    queryKey: ['recentlyViewedNotes'], 
    queryFn: () => getRecentlyViewedNotes(10), 
    enabled: activeDocumentTab === "recent",
  });

  useEffect(() => {
    if (activeDocumentTab === 'recent') {
      // console.log("[Dashboard] recentlyViewedNotes state:", recentlyViewedNotes); // REMOVE DEBUG LOG
    }
  }, [recentlyViewedNotes, activeDocumentTab]);

  const handleNoteDeleted = () => {
    refetchAllNotes();
    if (debouncedSearchTerm) refetchTitleContentSearch();
    if (refetchRecent) {
      refetchRecent();
    }
  };

  const handleToggleFavorite = async (noteId: string, currentIsFavorite: boolean) => {
    const success = await apiToggleFavorite(noteId, currentIsFavorite);
    if (success) {
      // Refetch relevant lists
      refetchAllNotes(); 
      if (activeDocumentTab === 'favorites' || favoriteNotes.some(n => n.id === noteId)) {
         refetchFavorites();
      }
      // No need to refetch recent explicitly unless favoriting affects its order or inclusion criteria.
    } else {
      toast.error("Failed to update favorite status.");
    }
  };

  const transformNoteToCardProps = (note: Note): NoteCardProps & { onNoteDeleted: () => void; onToggleFavorite: (noteId: string, currentIsFavorite: boolean) => void; } => {
    const noteFullTags: Tag[] = (note.tags && Array.isArray(note.tags) ? note.tags.map(tagOrId => {
        if (typeof tagOrId === 'string') {
            const foundTag = tags.find(t => t.id === tagOrId || t.name.toLowerCase() === tagOrId.toLowerCase());
            return foundTag || { id: tagOrId, name: String(tagOrId), color: '#718096' };
        }
        return tagOrId as Tag; 
    }).filter(Boolean) as Tag[] : []);
    return {
      id: note.id, title: note.title, content: note.content || '',
      summary: note.ai_summary || undefined, tags: noteFullTags,
      updatedAt: new Date(note.updated_at || Date.now()),
      createdAt: new Date(note.created_at || Date.now()),
      isFavorite: note.is_favorite || false,
      onNoteDeleted: handleNoteDeleted,
      onToggleFavorite: handleToggleFavorite
    };
  };

  const handleTagFilterClick = (tagId: string) => {
    setSearchTerm(""); 
    setActiveFilterTagIds(prevIds => {
      const newIds = prevIds.includes(tagId) 
        ? prevIds.filter(id => id !== tagId) 
        : [...prevIds, tagId];
      // console.log("[Dashboard] Active Tag IDs:", newIds); // REMOVE DEBUG LOG (or keep if still actively debugging multi-select)
      return newIds;
    });
  };

  const clearTagFilters = () => {
    setActiveFilterTagIds([]);
  };
  
  const displayedNotes = useMemo(() => {
    let processedNotes: Note[] = allNotes;

    // 1. Apply Multi-Tag Filters to allNotes first
    if (activeFilterTagIds.length > 0) {
      processedNotes = allNotes.filter(note => {
        if (!note) return false;
        return activeFilterTagIds.some(filterTagId => {
          const activeGlobalTagObj = tags.find(t => t.id === filterTagId);
          if (!activeGlobalTagObj) return false; 
          const filterTagNameLower = activeGlobalTagObj.name.toLowerCase();

          if (note.tags && Array.isArray(note.tags)) {
            const hasFormalTag = note.tags.some(tag => 
              (typeof tag === 'string' && tag === filterTagId) || 
              (typeof tag === 'string' && tag.toLowerCase() === filterTagNameLower) ||
              (typeof tag === 'object' && (tag as Tag).id === filterTagId)
            );
            if (hasFormalTag) return true;
          }
          if (note.ai_summary_keywords && Array.isArray(note.ai_summary_keywords)) {
            if (note.ai_summary_keywords.some(keyword => keyword.toLowerCase() === filterTagNameLower)) {
              return true;
            }
          }
          return false;
        });
      });
    }

    // 2. Apply Document Tab filter (Favorites, Recent) to the already tag-filtered list
    if (activeDocumentTab === "favorites") {
      processedNotes = processedNotes.filter(note => favoriteNotes.some(favNote => favNote.id === note.id));
    } else if (activeDocumentTab === "recent") {
      // `recentlyViewedNotes` is already sorted and limited. We need to filter `processedNotes` to only include these.
      const recentIds = new Set(recentlyViewedNotes.map(rn => rn.id));
      processedNotes = processedNotes.filter(note => recentIds.has(note.id))
                         .sort((a,b) => new Date(b.last_viewed_at || 0).getTime() - new Date(a.last_viewed_at || 0).getTime()); // Re-sort as filter might change order
    } 
    // If "all" tab, processedNotes (already tag-filtered or allNotes) is used.

    // 3. Apply Search Term to the (now tab and tag-filtered) list
    if (debouncedSearchTerm) {
        const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
        // Client-side search on the currently filtered list
        processedNotes = processedNotes.filter(note => 
            note.title.toLowerCase().includes(lowerSearchTerm) || 
            (note.content && note.content.toLowerCase().includes(lowerSearchTerm)) ||
            (note.ai_summary && note.ai_summary.toLowerCase().includes(lowerSearchTerm)) ||
            (note.tags && (note.tags as Tag[]).some(tag => tag.name.toLowerCase().includes(lowerSearchTerm))) || 
            (note.ai_summary_keywords && note.ai_summary_keywords.some(kw => kw.toLowerCase().includes(lowerSearchTerm)))
        );
    } 
    
    return processedNotes.map(transformNoteToCardProps);

  }, [
    activeDocumentTab, allNotes, favoriteNotes, recentlyViewedNotes,
    debouncedSearchTerm, 
    activeFilterTagIds, tags, 
    transformNoteToCardProps
  ]);

  const isLoadingDisplay = isLoadingAllNotes || 
                           (activeDocumentTab === 'favorites' && (isLoadingFavorites || isFetchingFavorites)) ||
                           (activeDocumentTab === 'recent' && (isLoadingRecent || isFetchingRecent)) ||
                           (debouncedSearchTerm ? (isLoadingTitleContentSearch || isFetchingTitleContentSearch) : false) ||
                           isLoadingTags;

  const handleRefresh = () => {
    refetchAllNotes();
    if (refetchFavorites) {
    refetchFavorites();
    }
    if (refetchRecent) {
      refetchRecent();
    }
  };

  // Placeholder for actual recent activity data. Will be empty for now.
  const actualRecentActivity: { icon: React.ElementType; action: string; item?: string; subItems?: string[]; time: string; }[] = [];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-600" />
          <h1 className="text-lg sm:text-xl font-bold text-gray-800">SmartSummarizer</h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search documents..." 
              className="pl-9 pr-4 py-2 w-48 sm:w-64 text-sm border-gray-300 focus:ring-purple-500 focus:border-purple-500 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
                <Button variant="ghost" size="icon" className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm("")}>
                    <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600"/>
          </Button>
            )}
          </div>
          <Link to="/import">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm">
              <Upload className="mr-1.5 h-4 w-4" />
              Import
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white p-6 space-y-8 overflow-y-auto">
          {/* Tag Explorer */}
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TAG EXPLORER</h2>
              {activeFilterTagIds.length > 0 && (
                  <Button variant="link" className="text-xs text-purple-600 hover:text-purple-800 p-0 h-auto flex items-center" onClick={clearTagFilters}>
                      <X className="h-3 w-3 mr-0.5" /> Clear Filters
                  </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">Browse your content by tags</p>
            {isLoadingTags ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7 w-full rounded-md px-3 py-1" />)}
              </div>
            ) : tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 15).map(tag => {
                  const isActive = activeFilterTagIds.includes(tag.id);
                  let bgColor = tag.color || '#E9D5FF';
                  if (isActive) {
                    bgColor = '#BEF264';
                  }
                  const textColor = getContrastingTextColor(bgColor);
                  
                  return (
                    <button 
                      key={tag.id} 
                      onClick={() => handleTagFilterClick(tag.id)}
                      title={`Filter by tag: ${tag.name}`}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-all duration-150 ease-in-out",
                        "focus:outline-none focus:ring-2 focus:ring-offset-1",
                        isActive ? 'ring-purple-600 shadow-md' : 'hover:opacity-80 hover:shadow-sm'
                      )}
                      style={{ backgroundColor: bgColor, color: textColor, borderColor: isActive ? '#A78BFA' : 'transparent' }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No tags available.</p>
            )}
      </div>

          {/* Recent Activity */}
        <div className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">RECENT ACTIVITY</h2>
            {actualRecentActivity.length > 0 ? (
              <ul className="space-y-3">
                {actualRecentActivity.map((activity, index) => (
                  <li key={index} className="text-xs text-gray-700 flex items-start">
                    <activity.icon className="h-3.5 w-3.5 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
                    <div>
                      <span>{activity.action}</span>
                      {activity.item && <span className="font-semibold text-gray-800"> {activity.item}</span>}
                      {activity.subItems && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activity.subItems.map(sub => (
                            <span key={sub} className="px-1.5 py-0.5 text-xxs bg-gray-200 text-gray-600 rounded-full">{sub}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-gray-500 text-xxs">{activity.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">No recent activity to display.</p>
            )}
          </div>
        </aside>

        {/* Document List Area */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
                <h2 className="text-xl font-semibold text-gray-800">Your Documents</h2>
                <div role="tablist" className="flex space-x-1 border-b border-gray-200 mt-2">
                    <button role="tab" aria-selected={activeDocumentTab === 'all'} onClick={() => setActiveDocumentTab('all')} className={`px-3 py-1.5 text-sm font-medium focus:outline-none ${activeDocumentTab === 'all' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-purple-600'}`}>All Documents</button>
                    <button role="tab" aria-selected={activeDocumentTab === 'recent'} onClick={() => setActiveDocumentTab('recent')} className={`px-3 py-1.5 text-sm font-medium focus:outline-none ${activeDocumentTab === 'recent' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-purple-600'}`}>Recently Viewed</button>
                    <button role="tab" aria-selected={activeDocumentTab === 'favorites'} onClick={() => setActiveDocumentTab('favorites')} className={`px-3 py-1.5 text-sm font-medium focus:outline-none ${activeDocumentTab === 'favorites' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-purple-600'}`}>Favorites</button>
                </div>
            </div>
          </div>
          
          {isLoadingDisplay && (
            <div className="flex-1 flex items-center justify-center py-16">
              {/* Show multiple skeletons for a better loading feel for the list */}
              <div className="w-full space-y-4">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
        </div>
      )}

          {!isLoadingDisplay && displayedNotes.length === 0 && (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {debouncedSearchTerm 
                      ? `No documents found for "${debouncedSearchTerm}"` 
                      : (activeDocumentTab === 'favorites' 
                          ? 'No favorite documents yet'
                          : (activeDocumentTab === 'recent'
                              ? 'No recently viewed documents'
                              : (activeFilterTagIds.length > 0 
                                  ? "No documents match the selected tags"
                                  : "No documents yet")
                            )
                        )}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                  {debouncedSearchTerm 
                      ? "Try a different search term or clear the search."
                      : (activeFilterTagIds.length > 0 
                          ? "Try adjusting your tag filters."
                          : "Import a document to get started.")}
              </p>
              {/* Optional: Add Import button here if no documents at all */}
              {(!debouncedSearchTerm && activeFilterTagIds.length === 0) && (
                <Button asChild className="mt-6 bg-purple-600 hover:bg-purple-700 text-white">
                  <Link to="/import">
                    <Upload className="mr-2 h-4 w-4" /> Import First Document
                  </Link>
              </Button>
              )}
            </div>
          )}

          {!isLoadingDisplay && displayedNotes.length > 0 && (
            <>
              {/* 
              {console.log("[Dashboard.tsx] Props to NotesList - displayedNotes:", displayedNotes)} 
              {console.log("[Dashboard.tsx] Props to NotesList - tags (global):", tags)} 
              */}
              <NotesList notes={displayedNotes} /> 
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;