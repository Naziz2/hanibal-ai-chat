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
      
      // Use the enhanced file analysis method with fallback handling
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
        content: '', // Content is handled by the analysis service
        fileType,
        analysis
      };

    } catch (error) {
      console.error('Error analyzing file:', error);
      
      // Provide a fallback analysis with basic file information
      const metadata = this.getFileMetadata(file);
      const fallbackAnalysis = `**File Analysis (Limited)**

**Basic Information:**
- **File Name:** ${metadata.name}
- **File Type:** ${metadata.type}
- **File Size:** ${metadata.sizeFormatted}
- **Extension:** ${metadata.extension}
- **Last Modified:** ${metadata.lastModified.toLocaleString()}

**Analysis Status:** 
Unable to perform full AI analysis due to API limitations. This may be because:
- The Google AI API key doesn't have file upload permissions
- The file type is not supported for direct analysis
- There was a temporary API issue

**Recommendations:**
- For text files: Try copying and pasting the content directly into the chat
- For images: The system may still be able to analyze them using alternative methods
- Check your API key configuration and permissions

**Error Details:** ${error instanceof Error ? error.message : 'Unknown error'}`;

      return {
        content: '',
        fileType: this.getFileTypeFromFile(file),
        analysis: fallbackAnalysis
      };
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
      
      // Provide fallback analysis for multiple files
      let fallbackAnalysis = `**Multiple File Analysis (Limited)**\n\n`;
      fallbackAnalysis += `**Files Provided:** ${files.length}\n\n`;
      
      files.forEach((file, index) => {
        const metadata = this.getFileMetadata(file);
        fallbackAnalysis += `**${index + 1}. ${metadata.name}**\n`;
        fallbackAnalysis += `- Type: ${metadata.type}\n`;
        fallbackAnalysis += `- Size: ${metadata.sizeFormatted}\n`;
        fallbackAnalysis += `- Extension: ${metadata.extension}\n\n`;
      });
      
      fallbackAnalysis += `**Analysis Status:** Unable to perform full AI analysis due to API limitations.\n\n`;
      fallbackAnalysis += `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      return fallbackAnalysis;
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
   * Get file type from file
   */
  private getFileTypeFromFile(file: File): string {
    if (this.isTextFile(file)) return 'text';
    if (this.isImageFile(file)) return 'image';
    if (this.isPDFFile(file)) return 'pdf';
    if (this.isDocumentFile(file)) return 'document';
    return 'binary';
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