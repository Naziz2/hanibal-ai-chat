import { GoogleGenAIService } from './GoogleGenAIService';

export interface FileAnalysisResult {
  content: string;
  fileType: string;
  analysis: string;
}

export class FileAnalysisService {
  private googleAIService: GoogleGenAIService;

  constructor(apiKey?: string) {
    try {
      this.googleAIService = new GoogleGenAIService(apiKey);
    } catch (error) {
      throw new Error('Google Generative AI API key is required for file analysis');
    }
  }

  /**
   * Analyze a file with AI and return detailed analysis
   */
  async analyzeFile(file: File, prompt?: string): Promise<FileAnalysisResult> {
    try {
      console.log('Starting file analysis for:', file.name);
      
      // Use the new file upload API for all file types
      const analysis = await this.googleAIService.analyzeFileContent(file, prompt);
      
      // Determine file type
      let fileType = 'binary';
      if (this.isTextFile(file)) {
        fileType = 'text';
      } else if (this.isImageFile(file)) {
        fileType = 'image';
      } else if (this.isPDFFile(file)) {
        fileType = 'pdf';
      } else if (this.isDocumentFile(file)) {
        fileType = 'document';
      }

      return {
        content: '', // Content is handled by the upload API
        fileType,
        analysis
      };

    } catch (error) {
      console.error('Error analyzing file:', error);
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze multiple files together
   */
  async analyzeMultipleFiles(files: File[], prompt?: string): Promise<string> {
    try {
      console.log('Starting analysis for multiple files:', files.map(f => f.name));
      return await this.googleAIService.analyzeMultipleFiles(files, prompt);
    } catch (error) {
      console.error('Error analyzing multiple files:', error);
      throw new Error(`Failed to analyze files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file is a text-based file
   */
  private isTextFile(file: File): boolean {
    const textTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript',
      'application/csv'
    ];
    
    const textExtensions = [
      '.txt', '.md', '.json', '.xml', '.csv', '.js', '.ts', '.jsx', '.tsx',
      '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.htm', '.sql',
      '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.log'
    ];

    return textTypes.some(type => file.type.startsWith(type)) ||
           textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  /**
   * Check if file is an image
   */
  private isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Check if file is a PDF
   */
  private isPDFFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  /**
   * Check if file is a document
   */
  private isDocumentFile(file: File): boolean {
    const documentTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    const documentExtensions = [
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'
    ];

    return documentTypes.some(type => file.type === type) ||
           documentExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  /**
   * Extract text from various file types using AI
   */
  async extractText(file: File): Promise<string> {
    try {
      const result = await this.analyzeFile(file, 
        "Extract all text content from this file. Return only the extracted text without additional commentary or analysis."
      );
      return result.analysis;
    } catch (error) {
      console.error('Error extracting text:', error);
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file metadata and basic information
   */
  getFileMetadata(file: File) {
    return {
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      sizeFormatted: this.formatFileSize(file.size),
      lastModified: new Date(file.lastModified),
      isText: this.isTextFile(file),
      isImage: this.isImageFile(file),
      isPDF: this.isPDFFile(file),
      isDocument: this.isDocumentFile(file),
      extension: file.name.split('.').pop()?.toLowerCase() || ''
    };
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}