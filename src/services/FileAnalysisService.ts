import { GoogleGenAIService } from './GoogleGenAIService';

export interface FileAnalysisResult {
  content: string;
  fileType: string;
  analysis: string;
  uploadedFile?: { uri: string; mimeType: string; name: string };
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
   * Analyze a file with AI using Google's file upload API
   */
  async analyzeFile(file: File, prompt?: string): Promise<FileAnalysisResult> {
    try {
      console.log('Starting file analysis for:', file.name);
      
      // Upload file to Google AI first
      const uploadedFile = await this.googleAIService.uploadFile(file);
      console.log('File uploaded to Google AI:', uploadedFile);

      // Generate analysis using the uploaded file
      const analysis = await this.googleAIService.analyzeUploadedFile(uploadedFile, prompt);
      
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
        throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Analyze file locally (fallback method)
   */
  private async analyzeFileLocally(file: File, prompt?: string): Promise<FileAnalysisResult> {
    // For text-based files, read content directly
    if (this.isTextFile(file)) {
      const fileContent = await this.readTextFile(file);
      const analysis = await this.googleAIService.analyzeFileContent(
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
      const analysis = await this.googleAIService.analyzeImageFile(
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
      return await this.googleAIService.generateText(messages);
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
    try {
      // Upload file and use Google AI for text extraction
      const uploadedFile = await this.googleAIService.uploadFile(file);
      
      const extractionPrompt = "Extract all text content from this file. Return only the extracted text without additional commentary or formatting.";
      
      return await this.googleAIService.generateContentWithFiles(extractionPrompt, [uploadedFile]);
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
}