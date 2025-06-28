import { GoogleGenerativeAI } from "@google/generative-ai";

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
  private defaultModel = 'gemini-2.0-flash';
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
        console.warn('Google AI Files API is not available - file uploads will use fallback methods');
      }
    } catch (error) {
      this.filesApiAvailable = false;
      console.warn('Google AI Files API check failed:', error);
    }
  }

  /**
   * Analyze file with Gemini using the provided approach
   */
  private async analyzeFileWithGemini(file: File, prompt: string): Promise<string> {
    try {
      console.log('Starting file analysis with Google GenAI for:', file.name);
      
      // For text files, read content directly and combine with prompt
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || 
          file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.py') ||
          file.name.endsWith('.java') || file.name.endsWith('.cpp') || file.name.endsWith('.c') ||
          file.type.includes('json') || file.type.includes('csv')) {
        
        const reader = new FileReader();
        const fileContent = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        const enhancedPrompt = `${prompt}\n\nFile: ${file.name}\nContent:\n${fileContent}`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.defaultModel}:generateContent?key=${import.meta.env.VITE_GOOGLE_GENAI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: enhancedPrompt
                  }
                ]
              }
            ]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Gemini API failed:', response.status, errorText);
          throw new Error(`Failed to generate response: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!content) {
          throw new Error('No response from Gemini');
        }

        console.log('Text file analysis completed with Gemini');
        return content.trim();
      }

      // For images, use base64 encoding with inline data
      if (file.type.startsWith('image/')) {
        const base64Data = await this.fileToBase64(file);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.defaultModel}:generateContent?key=${import.meta.env.VITE_GOOGLE_GENAI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  },
                  {
                    inlineData: {
                      mimeType: file.type,
                      data: base64Data.split(',')[1] // Remove data:image/...;base64, prefix
                    }
                  }
                ]
              }
            ]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Gemini API failed for image:', response.status, errorText);
          throw new Error(`Failed to analyze image: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!content) {
          throw new Error('No response from Gemini for image analysis');
        }

        console.log('Image analysis completed with Gemini');
        return content.trim();
      }

      // For other file types, try the file upload method if available
      if (this.filesApiAvailable && this.ai.files) {
        const uploadedFile = await this.ai.files.upload({
          file: file,
          config: {
            displayName: file.name,
          },
        });

        console.log('File uploaded successfully:', uploadedFile.name);

        // Wait for the file to be processed
        let getFile = await this.ai.files.get({ name: uploadedFile.name });
        let retryCount = 0;
        const maxRetries = 12; // 1 minute max wait time

        while (getFile.state === 'PROCESSING' && retryCount < maxRetries) {
          console.log(`Current file status: ${getFile.state}`);
          console.log('File is still processing, retrying in 5 seconds');
          
          await new Promise((resolve) => {
            setTimeout(resolve, 5000);
          });
          
          getFile = await this.ai.files.get({ name: uploadedFile.name });
          retryCount++;
        }

        if (getFile.state === 'FAILED') {
          throw new Error('File processing failed.');
        }

        if (getFile.state === 'PROCESSING') {
          throw new Error('File processing timeout. Please try again with a smaller file.');
        }

        // Generate content with the uploaded file
        const model = this.ai.getGenerativeModel({ model: this.defaultModel });
        
        const result = await model.generateContent([
          prompt,
          {
            fileData: {
              mimeType: getFile.mimeType,
              fileUri: getFile.uri
            }
          }
        ]);

        const response = await result.response;
        
        // Clean up uploaded file
        try {
          await this.ai.files.delete({ name: uploadedFile.name });
          console.log(`Cleaned up uploaded file: ${uploadedFile.name}`);
        } catch (cleanupError) {
          console.warn('Failed to clean up uploaded file:', cleanupError);
        }

        console.log('File analysis completed with Google GenAI');
        return response.text();
      } else {
        // Fallback for unsupported file types
        throw new Error(`File type ${file.type} is not supported for analysis without the Files API`);
      }

    } catch (error) {
      console.error('Error with Google GenAI file analysis:', error);
      throw error;
    }
  };

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
   * Analyze file content with AI using the new approach
   * @param file The file to analyze
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeFileContent(file: File, prompt?: string): Promise<string> {
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

    try {
      return await this.analyzeFileWithGemini(file, analysisPrompt);
    } catch (error) {
      console.error('Error analyzing file:', error);
      
      // Provide fallback analysis with basic file information
      const metadata = this.getFileMetadata(file);
      const fallbackAnalysis = `**File Analysis (Limited)**

**Basic Information:**
- **File Name:** ${metadata.name}
- **File Type:** ${metadata.type}
- **File Size:** ${metadata.sizeFormatted}
- **Extension:** ${metadata.extension}
- **Last Modified:** ${metadata.lastModified.toLocaleString()}

**Analysis Status:** 
Unable to perform full AI analysis. Error: ${error instanceof Error ? error.message : 'Unknown error'}

**Recommendations:**
- For text files: Try copying and pasting the content directly into the chat
- For images: Ensure the image is in a supported format (JPEG, PNG, WebP, HEIC, HEIF)
- Check your API key configuration and permissions
- Try with a smaller file size if the file is large`;

      return fallbackAnalysis;
    }
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
   * Analyze image file with AI vision capabilities
   * @param file The image file to analyze
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeImageFile(file: File, prompt?: string): Promise<string> {
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
    return this.analyzeFileContent(file, analysisPrompt);
  }

  /**
   * Analyze multiple files together
   * @param files Array of files to analyze
   * @param prompt Optional custom prompt
   * @returns Promise that resolves to analysis results
   */
  async analyzeMultipleFiles(files: File[], prompt?: string): Promise<string> {
    try {
      const defaultPrompt = `Please analyze these files and provide a comprehensive comparison and analysis:

1. **Individual File Analysis**: Analyze each file separately
2. **Comparative Analysis**: Compare and contrast the files
3. **Relationships and Patterns**: Identify any relationships or patterns between files
4. **Combined Insights**: Provide insights that emerge from analyzing all files together
5. **Summary and Recommendations**: Summarize key findings and provide recommendations

Files to analyze:`;

      const analysisPrompt = prompt || defaultPrompt;
      
      // For multiple files, analyze each separately and then combine
      const individualAnalyses: string[] = [];
      
      for (const file of files) {
        try {
          const analysis = await this.analyzeFileContent(file, `Analyze this file: ${file.name}`);
          individualAnalyses.push(`**${file.name}:**\n${analysis}`);
        } catch (error) {
          console.error(`Error analyzing file ${file.name}:`, error);
          individualAnalyses.push(`**${file.name}:** Failed to analyze - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Combine all analyses
      const combinedContent = `${analysisPrompt}\n\n${individualAnalyses.join('\n\n---\n\n')}`;
      
      // Generate final comparative analysis
      const model = this.ai.getGenerativeModel({ model: this.defaultModel });
      const result = await model.generateContent([
        `Based on the individual file analyses below, provide a comprehensive comparative analysis and summary:\n\n${combinedContent}`
      ]);
      
      const response = await result.response;
      return response.text();

    } catch (error) {
      console.error('Error analyzing multiple files:', error);
      throw new Error(`Failed to analyze files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}