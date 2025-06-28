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
          file.type,
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

    } catch (error) {
      console.error('Error analyzing file:', error);
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    const defaultPrompt = `Please analyze this file based on its metadata:

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
      return `Basic file analysis for ${file.name}:
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
   * Extract text from various file types
   */
  async extractText(file: File): Promise<string> {
    if (this.isTextFile(file)) {
      return await this.readTextFile(file);
    }

    if (this.isImageFile(file)) {
      // Use OCR capabilities
      const imageData = await this.readFileAsDataURL(file);
      const analysis = await this.googleAIService.analyzeImageFile(
        imageData,
        file.name,
        file.type,
        "Extract all text content from this image using OCR. Return only the extracted text without additional commentary."
      );
      return analysis;
    }

    throw new Error('Text extraction not supported for this file type');
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
}