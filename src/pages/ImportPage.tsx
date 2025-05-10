import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, FileText, File, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { createNote } from "@/services/notesService";
import { processNoteWithAI } from "@/services/aiService";
import mammoth from 'mammoth';
import { performOCR } from '@/services/aiService';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';


const ImportPage = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles([...files, ...newFiles]);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) {
      setDragging(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const getFileIcon = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    
    if (extension === "pdf") {
      return <FileText className="h-6 w-6 text-red-500" />;
    } else if (["doc", "docx"].includes(extension || "")) {
      return <FileText className="h-6 w-6 text-blue-500" />;
    } else if (["txt", "md"].includes(extension || "")) {
      return <File className="h-6 w-6 text-gray-500" />;
    } else {
      return <File className="h-6 w-6 text-purple-500" />;
    }
  };

  const handleImport = async () => {
    if (files.length === 0) {
      toast.error("Please select files to import");
      return;
    }

    setUploading(true);
    setUploadProgress({});

    // Set workerSrc for pdfjs-dist using legacy CDN (2.16.105)
    GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let content = '';
      let title = file.name;
      try {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (["txt", "md"].includes(extension || "")) {
          content = await file.text();
        } else if (extension === "pdf") {
          // PDF extraction
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await getDocument({ data: arrayBuffer }).promise;
          let text = "";
          let ocrText = "";
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const contentObj = await page.getTextContent();
            text += contentObj.items.map((item: any) => item.str).join(" ");
            // OCR for images in PDF (not implemented here, placeholder)
            // You can extract images using advanced pdfjs techniques if needed
          }
          content = text + (ocrText ? `\n\n[OCR Text]\n${ocrText}` : "");
        } else if (extension === "docx") {
          // DOCX extraction
          const arrayBuffer = await file.arrayBuffer();
          const { value: text } = await mammoth.extractRawText({ arrayBuffer });
          content = text;
          // OCR for images in DOCX (not implemented here, placeholder)
        } else if (["png", "jpg", "jpeg", "bmp"].includes(extension || "")) {
          // Image OCR
          const reader = new FileReader();
          content = await new Promise<string>((resolve, reject) => {
            reader.onload = async (e) => {
              try {
                const base64 = (e.target?.result as string).split(',')[1];
                const ocrText = await performOCR(base64);
                resolve(ocrText || '');
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } else {
          content = `Imported file: ${file.name}`;
        }
        // Create note
        const note = await createNote({
          title,
          content,
          status: "active",
          is_favorite: false,
          is_archived: false
        });
        if (note && note.id) {
          await processNoteWithAI(note.id);
        }
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
      } catch (err: any) {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
        toast.error(`Failed to import ${file.name}: ${err.message || err}`);
      }
    }
    toast.success(`${files.length} files imported and processed!`);
    setTimeout(() => navigate("/"), 1000);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 animate-fade-in">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground -ml-3 mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-300">
          Import Notes
        </h1>
      </div>
      
      <Card className="glass shadow-lg dark:bg-gray-800">
        <CardHeader className="pb-4 border-b dark:border-gray-700">
          <CardTitle className="text-xl text-gray-800 dark:text-gray-100">Upload Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
              dragging
                ? "border-purple-400 bg-purple-50/50 dark:bg-purple-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50/30 dark:hover:border-purple-700 dark:hover:bg-purple-900/10"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.txt,.doc,.docx,.md"
            />
            <Upload className="h-12 w-12 mx-auto text-purple-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Drag and drop files here</h3>
            <p className="text-muted-foreground mb-4">
              Or click to browse your computer
            </p>
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, TXT, DOC, DOCX, MD
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Selected Files ({files.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="glass p-3 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      {getFileIcon(file)}
                      <div className="max-w-xs">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    {uploading ? (
                      <div className="flex items-center space-x-2">
                        {uploadProgress[file.name] === 100 ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full"
                              style={{ width: `${uploadProgress[file.name] || 0}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-3 pt-2">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={uploading}
          className="glass"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleImport} 
          disabled={files.length === 0 || uploading}
          className="bg-purple-500 hover:bg-purple-600"
        >
          {uploading ? "Processing..." : "Import Files"}
        </Button>
      </div>
    </div>
  );
};

export default ImportPage;
