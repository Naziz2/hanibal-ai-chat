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

  constructor(apiKey?: string) {
    // Use provided key or fallback to environment variable
    const apiKeyToUse = apiKey || import.meta.env.VITE_GOOGLE_GENAI_API_KEY || '';
    
    if (!apiKeyToUse) {
      throw new Error('Google Generative AI API key is required. Please set VITE_GOOGLE_GENAI_API_KEY in your .env file');
    }
    
    this.ai = new GoogleGenerativeAI(apiKeyToUse);
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
   * Analyze file content with AI using file upload API
   * @param file The file to analyze
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeFileContent(file: File, prompt?: string): Promise<string> {
    try {
      // For text files, read content directly for faster processing
      if (this.isTextFile(file)) {
        const content = await this.readTextFile(file);
        return this.analyzeTextContent(content, file.name, prompt);
      }

      // For binary files (images, PDFs, etc.), use file upload API
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

    } catch (error) {
      console.error('Error analyzing file:', error);
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    try {
      const uploadedFile = await this.uploadFile(file);
      
      if (!uploadedFile.uri || !uploadedFile.mimeType) {
        throw new Error('Image upload failed - no URI or MIME type returned');
      }

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
      const fileContent = GenerativeAI.createPartFromUri(uploadedFile.uri, uploadedFile.mimeType);
      
      const result = await model.generateContent([analysisPrompt, fileContent]);
      const response = await result.response;
      
      // Clean up uploaded file
      try {
        await this.ai.files.delete({ name: uploadedFile.name });
        console.log(`Cleaned up uploaded image: ${uploadedFile.name}`);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded image:', cleanupError);
      }

      return response.text();

    } catch (error) {
      console.error('Error analyzing image:', error);
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Upload all files
      for (const file of files) {
        try {
          if (this.isTextFile(file)) {
            // For text files, include content directly
            const textContent = await this.readTextFile(file);
            content.push(`\n\n**${file.name}** (${file.type}):\n${textContent}`);
          } else {
            // For binary files, upload and add file reference
            const uploadedFile = await this.uploadFile(file);
            if (uploadedFile.uri && uploadedFile.mimeType) {
              uploadedFiles.push(uploadedFile);
              const fileContent = GenerativeAI.createPartFromUri(uploadedFile.uri, uploadedFile.mimeType);
              content.push(fileContent);
            }
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
          await this.ai.files.delete({ name: uploadedFile.name });
          console.log(`Cleaned up uploaded file: ${uploadedFile.name}`);
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