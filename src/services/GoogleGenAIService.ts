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
  private defaultModel = 'gemini-2.0-flash-exp';

  constructor(apiKey?: string) {
    // Use provided key or fallback to environment variable
    const apiKeyToUse = apiKey || import.meta.env.VITE_GOOGLE_GENAI_API_KEY || '';
    
    if (!apiKeyToUse) {
      throw new Error('Google Generative AI API key is required. Please set VITE_GOOGLE_GENAI_API_KEY in your .env file');
    }
    
    this.ai = new GoogleGenerativeAI({ apiKey: apiKeyToUse });
  }

  /**
   * Upload a file to Google AI and get file URI
   * @param file The file to upload
   * @returns Promise that resolves to the uploaded file info
   */
  async uploadFile(file: File): Promise<{ uri: string; mimeType: string; name: string }> {
    try {
      console.log('Uploading file to Google AI:', file.name);
      
      // Convert File to the format expected by Google AI
      const uploadedFile = await this.ai.files.upload({
        file: file,
        config: { 
          mimeType: file.type || 'application/octet-stream',
          displayName: file.name
        },
      });

      console.log('File uploaded successfully:', uploadedFile);
      
      return {
        uri: uploadedFile.uri,
        mimeType: uploadedFile.mimeType,
        name: uploadedFile.name || file.name
      };
    } catch (error) {
      console.error('Error uploading file to Google AI:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Generate content with uploaded files
   * @param prompt The text prompt
   * @param uploadedFiles Array of uploaded file info
   * @param model Optional model override
   * @returns Generated text
   */
  async generateContentWithFiles(
    prompt: string, 
    uploadedFiles: { uri: string; mimeType: string; name: string }[], 
    model?: string
  ): Promise<string> {
    try {
      const genModel = this.ai.getGenerativeModel({
        model: model || this.defaultModel,
      });

      // Create content parts for files and text
      const parts = [
        ...uploadedFiles.map(file => ({ 
          fileData: { 
            fileUri: file.uri, 
            mimeType: file.mimeType 
          } 
        })),
        { text: prompt }
      ];

      const contents = {
        role: 'user' as const,
        parts: parts
      };
      
      const result = await genModel.generateContent({
        contents: [contents]
      });
      
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating content with files:', error);
      throw new Error(`Failed to generate content with files: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Analyze file content with AI using uploaded file
   * @param uploadedFile The uploaded file info
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeUploadedFile(
    uploadedFile: { uri: string; mimeType: string; name: string }, 
    prompt?: string
  ): Promise<string> {
    const defaultPrompt = `--- AI File Analysis ---

Please provide a comprehensive analysis of this file including:

1. **File Type and Format**: Identify the file type, format, and encoding
2. **Main Content Summary**: Summarize the key content and purpose  
3. **Key Information Extracted**: Extract important data, patterns, or insights
4. **Structure and Organization**: Describe how the content is organized
5. **Notable Patterns or Insights**: Identify any interesting patterns, anomalies, or insights
6. **Potential Use Cases or Applications**: Suggest how this file might be used

File: ${uploadedFile.name}`;

    const analysisPrompt = prompt || defaultPrompt;

    try {
      return await this.generateContentWithFiles(analysisPrompt, [uploadedFile]);
    } catch (error) {
      console.error('Error analyzing uploaded file:', error);
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze file content with AI (legacy method for backward compatibility)
   * @param fileContent The content of the file
   * @param fileName The name of the file
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeFileContent(fileContent: string, fileName: string, prompt?: string): Promise<string> {
    const defaultPrompt = `--- AI File Analysis ---

Please provide a comprehensive analysis of this file including:

1. **File Type and Format**: Identify the file type, format, and encoding
2. **Main Content Summary**: Summarize the key content and purpose
3. **Key Information Extracted**: Extract important data, patterns, or insights
4. **Structure and Organization**: Describe how the content is organized
5. **Notable Patterns or Insights**: Identify any interesting patterns, anomalies, or insights
6. **Potential Use Cases or Applications**: Suggest how this file might be used

File: ${fileName}
Content:
${fileContent}`;

    const analysisPrompt = prompt || defaultPrompt;

    try {
      const model = this.ai.getGenerativeModel({ model: this.defaultModel });
      const result = await model.generateContent(analysisPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error analyzing file content:', error);
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze image file with AI vision capabilities (legacy method)
   * @param imageData Base64 image data
   * @param fileName The name of the file
   * @param prompt Optional custom prompt
   * @returns Analysis result
   */
  async analyzeImageFile(imageData: string, fileName: string, prompt?: string): Promise<string> {
    const defaultPrompt = `--- AI File Analysis ---

Please analyze this image and provide:

1. **Detailed Description**: Describe what you see in the image
2. **Objects and Elements**: List all objects, people, text, and elements present
3. **Colors and Composition**: Describe the colors, style, and composition
4. **Context and Setting**: Identify the context, setting, or environment
5. **Text Content (OCR)**: Extract any text visible in the image
6. **Technical Details**: Note any technical aspects like quality, resolution, etc.
7. **Potential Use Cases**: Suggest how this image might be used

Image file: ${fileName}`;

    const analysisPrompt = prompt || defaultPrompt;

    try {
      // Extract base64 data from data URL
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      
      const model = this.ai.getGenerativeModel({ model: this.defaultModel });
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg' // Default, should be determined from actual file type
        }
      };

      const result = await model.generateContent([analysisPrompt, imagePart]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List uploaded files
   * @returns Promise that resolves to list of uploaded files
   */
  async listFiles(): Promise<any[]> {
    try {
      const files = await this.ai.files.list();
      return files.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an uploaded file
   * @param fileName The name of the file to delete
   * @returns Promise that resolves when file is deleted
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.ai.files.delete(fileName);
      console.log('File deleted successfully:', fileName);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}