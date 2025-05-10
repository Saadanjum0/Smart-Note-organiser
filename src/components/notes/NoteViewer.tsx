
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, ArrowLeft, Star, Trash, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface NoteViewerProps {
  id: string;
  title: string;
  content: string;
  summary?: string;
  tags: Tag[];
  updatedAt: Date;
  createdAt: Date;
  isFavorite?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const NoteViewer = ({
  id,
  title,
  content,
  summary,
  tags,
  updatedAt,
  createdAt,
  isFavorite = false,
  onEdit,
  onDelete,
}: NoteViewerProps) => {
  const navigate = useNavigate();
  const [favorite, setFavorite] = useState(isFavorite);

  const handleFavoriteToggle = () => {
    setFavorite(!favorite);
    toast.success(favorite ? "Removed from favorites" : "Added to favorites");
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    } else {
      toast.success("Note deleted");
      navigate(-1);
    }
  };

  const handleGenerateFlashcards = () => {
    toast.success("Flashcards generated successfully!");
  };

  return (
    <Card className="glass w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center text-muted-foreground hover:text-foreground -ml-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteToggle}
              className={favorite ? "text-yellow-500" : "text-muted-foreground"}
            >
              <Star className="h-5 w-5" fill={favorite ? "currentColor" : "none"} />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <CardTitle className="text-2xl font-bold mt-4">{title}</CardTitle>
        
        <div className="text-sm text-muted-foreground mt-1">
          Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              className="tag-chip"
              style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-4">
        {summary && (
          <div className="glass-card bg-purple-50/50 dark:bg-purple-900/10">
            <h3 className="font-medium mb-2">AI Summary</h3>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
        )}
        
        <div className="prose dark:prose-invert max-w-none">
          {content.split("\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-5 mt-6">
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleDelete} className="text-destructive">
            <Trash className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button variant="outline" onClick={onEdit || (() => navigate(`/notes/edit/${id}`))}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button onClick={handleGenerateFlashcards}>
            Generate Flashcards
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default NoteViewer;
