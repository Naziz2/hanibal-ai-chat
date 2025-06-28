import React, { useRef, useState } from 'react';
import { Upload, X, File as FileIcon, Image, FileText, Code, Eye, Brain, Download, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { FileAnalysisService } from '../services/FileAnalysisService';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
  analysis?: string;
  metadata?: any;
  uploadedFile?: { uri: string; mimeType: string; name: string };
  analysisStatus?: 'pending' | 'analyzing' | 'completed' | 'error';
}

interface EnhancedFileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedTypes?: string[];
  className?: string;
  onClose?: () => void;
  enableAnalysis?: boolean;
  autoAnalyze?: boolean;
}

export const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({
  onFilesUploaded,
  maxFiles = 5,
  maxSizeInMB = 10,
  acceptedTypes = ['image/*', 'text/*', '.pdf', '.doc', '.docx', '.json', '.csv', '.md', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.mp3', '.mp4', '.wav'],
  className = '',
  onClose,
  enableAnalysis = true,
  autoAnalyze = false
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileAnalysisService = useRef<FileAnalysisService | null>(null);

  // Initialize file analysis service
  const getAnalysisService = () => {
    if (!fileAnalysisService.current) {
      try {
        fileAnalysisService.current = new FileAnalysisService();
      } catch (error) {
        console.warn('File analysis service not available:', error);
        return null;
      }
    }
    return fileAnalysisService.current;
  };

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith('image/')) return <Image size={16} className="text-blue-500" />;
    if (type.startsWith('audio/')) return <div className="w-4 h-4 bg-green-500 rounded-full" />;
    if (type.startsWith('video/')) return <div className="w-4 h-4 bg-red-500 rounded-full" />;
    if (type.includes('text') || type.includes('json') || type.includes('csv') || name.endsWith('.md')) 
      return <FileText size={16} className="text-green-500" />;
    if (type.includes('javascript') || type.includes('typescript') || name.endsWith('.py') || name.endsWith('.java')) 
      return <Code size={16} className="text-purple-500" />;
    return <FileIcon size={16} className="text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else if (result instanceof ArrayBuffer) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(result)));
          resolve(`data:${file.type};base64,${base64}`);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      // For text files, read as text
      if (file.type.startsWith('text/') || 
          file.type.includes('json') || 
          file.type.includes('csv') ||
          file.type.includes('markdown') ||
          file.name.endsWith('.md') ||
          file.name.endsWith('.txt') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.csv') ||
          file.name.endsWith('.js') ||
          file.name.endsWith('.ts') ||
          file.name.endsWith('.py') ||
          file.name.endsWith('.java') ||
          file.name.endsWith('.cpp') ||
          file.name.endsWith('.c')) {
        reader.readAsText(file);
      } else {
        // For binary files (images, audio, video, etc.), read as data URL
        reader.readAsDataURL(file);
      }
    });
  };

  const analyzeFile = async (file: File, fileId: string) => {
    const analysisService = getAnalysisService();
    if (!analysisService || !enableAnalysis) return;

    // Update file status to analyzing
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, analysisStatus: 'analyzing' } : f
    ));

    try {
      const result = await analysisService.analyzeFile(file);
      
      // Format the analysis with proper header and structure
      const formattedAnalysis = `--- AI File Analysis ---

**File:** ${file.name} (${file.type}, ${formatFileSize(file.size)})

${result.analysis}`;

      setAnalysisResults(prev => ({
        ...prev,
        [fileId]: formattedAnalysis
      }));

      // Update file status to completed and include the uploaded file info
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          analysisStatus: 'completed',
          analysis: formattedAnalysis,
          uploadedFile: result.uploadedFile
        } : f
      ));

      // Trigger the parent callback with updated files
      const updatedFiles = uploadedFiles.map(f => 
        f.id === fileId ? { 
          ...f, 
          analysisStatus: 'completed' as const,
          analysis: formattedAnalysis,
          uploadedFile: result.uploadedFile
        } : f
      );
      onFilesUploaded(updatedFiles);

    } catch (error) {
      console.error('File analysis failed:', error);
      const errorAnalysis = `--- AI File Analysis ---

**File:** ${file.name} (${file.type}, ${formatFileSize(file.size)})

❌ **Analysis Error:** ${error instanceof Error ? error.message : 'Unknown error occurred during analysis'}

**File Information:**
- Type: ${file.type || 'Unknown'}
- Size: ${formatFileSize(file.size)}
- Last Modified: ${new Date(file.lastModified).toLocaleString()}

*Note: The file was uploaded but automatic analysis failed. You can still use this file in your conversation.*`;
      
      setAnalysisResults(prev => ({
        ...prev,
        [fileId]: errorAnalysis
      }));

      // Update file status to error
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          analysisStatus: 'error',
          analysis: errorAnalysis
        } : f
      ));
    }
  };

  const processFiles = async (files: FileList) => {
    if (uploadedFiles.length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > maxSizeInMB * 1024 * 1024) {
          alert(`File ${file.name} is too large. Maximum size is ${maxSizeInMB}MB`);
          continue;
        }

        const content = await readFileContent(file);
        const fileId = `file-${Date.now()}-${i}`;
        
        const uploadedFile: UploadedFile = {
          id: fileId,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          content,
          preview: file.type.startsWith('image/') ? content : undefined,
          analysisStatus: enableAnalysis ? 'pending' : undefined,
          metadata: {
            lastModified: file.lastModified,
            extension: file.name.split('.').pop()?.toLowerCase() || ''
          }
        };

        newFiles.push(uploadedFile);

        // Start analysis automatically if enabled
        if (enableAnalysis && autoAnalyze) {
          // Small delay to ensure the file is added to state first
          setTimeout(() => analyzeFile(file, fileId), 100);
        }
      }

      const updatedFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(updatedFiles);
      onFilesUploaded(updatedFiles);
      
    } catch (error) {
      console.error('Error processing files:', error);
      alert('Error processing files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = uploadedFiles.filter(f => f.id !== fileId);
    setUploadedFiles(updatedFiles);
    onFilesUploaded(updatedFiles);
    
    // Remove analysis result
    setAnalysisResults(prev => {
      const newResults = { ...prev };
      delete newResults[fileId];
      return newResults;
    });
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
    onFilesUploaded([]);
    setAnalysisResults({});
  };

  const downloadAnalysis = (fileName: string, analysis: string) => {
    const blob = new Blob([analysis], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'analyzing':
        return <Brain size={14} className="text-purple-400 animate-pulse" />;
      case 'completed':
        return <CheckCircle size={14} className="text-green-400" />;
      case 'error':
        return <AlertCircle size={14} className="text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className={`enhanced-file-upload-container ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
          isDragOver
            ? 'border-blue-500 bg-blue-500/10 scale-105 shadow-lg shadow-blue-500/20'
            : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            isDragOver ? 'bg-blue-500/20 scale-110' : 'bg-gray-700'
          }`}>
            <Upload className={`w-10 h-10 ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`} />
          </div>
          
          <div className="text-center">
            {isUploading ? (
              <div className="space-y-3">
                <div className="text-blue-400 font-medium text-lg">Processing files...</div>
                <div className="w-40 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xl font-medium text-gray-200">
                  {isDragOver ? '🎯 Drop files here' : '📁 Upload & Analyze Files'}
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-blue-400">Click to browse</span> or drag and drop
                </div>
                <div className="text-xs text-gray-500">
                  Images, documents, code, audio, video • Max {maxFiles} files, {maxSizeInMB}MB each
                  {enableAnalysis && (
                    <div className="flex items-center justify-center gap-1 text-purple-400 mt-2">
                      <Sparkles size={12} />
                      <span>AI analysis powered by Google Gemini</span>
                      <Sparkles size={12} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              📁 Uploaded Files ({uploadedFiles.length})
              {enableAnalysis && (
                <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                  AI Analysis Ready
                </span>
              )}
            </h4>
            <button
              onClick={clearAllFiles}
              className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
            >
              Clear All
            </button>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex flex-col p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:bg-gray-800/70 transition-all duration-200 file-item"
              >
                <div className="flex items-center space-x-3">
                  {file.preview ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-blue-500/30">
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(file.type, file.name)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate flex items-center gap-2">
                      {file.name}
                      {getStatusIcon(file.analysisStatus)}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      {formatFileSize(file.size)} • {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                      {file.analysisStatus === 'analyzing' && (
                        <span className="text-purple-400">Analyzing...</span>
                      )}
                      {file.analysisStatus === 'completed' && (
                        <span className="text-green-400">✓ Analyzed</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {enableAnalysis && (
                      <>
                        {file.analysisStatus === 'analyzing' ? (
                          <div className="flex items-center space-x-1 text-purple-400">
                            <Brain size={14} className="animate-pulse" />
                            <span className="text-xs">Analyzing...</span>
                          </div>
                        ) : file.analysisStatus === 'completed' && analysisResults[file.id] ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                const analysis = analysisResults[file.id];
                                if (analysis) {
                                  const modal = document.createElement('div');
                                  modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 analysis-modal';
                                  modal.innerHTML = `
                                    <div class="bg-gray-800 rounded-xl max-w-4xl max-h-[80vh] overflow-auto p-6 border border-gray-700">
                                      <div class="flex justify-between items-center mb-4">
                                        <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                                          <span class="text-purple-400">🧠</span>
                                          AI Analysis: ${file.name}
                                        </h3>
                                        <button class="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700" onclick="this.closest('.fixed').remove()">
                                          <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                          </svg>
                                        </button>
                                      </div>
                                      <div class="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">${analysis}</div>
                                    </div>
                                  `;
                                  document.body.appendChild(modal);
                                }
                              }}
                              className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-all duration-200 btn-hover-scale"
                              title="View analysis"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => downloadAnalysis(file.name, analysisResults[file.id])}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all duration-200 btn-hover-scale"
                              title="Download analysis"
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        ) : file.analysisStatus !== 'analyzing' ? (
                          <button
                            onClick={() => {
                              const fileObj = new File([file.content], file.name, { type: file.type });
                              analyzeFile(fileObj, file.id);
                            }}
                            className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all duration-200 btn-hover-scale"
                            title="Analyze file"
                          >
                            <Brain size={14} />
                          </button>
                        ) : null}
                      </>
                    )}
                    
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 btn-hover-scale"
                      title="Remove file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Show analysis preview if available */}
                {file.analysisStatus === 'completed' && analysisResults[file.id] && (
                  <div className="mt-3 pt-3 border-t border-gray-700 analysis-preview rounded-lg p-3">
                    <div className="text-xs text-purple-400 mb-2 flex items-center gap-1">
                      <Sparkles size={12} />
                      AI Analysis Preview:
                    </div>
                    <div className="text-xs text-gray-400 line-clamp-2">
                      {analysisResults[file.id].substring(0, 200)}...
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};