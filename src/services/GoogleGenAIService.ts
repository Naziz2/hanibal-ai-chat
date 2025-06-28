import { GoogleGenerativeAI } from "@google/generative-ai";
import * as GenerativeAI from "@google/generative-ai";

type GenerateContentOptions = {
  model?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  config?: {
    thinkingConfig?: {
      thinkingBudget?: number;
    };
  };
};

export class GoogleGenAIService {
  private ai: GoogleGenerativeAI;
  private defaultModel = 'gemini-2.0-flash-exp';
  private filesApiAvailable = false;

  constructor(apiKey?: string) {
    // Use provided key or fallback to environment variable
    const apiKeyToUse = apiKey || import.meta.env.VITE_GOOGLE_GENAI_API_KEY || '';
    
    if (!apiKeyToUse) {
      throw new Error('Google Generative AI API key is required. Please set VITE_GOOGLE_GENAI_API_KEY in your .env file');
    }
    
    this.ai = new GoogleGenerativeAI(apiKeyToUse);
    
    // Check if files API is available
    this.checkFilesApiAvailability();
  }

  /**
   * Check if the files API is available
   */
  private async checkFilesApiAvailability() {
    try {
      // Test if files API is accessible
      if (this.ai.files && typeof this.ai.files.list === 'function') {
        this.filesApiAvailable = true;
        console.log('Google AI Files API is available');
      } else {
        this.filesApiAvailable = false;
        console.warn('Google AI Files API is not available - file uploads will use text extraction fallback');
      }
    } catch (error) {
      this.filesApiAvailable = false;
      console.warn('Google AI Files API check failed:', error);
    }
  }

  /**
   * Generate content using Google's Gemini model
   * @param options Generation options
   * @returns Generated text
   */
  async generateContent(options: GenerateContentOptions): Promise<string> {
    try {
      const opts = { model: this.defaultModel, ...options };

      const model = this.ai.getGenerativeModel({
        model: opts.model || this.defaultModel,
      });

      const history = opts.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const lastMessage = history.pop();
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be from the user.');
      }

      const chat = model.startChat({
        history: history,
      });

      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Google AI API Error:', error);
      if (error instanceof Error) {
        if (error.message.includes('API_KEY')) {
          throw new Error('Invalid API key. Please check your Google AI API key configuration.');
        }
        throw new Error(`Google AI API error: ${error.message}`);
      }
      throw new Error('An unknown error occurred with the Google AI API');
    }
  }

  /**
   * Generate text using a simple interface
   * @param prompt The prompt to generate text from
   * @param model Optional model override
   * @returns Generated text
   */
  async generateText(messages: { role: 'user' | 'assistant'; content: string }[], model?: string): Promise<string> {
    return this.generateContent({
      messages: messages,
      model: model || this.defaultModel,
      config: {
        thinkingConfig: {
          thinkingBudget: 0, // Disable thinking by default
        },
      },
    });
  }

  /**
   * Upload file to Google AI and wait for processing
   * @param file The file to upload
   * @param displayName Optional display name for the file
   * @returns Promise that resolves to the uploaded file info
   */
  async uploadFile(file: File, displayName?: string) {
    if (!this.filesApiAvailable || !this.ai.files) {
      throw new Error('Files API is not available. Please check your API key permissions or use text-based analysis instead.');
    }

    try {
      console.log(`Uploading file: ${file.name} (${file.type})`);
      
      const uploadedFile = await this.ai.files.upload({
        file: file,
        config: {
          displayName: displayName || file.name,
          mimeType: file.type
        },
      });

      console.log(`File uploaded with URI: ${uploadedFile.uri}`);

      // Wait for the file to be processed
      let getFile = await this.ai.files.get({ name: uploadedFile.name });
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max wait time

      while (getFile.state === 'PROCESSING' && attempts < maxAttempts) {
        console.log(`File processing status: ${getFile.state} (attempt ${attempts + 1}/${maxAttempts})`);
        
        await new Promise((resolve) => {
          setTimeout(resolve, 10000); // Wait 10 seconds between checks
        });
        
        getFile = await this.ai.files.get({ name: uploadedFile.name });
        attempts++;
      }

      if (getFile.state === 'FAILED') {
        throw new Error('File processing failed.');
      }

      if (getFile.state === 'PROCESSING') {
        throw new Error('File processing timed out. Please try again with a smaller file.');
      }

      console.log(`File processing completed: ${getFile.state}`);
      return getFile;

    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze file content with AI using file upload API or text fallback
   * @param file The file to analyze
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeFileContent(file: File, prompt?: string): Promise<string> {
    try {
      // Always try text file analysis first for text files
      if (this.isTextFile(file)) {
        const content = await this.readTextFile(file);
        return this.analyzeTextContent(content, file.name, prompt);
      }

      // For images, try to convert to base64 and analyze directly if files API is not available
      if (this.isImageFile(file) && !this.filesApiAvailable) {
        return this.analyzeImageWithBase64(file, prompt);
      }

      // For binary files, try file upload API if available
      if (this.filesApiAvailable && this.ai.files) {
        const uploadedFile = await this.uploadFile(file);
        
        if (!uploadedFile.uri || !uploadedFile.mimeType) {
          throw new Error('File upload failed - no URI or MIME type returned');
        }

        const defaultPrompt = `Please provide a comprehensive analysis of this file including:

1. **File Type and Format**: Identify the file type, format, and encoding
2. **Main Content Summary**: Summarize the key content and purpose
3. **Key Information Extracted**: Extract important data, patterns, or insights
4. **Structure and Organization**: Describe how the content is organized
5. **Notable Patterns or Insights**: Identify any interesting patterns, anomalies, or insights
6. **Text Content (OCR)**: If this is an image, extract any text visible using OCR
7. **Potential Use Cases or Applications**: Suggest how this file might be used

File: ${file.name}`;

        const analysisPrompt = prompt || defaultPrompt;

        const model = this.ai.getGenerativeModel({ model: this.defaultModel });
        const fileContent = GenerativeAI.createPartFromUri(uploadedFile.uri, uploadedFile.mimeType);
        
        const result = await model.generateContent([analysisPrompt, fileContent]);
        const response = await result.response;
        
        // Clean up uploaded file
        try {
          await this.ai.files.delete({ name: uploadedFile.name });
          console.log(`Cleaned up uploaded file: ${uploadedFile.name}`);
        } catch (cleanupError) {
          console.warn('Failed to clean up uploaded file:', cleanupError);
        }

        return response.text();
      } else {
        // Fallback for when files API is not available
        return this.analyzeFileWithoutUpload(file, prompt);
      }

    } catch (error) {
      console.error('Error analyzing file:', error);
      
      // Try fallback analysis if upload fails
      if (error instanceof Error && error.message.includes('upload')) {
        console.log('Attempting fallback analysis without file upload...');
        try {
          return this.analyzeFileWithoutUpload(file, prompt);
        } catch (fallbackError) {
          console.error('Fallback analysis also failed:', fallbackError);
        }
      }
      
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze file without using the upload API (fallback method)
   * @param file The file to analyze
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  private async analyzeFileWithoutUpload(file: File, prompt?: string): Promise<string> {
    if (this.isTextFile(file)) {
      const content = await this.readTextFile(file);
      return this.analyzeTextContent(content, file.name, prompt);
    }

    if (this.isImageFile(file)) {
      return this.analyzeImageWithBase64(file, prompt);
    }

    // For other file types, provide basic metadata analysis
    const metadata = this.getFileMetadata(file);
    const defaultPrompt = `I cannot directly analyze this file type (${file.type}) without the file upload API, but I can provide information based on the file metadata:

**File Information:**
- Name: ${metadata.name}
- Type: ${metadata.type}
- Size: ${metadata.sizeFormatted}
- Extension: ${metadata.extension}
- Last Modified: ${metadata.lastModified.toLocaleString()}

**Analysis:**
Based on the file extension and type, this appears to be a ${this.getFileTypeDescription(file)}. 

**Recommendations:**
- For full analysis, please ensure your Google AI API key has file upload permissions
- Alternatively, if this is a text-based file, try saving it with a .txt extension
- For images, the system can analyze them using base64 encoding

**Note:** This is a limited analysis due to API restrictions. Full file analysis requires the Google AI Files API to be available.`;

    return prompt ? `${prompt}\n\n${defaultPrompt}` : defaultPrompt;
  }

  /**
   * Analyze image using base64 encoding (fallback when files API is not available)
   * @param file The image file
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  private async analyzeImageWithBase64(file: File, prompt?: string): Promise<string> {
    try {
      const base64Data = await this.fileToBase64(file);
      
      const defaultPrompt = `Please analyze this image and provide:

1. **Detailed Description**: Describe what you see in the image
2. **Objects and Elements**: List all objects, people, text, and elements present
3. **Colors and Composition**: Describe the colors, style, and composition
4. **Context and Setting**: Identify the context, setting, or environment
5. **Text Content (OCR)**: Extract any text visible in the image
6. **Technical Details**: Note any technical aspects like quality, resolution, etc.
7. **Potential Use Cases**: Suggest how this image might be used

Image file: ${file.name}`;

      const analysisPrompt = prompt || defaultPrompt;

      const model = this.ai.getGenerativeModel({ model: this.defaultModel });
      
      const imagePart = {
        inlineData: {
          data: base64Data.split(',')[1], // Remove data:image/...;base64, prefix
          mimeType: file.type
        }
      };

      const result = await model.generateContent([analysisPrompt, imagePart]);
      const response = await result.response;
      return response.text();

    } catch (error) {
      console.error('Error analyzing image with base64:', error);
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert file to base64
   * @param file The file to convert
   * @returns Promise that resolves to base64 string
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get file type description
   * @param file The file
   * @returns Description of the file type
   */
  private getFileTypeDescription(file: File): string {
    if (file.type.startsWith('image/')) return 'image file';
    if (file.type.includes('pdf')) return 'PDF document';
    if (file.type.includes('word') || file.type.includes('document')) return 'Word document';
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return 'Excel spreadsheet';
    if (file.type.includes('powerpoint') || file.type.includes('presentation')) return 'PowerPoint presentation';
    if (file.type.includes('zip') || file.type.includes('archive')) return 'archive file';
    if (file.type.includes('audio')) return 'audio file';
    if (file.type.includes('video')) return 'video file';
    return 'binary file';
  }

  /**
   * Get file metadata
   * @param file The file
   * @returns File metadata object
   */
  private getFileMetadata(file: File) {
    return {
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      sizeFormatted: this.formatFileSize(file.size),
      lastModified: new Date(file.lastModified),
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

  /**
   * Analyze text content directly
   * @param content The text content to analyze
   * @param fileName The name of the file
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  private async analyzeTextContent(content: string, fileName: string, prompt?: string): Promise<string> {
    const defaultPrompt = `Please provide a comprehensive analysis of this text file including:

1. **File Type and Format**: Identify the file type and format
2. **Main Content Summary**: Summarize the key content and purpose
3. **Key Information Extracted**: Extract important data, patterns, or insights
4. **Structure and Organization**: Describe how the content is organized
5. **Notable Patterns or Insights**: Identify any interesting patterns, anomalies, or insights
6. **Potential Use Cases or Applications**: Suggest how this file might be used

File: ${fileName}
Content:
${content}`;

    const analysisPrompt = prompt || defaultPrompt;

    try {
      const model = this.ai.getGenerativeModel({ model: this.defaultModel });
      const result = await model.generateContent(analysisPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error analyzing text content:', error);
      throw new Error(`Failed to analyze text content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze image file with AI vision capabilities using file upload API
   * @param file The image file to analyze
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeImageFile(file: File, prompt?: string): Promise<string> {
    // Use the main analyzeFileContent method which has fallback handling
    return this.analyzeFileContent(file, prompt);
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
   * Upload and analyze multiple files
   * @param files Array of files to analyze
   * @param prompt Optional custom prompt
   * @returns Promise that resolves to analysis results
   */
  async analyzeMultipleFiles(files: File[], prompt?: string): Promise<string> {
    try {
      const uploadedFiles = [];
      const content = [];

      // Add the prompt first
      const defaultPrompt = `Please analyze these files and provide a comprehensive comparison and analysis:

1. **Individual File Analysis**: Analyze each file separately
2. **Comparative Analysis**: Compare and contrast the files
3. **Relationships and Patterns**: Identify any relationships or patterns between files
4. **Combined Insights**: Provide insights that emerge from analyzing all files together
5. **Summary and Recommendations**: Summarize key findings and provide recommendations

Files to analyze:`;

      content.push(prompt || defaultPrompt);

      // Process all files
      for (const file of files) {
        try {
          if (this.isTextFile(file)) {
            // For text files, include content directly
            const textContent = await this.readTextFile(file);
            content.push(`\n\n**${file.name}** (${file.type}):\n${textContent}`);
          } else if (this.isImageFile(file)) {
            // For images, try base64 if files API is not available
            if (this.filesApiAvailable && this.ai.files) {
              const uploadedFile = await this.uploadFile(file);
              if (uploadedFile.uri && uploadedFile.mimeType) {
                uploadedFiles.push(uploadedFile);
                const fileContent = GenerativeAI.createPartFromUri(uploadedFile.uri, uploadedFile.mimeType);
                content.push(fileContent);
              }
            } else {
              // Use base64 fallback for images
              const base64Data = await this.fileToBase64(file);
              const imagePart = {
                inlineData: {
                  data: base64Data.split(',')[1],
                  mimeType: file.type
                }
              };
              content.push(`\n\n**${file.name}** (Image):`);
              content.push(imagePart);
            }
          } else {
            // For other file types, provide metadata
            const metadata = this.getFileMetadata(file);
            content.push(`\n\n**${file.name}**: ${this.getFileTypeDescription(file)} (${metadata.sizeFormatted}) - Limited analysis available without file upload API`);
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          content.push(`\n\n**${file.name}**: Failed to process - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Generate analysis
      const model = this.ai.getGenerativeModel({ model: this.defaultModel });
      const result = await model.generateContent(content);
      const response = await result.response;

      // Clean up uploaded files
      for (const uploadedFile of uploadedFiles) {
        try {
          if (this.ai.files) {
            await this.ai.files.delete({ name: uploadedFile.name });
            console.log(`Cleaned up uploaded file: ${uploadedFile.name}`);
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up uploaded file:', cleanupError);
        }
      }

      return response.text();

    } catch (error) {
      console.error('Error analyzing multiple files:', error);
      throw new Error(`Failed to analyze files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}