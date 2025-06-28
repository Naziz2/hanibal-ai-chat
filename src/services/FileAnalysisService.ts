import { GoogleGenerativeAI } from "@google/generative-ai";

export interface FileAnalysisResult {
  content: string;
  fileType: string;
  analysis: string;
}

export class FileAnalysisService {
  private ai: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    const apiKeyToUse = apiKey || import.meta.env.VITE_GOOGLE_GENAI_API_KEY || '';
    
    if (!apiKeyToUse) {
      throw new Error('Google Generative AI API key is required for file analysis');
    }
    
    this.ai = new GoogleGenerativeAI(apiKeyToUse);
  }

  /**
   * Analyze a file with AI and return detailed analysis
   */
  async analyzeFile(file: File, prompt: string = "Analyze this file and provide a detailed summary of its contents."): Promise<FileAnalysisResult> {
    try {
      console.log('Starting file analysis with Google GenAI for:', file.name);
      
      // For text-based files, read content directly
      if (this.isTextFile(file)) {
        const fileContent = await this.readTextFile(file);
        const analysis = await this.analyzeTextContent(fileContent, file.name, prompt);
        
        return {
          content: fileContent,
          fileType: 'text',
          analysis
        };
      }

      // For images and other binary files, use Google's file upload API
      if (this.isImageFile(file)) {
        const analysis = await this.analyzeImageFile(file, prompt);
        
        return {
          content: '', // Binary content not readable as text
          fileType: 'image',
          analysis
        };
      }

      // For other file types, try to extract what we can
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
   * Analyze text content using Google GenAI
   */
  private async analyzeTextContent(content: string, fileName: string, prompt: string): Promise<string> {
    const model = this.ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const enhancedPrompt = `${prompt}

File: ${fileName}
Content:
${content}

Please provide a comprehensive analysis including:
1. File type and format
2. Main content summary
3. Key information extracted
4. Structure and organization
5. Any notable patterns or insights
6. Potential use cases or applications`;

    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Analyze image file using Google GenAI vision capabilities
   */
  private async analyzeImageFile(file: File, prompt: string): Promise<string> {
    try {
      // Upload file to Google GenAI
      const uploadedFile = await this.ai.files.upload({
        file: file,
        config: {
          displayName: file.name,
        },
      });

      console.log('Image uploaded successfully:', uploadedFile.name);

      // Wait for file processing
      let getFile = await this.ai.files.get({ name: uploadedFile.name });
      let retryCount = 0;
      const maxRetries = 12;

      while (getFile.state === 'PROCESSING' && retryCount < maxRetries) {
        console.log(`File processing status: ${getFile.state}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        getFile = await this.ai.files.get({ name: uploadedFile.name });
        retryCount++;
      }

      if (getFile.state === 'FAILED') {
        throw new Error('File processing failed');
      }

      if (getFile.state === 'PROCESSING') {
        throw new Error('File processing timeout');
      }

      // Generate analysis
      const model = this.ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      
      const enhancedPrompt = `${prompt}

Please analyze this image and provide:
1. Detailed description of what you see
2. Objects, people, text, and elements present
3. Colors, composition, and style
4. Context and setting
5. Any text content (OCR)
6. Technical details (if applicable)
7. Potential use cases or significance`;

      const result = await model.generateContent([
        enhancedPrompt,
        {
          fileData: {
            mimeType: getFile.mimeType!,
            fileUri: getFile.uri!
          }
        }
      ]);

      const response = await result.response;
      return response.text();

    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  }

  /**
   * Analyze generic/binary files
   */
  private async analyzeGenericFile(file: File, prompt: string): Promise<string> {
    const model = this.ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const fileInfo = {
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    };

    const enhancedPrompt = `${prompt}

File Information:
- Name: ${fileInfo.name}
- Type: ${fileInfo.type}
- Size: ${this.formatFileSize(fileInfo.size)}
- Last Modified: ${fileInfo.lastModified}

This appears to be a binary or unsupported file type. Please provide:
1. Analysis based on file extension and type
2. Likely content and purpose
3. Common use cases for this file type
4. Recommended tools or methods for viewing/editing
5. Any security considerations`;

    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    return response.text();
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
      // Use OCR capabilities of Google GenAI
      const analysis = await this.analyzeImageFile(file, "Extract all text content from this image using OCR. Return only the extracted text without additional commentary.");
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