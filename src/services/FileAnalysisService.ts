import { GoogleGenAIService } from './GoogleGenAIService';

export interface FileAnalysisResult {
  content: string;
  fileType: string;
  analysis: string;
  uploadedFile?: { uri: string; mimeType: string; name: string };
}

export class FileAnalysisService {
  private googleAIService: GoogleGenAIService | null = null;
  private initializationError: string | null = null;

  constructor(apiKey?: string) {
    try {
      this.googleAIService = new GoogleGenAIService(apiKey);
    } catch (error) {
      this.initializationError = error instanceof Error ? error.message : 'Failed to initialize Google AI service';
      console.warn('Google AI service initialization failed:', this.initializationError);
    }
  }

  /**
   * Check if the service is properly initialized
   */
  private isServiceAvailable(): boolean {
    return this.googleAIService !== null && this.initializationError === null;
  }

  /**
   * Analyze a file with AI using Google's file upload API
   */
  async analyzeFile(file: File, prompt?: string): Promise<FileAnalysisResult> {
    // Check if service is available
    if (!this.isServiceAvailable()) {
      console.warn('Google AI service not available, falling back to basic analysis');
      return await this.analyzeFileBasic(file, prompt);
    }

    try {
      console.log('Starting file analysis for:', file.name);
      
      // Upload file to Google AI first
      const uploadedFile = await this.googleAIService!.uploadFile(file);
      console.log('File uploaded to Google AI:', uploadedFile);

      // Generate analysis using the uploaded file
      const analysis = await this.googleAIService!.analyzeUploadedFile(uploadedFile, prompt);
      
      // For text files, also read content locally for display
      let content = '';
      if (this.isTextFile(file)) {
        content = await this.readTextFile(file);
      }

      return {
        content,
        fileType: this.getFileType(file),
        analysis,
        uploadedFile
      };

    } catch (error) {
      console.error('Error analyzing file:', error);
      
      // Fallback to local analysis if upload fails
      try {
        console.log('Falling back to local file analysis...');
        return await this.analyzeFileLocally(file, prompt);
      } catch (fallbackError) {
        console.error('Fallback analysis also failed:', fallbackError);
        
        // Final fallback to basic analysis
        console.log('Falling back to basic file analysis...');
        return await this.analyzeFileBasic(file, prompt);
      }
    }
  }

  /**
   * Analyze file locally (fallback method)
   */
  private async analyzeFileLocally(file: File, prompt?: string): Promise<FileAnalysisResult> {
    if (!this.isServiceAvailable()) {
      throw new Error('Google AI service not available for local analysis');
    }

    // For text-based files, read content directly
    if (this.isTextFile(file)) {
      const fileContent = await this.readTextFile(file);
      const analysis = await this.googleAIService!.analyzeFileContent(
        fileContent, 
        file.name, 
        prompt
      );
      
      return {
        content: fileContent,
        fileType: 'text',
        analysis
      };
    }

    // For images, use vision analysis
    if (this.isImageFile(file)) {
      const imageData = await this.readFileAsDataURL(file);
      const analysis = await this.googleAIService!.analyzeImageFile(
        imageData,
        file.name,
        prompt
      );
      
      return {
        content: '', // Binary content not readable as text
        fileType: 'image',
        analysis
      };
    }

    // For other file types, provide basic analysis
    const basicAnalysis = await this.analyzeGenericFile(file, prompt);
    
    return {
      content: '',
      fileType: 'binary',
      analysis: basicAnalysis
    };
  }

  /**
   * Basic file analysis without AI (final fallback)
   */
  private async analyzeFileBasic(file: File, prompt?: string): Promise<FileAnalysisResult> {
    const fileInfo = {
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    };

    let content = '';
    if (this.isTextFile(file)) {
      try {
        content = await this.readTextFile(file);
      } catch (error) {
        console.warn('Failed to read text file content:', error);
      }
    }

    const analysis = `--- Basic File Analysis ---

**File:** ${fileInfo.name} (${fileInfo.type}, ${this.formatFileSize(fileInfo.size)})

**File Information:**
- Type: ${fileInfo.type || 'Unknown'}
- Size: ${this.formatFileSize(fileInfo.size)}
- Extension: ${file.name.split('.').pop()?.toUpperCase() || 'None'}
- Last Modified: ${new Date(file.lastModified).toLocaleString()}

**File Type Analysis:**
${this.getBasicFileTypeAnalysis(file)}

${content ? `**Content Preview:**\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}` : ''}

*Note: AI analysis is not available. ${this.initializationError ? `Error: ${this.initializationError}` : 'Please check your Google AI API key configuration.'}*`;

    return {
      content,
      fileType: this.getFileType(file),
      analysis
    };
  }

  /**
   * Get basic file type analysis without AI
   */
  private getBasicFileTypeAnalysis(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const type = file.type || '';

    if (this.isTextFile(file)) {
      return 'This appears to be a text-based file that can be read and edited with text editors.';
    }
    
    if (this.isImageFile(file)) {
      return 'This is an image file that can be viewed in image viewers and web browsers.';
    }
    
    if (type.startsWith('audio/')) {
      return 'This is an audio file that can be played with media players.';
    }
    
    if (type.startsWith('video/')) {
      return 'This is a video file that can be played with video players.';
    }
    
    if (type.includes('pdf')) {
      return 'This is a PDF document that can be viewed with PDF readers.';
    }
    
    if (type.includes('document') || type.includes('word')) {
      return 'This appears to be a document file, likely created with word processing software.';
    }
    
    if (type.includes('spreadsheet') || type.includes('excel')) {
      return 'This appears to be a spreadsheet file for data analysis and calculations.';
    }

    return `This is a ${extension ? extension.toUpperCase() + ' ' : ''}file of type ${type || 'unknown'}.`;
  }

  /**
   * Get file type category
   */
  private getFileType(file: File): string {
    if (this.isTextFile(file)) return 'text';
    if (this.isImageFile(file)) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.includes('pdf')) return 'pdf';
    if (file.type.includes('document') || file.type.includes('word')) return 'document';
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'spreadsheet';
    return 'binary';
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
   * Read text file content
   */
  private readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Read file as data URL
   */
  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Analyze generic/binary files
   */
  private async analyzeGenericFile(file: File, prompt?: string): Promise<string> {
    if (!this.isServiceAvailable()) {
      throw new Error('Google AI service not available for generic file analysis');
    }

    const fileInfo = {
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    };

    const defaultPrompt = `--- AI File Analysis ---

Please analyze this file based on its metadata:

File Information:
- Name: ${fileInfo.name}
- Type: ${fileInfo.type}
- Size: ${this.formatFileSize(fileInfo.size)}
- Last Modified: ${fileInfo.lastModified}

Please provide:
1. **File Type Analysis**: What type of file this likely is based on extension and MIME type
2. **Likely Content and Purpose**: What this file probably contains and its purpose
3. **Common Use Cases**: How this file type is typically used
4. **Recommended Tools**: What software or tools can open/edit this file
5. **Security Considerations**: Any security aspects to be aware of
6. **Additional Insights**: Any other relevant information about this file type`;

    const analysisPrompt = prompt || defaultPrompt;

    try {
      const messages = [{ role: 'user' as const, content: analysisPrompt }];
      return await this.googleAIService!.generateText(messages);
    } catch (error) {
      console.error('Error analyzing generic file:', error);
      return `--- AI File Analysis ---

Basic file analysis for ${file.name}:
- File type: ${file.type || 'Unknown'}
- Size: ${this.formatFileSize(file.size)}
- Extension: ${file.name.split('.').pop()?.toUpperCase() || 'None'}
- Last modified: ${new Date(file.lastModified).toLocaleString()}

This appears to be a ${file.type || 'binary'} file. For detailed analysis, please ensure your Google AI API key is properly configured.`;
    }
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

  /**
   * Extract text from various file types using Google AI
   */
  async extractText(file: File): Promise<string> {
    if (!this.isServiceAvailable()) {
      // Fallback to local text extraction for text files
      if (this.isTextFile(file)) {
        return await this.readTextFile(file);
      }
      throw new Error('Text extraction not available - Google AI service not initialized');
    }

    try {
      // Upload file and use Google AI for text extraction
      const uploadedFile = await this.googleAIService!.uploadFile(file);
      
      const extractionPrompt = "Extract all text content from this file. Return only the extracted text without additional commentary or formatting.";
      
      return await this.googleAIService!.generateContentWithFiles(extractionPrompt, [uploadedFile]);
    } catch (error) {
      console.error('Error extracting text:', error);
      
      // Fallback to local text extraction for text files
      if (this.isTextFile(file)) {
        return await this.readTextFile(file);
      }

      throw new Error('Text extraction not supported for this file type');
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
      extension: file.name.split('.').pop()?.toLowerCase() || ''
    };
  }

  /**
   * Analyze multiple files at once
   */
  async analyzeMultipleFiles(files: File[], prompt?: string): Promise<FileAnalysisResult[]> {
    const results: FileAnalysisResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.analyzeFile(file, prompt);
        results.push(result);
      } catch (error) {
        console.error(`Error analyzing file ${file.name}:`, error);
        results.push({
          content: '',
          fileType: 'error',
          analysis: `Failed to analyze ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    return results;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.isServiceAvailable();
  }

  /**
   * Get initialization error if any
   */
  getInitializationError(): string | null {
    return this.initializationError;
  }
}