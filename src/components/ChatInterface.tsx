import React, { useState, useEffect, useRef } from 'react';
import { Message, Model, Provider } from '../types';

import { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL } from '../config/models';
import { CodeExecutionService, detectLanguage } from '../services/CodeExecutionService';
import { GoogleGenAIService } from '../services/GoogleGenAIService';
import { OpenRouterService } from '../services/OpenRouterService';
import { ImageGenerationService } from '../services/ImageGenerationService';
import { MidjourneyService } from '../services/MidjourneyService';
import { FileAnalysisService } from '../services/FileAnalysisService';
import { WebSearchService } from '../services/WebSearchService';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';
import { ProviderSelector } from './ProviderSelector';
import { WelcomeScreen } from './WelcomeScreen';
import { FileUpload } from './FileUpload';
import { Send, Image as ImageIcon, Paperclip, X, Search } from 'lucide-react';
import { MainWorkspace } from './MainWorkspace';
import ImageStyleSelector from './ImageStyleSelector';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
}

// Constants for context management
const MAX_FILE_CONTENT_CHARS = 50000;
const MAX_CONVERSATION_HISTORY_MESSAGES = 10;

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<Model>(DEFAULT_MODEL);
  const [workspaceFiles, setWorkspaceFiles] = useState<{ code: string; language: string }[]>([]);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [executionState, setExecutionState] = useState<{
    isRunning: boolean;
    output: string;
  }>({ isRunning: false, output: '' });
  const [input, setInput] = useState('');
  const [imageStyle, setImageStyle] = useState(1);
  const [imageSize, setImageSize] = useState('1-1');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openRouterService = useRef(new OpenRouterService()).current;
  const googleAIService = useRef(new GoogleGenAIService()).current;
  const imageGenerationService = useRef(new ImageGenerationService()).current;
  const midjourneyService = useRef(new MidjourneyService()).current;
  const fileAnalysisService = useRef<FileAnalysisService | null>(null);
  const webSearchService = useRef(new WebSearchService()).current;

  // Initialize file analysis service
  useEffect(() => {
    try {
      fileAnalysisService.current = new FileAnalysisService();
    } catch (error) {
      console.warn('File analysis service not available:', error);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    const newModel = newProvider.models[0];
    setModel(newModel);
  };

  const handleModelChange = (newModel: Model) => {
    setModel(newModel);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles(files);
  };

  const analyzeFilesWithAI = async (files: UploadedFile[]): Promise<string> => {
    if (!fileAnalysisService.current || files.length === 0) return '';

    try {
      let analysisText = '\n\n--- AI File Analysis ---\n';
      
      for (const file of files) {
        try {
          let fileBlob: Blob;
          
          if (file.content.startsWith('data:')) {
            const response = await fetch(file.content);
            fileBlob = await response.blob();
          } else {
            fileBlob = new Blob([file.content], { type: file.type });
          }
          
          const fileObj = new File([fileBlob], file.name, { type: file.type });
          const result = await fileAnalysisService.current.analyzeFile(fileObj);
          
          analysisText += `\n**${file.name}** (${file.type}):\n`;
          analysisText += `${result.analysis}\n\n`;
          
          if (result.fileType === 'text' && result.content) {
            const contentPreview = result.content.length > 500 
              ? result.content.substring(0, 500) + '...' 
              : result.content;
            analysisText += `**Content:**\n\`\`\`\n${contentPreview}\n\`\`\`\n\n`;
          }
          
        } catch (error) {
          console.error(`Error analyzing file ${file.name}:`, error);
          analysisText += `\n**${file.name}**: Analysis failed - ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
        }
      }
      
      return analysisText;
    } catch (error) {
      console.error('Error in file analysis:', error);
      return '\n\n--- File Analysis Error ---\nFailed to analyze files with AI.\n\n';
    }
  };

  const formatFilesForMessage = (files: UploadedFile[]): string => {
    if (files.length === 0) return '';
    
    let filesText = '\n\n--- Uploaded Files ---\n';
    files.forEach((file, index) => {
      filesText += `\n${index + 1}. **${file.name}** (${file.type}, ${formatFileSize(file.size)})\n`;
      
      if (file.type.startsWith('text/') || 
          file.type.includes('json') || 
          file.type.includes('csv') ||
          file.name.endsWith('.md') ||
          file.name.endsWith('.txt') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.csv')) {
        
        let content = file.content;
        let truncated = false;
        
        if (content.length > MAX_FILE_CONTENT_CHARS) {
          content = content.substring(0, MAX_FILE_CONTENT_CHARS);
          truncated = true;
        }
        
        filesText += `Content:\n\`\`\`\n${content}\n\`\`\`\n`;
        
        if (truncated) {
          filesText += `[Content truncated - showing first ${MAX_FILE_CONTENT_CHARS} characters of ${file.content.length} total]\n`;
        }
      } else if (file.type.startsWith('image/')) {
        filesText += `[Image file - Please analyze and describe this image in detail, including any text, objects, people, colors, composition, and other visual elements you can observe.]\n`;
        if (provider.id === 'google' || provider.id === 'openrouter') {
          filesText += `Image data: ${file.content}\n`;
        }
      } else {
        filesText += `[Binary file - ${file.type}]\n`;
      }
    });
    
    return filesText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleWebSearch = async () => {
    if (!input.trim()) return;

    setIsSearching(true);
    const now = Date.now();
    
    const userMessage: Message = {
      id: `user-search-${now}`,
      role: 'user',
      content: `Web search: ${input}`,
      timestamp: new Date(now),
    };

    const loadingMessageId = `loading-search-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
      model: 'web-search',
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    const searchQuery = input;
    setInput('');

    try {
      const searchResults = await webSearchService.search(searchQuery);
      
      let responseText = `**Web Search Results for: "${searchQuery}"**\n\n`;
      
      if (searchResults.results && searchResults.results.length > 0) {
        searchResults.results.forEach((result, index) => {
          responseText += `**${index + 1}. ${result.title}**\n`;
          responseText += `${result.snippet}\n`;
          responseText += `🔗 [${result.url}](${result.url})\n\n`;
        });
        
        if (searchResults.total_results) {
          responseText += `\n*Found ${searchResults.total_results} total results*`;
        }
      } else {
        responseText += 'No search results found for this query.';
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? { 
                ...msg, 
                content: responseText, 
                isLoading: false 
              } 
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error performing web search:', error);
      const errorMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: `Web search failed: ${error.message}`,
        isError: true,
        timestamp: new Date(),
        model: 'web-search',
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== loadingMessageId), errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    if (provider.id === 'rapidapi') {
      handleGenerateImage();
      return;
    }

    const now = Date.now();
    let messageContent = input;
    
    // Check if user is asking for file analysis
    const isRequestingFileAnalysis = uploadedFiles.length > 0 && (
      input.toLowerCase().includes('analyze') ||
      input.toLowerCase().includes('analysis') ||
      input.toLowerCase().includes('examine') ||
      input.toLowerCase().includes('review') ||
      input.toLowerCase().includes('what is') ||
      input.toLowerCase().includes('describe') ||
      input.toLowerCase().includes('explain')
    );

    if (isRequestingFileAnalysis && fileAnalysisService.current) {
      const analysisResult = await analyzeFilesWithAI(uploadedFiles);
      messageContent += analysisResult;
    }

    messageContent += formatFilesForMessage(uploadedFiles);
    
    const userMessage: Message = {
      id: `user-${now}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(now),
    };

    const loadingMessageId = `loading-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
      model: model.id,
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);
    setInput('');
    setUploadedFiles([]);

    try {
      let responseText = '';
      
      const recentMessages = messages.slice(-MAX_CONVERSATION_HISTORY_MESSAGES);
      const conversationHistory = recentMessages.map(msg => ({ 
        role: msg.role, 
        content: msg.content || '' 
      }));
      
      const currentMessages = [...conversationHistory, { role: 'user' as const, content: messageContent }];
      
      if (provider.id === 'openrouter') {
        responseText = await openRouterService.generateText(
          model.id, 
          currentMessages
        );
      } else if (provider.id === 'google') {
        responseText = await googleAIService.generateText(
          currentMessages, 
          model.id
        );
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? { 
                ...msg, 
                content: responseText, 
                isLoading: false 
              } 
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: `Error: ${error.message}`,
        isError: true,
        timestamp: new Date(),
        model: model.id,
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== loadingMessageId), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!input.trim()) return;
    
    if (provider.id !== 'rapidapi') {
      const now = Date.now();
      const errorMessage: Message = {
        id: `error-${now}`,
        role: 'assistant',
        content: 'Please select the Image Generation provider to generate images.',
        timestamp: new Date(now),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const now = Date.now();
    const userMessage: Message = {
      id: `user-img-${now}`,
      role: 'user',
      content: `Image prompt: ${input}`,
      timestamp: new Date(now),
    };

    const isMidjourney = model.id.includes('midjourney');
    
    const loadingMessageId = `loading-img-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
      model: isMidjourney ? 'rapidapi/midjourney' : 'rapidapi/flux',
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);
    const currentInput = input;
    setInput('');

    try {
      let imageUrl: string;
      
      if (isMidjourney) {
        console.log('Generating Midjourney image with prompt:', currentInput);
        const result = await midjourneyService.generateImage(currentInput, {
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 30,
          upscale: true
        });
        imageUrl = result;
      } else {
        imageUrl = await imageGenerationService.generateImage(currentInput, {
          style_id: imageStyle,
          size: imageSize
        });
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? { 
                ...msg, 
                content: isMidjourney ? 'Generated Midjourney image:' : 'Generated image:', 
                images: [imageUrl],
                isLoading: false 
              } 
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error generating image:', error);
      const errorMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: `Sorry, I encountered an error generating the image: ${error.message}`,
        isError: true,
        timestamp: new Date(),
        model: isMidjourney ? 'rapidapi/midjourney' : 'rapidapi/flux',
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== loadingMessageId), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewCode = (files: { code: string; language: string }[]) => {
    setWorkspaceFiles(files);
    setShowWorkspace(true);
    setExecutionState({ isRunning: false, output: '' });
  };

  const handleRunCode = async (code: string, language: string, input: string = '') => {
    try {
      setExecutionState({ isRunning: true, output: 'Running code...' });
      
      const lang = detectLanguage(code, language);
      console.log(`Detected language: ${lang.name} (ID: ${lang.id})`);
      
      let processedCode = code;
      
      if (lang.id === 62) {
        if (!code.includes('public class Main')) {
          const className = code.match(/class\s+(\w+)/)?.[1] || 'Main';
          processedCode = `public class ${className} {
    public static void main(String[] args) {
${code.split('\n').map(line => `        ${line}`).join('\n')}
    }
}`;
        }
      } else if (lang.id === 71 || lang.id === 70) {
        processedCode = code.replace(/print\s+(?![(])/g, 'print(') + '\n';
      }
      
      console.log('Executing code with language:', lang.name);
      
      const result = await CodeExecutionService.executeCode(processedCode, lang.id, input);
      
      let output = '';
      if (input) output += `Input:\n${input}\n\n`;
      if (result.stdout) output += `Output:\n${result.stdout}\n\n`;
      if (result.stderr) output += `Error:\n${result.stderr}\n\n`;
      if (result.compile_output) output += `Compile Output:\n${result.compile_output}\n\n`;
      if (result.message) output += `Message: ${result.message}\n`;
      
      if (!output.trim()) {
        output = 'Code executed successfully with no output';
      }
      
      setExecutionState({
        isRunning: false,
        output: output.trim()
      });
      
    } catch (error) {
      console.error('Execution error:', error);
      let errorMessage = 'Failed to execute code';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('timeout') || errorMessage.includes('Time limit exceeded')) {
          errorMessage = 'Execution timed out. Your code took too long to run.';
        } else if (errorMessage.includes('memory') || errorMessage.includes('Memory limit exceeded')) {
          errorMessage = 'Memory limit exceeded. Your code used too much memory.';
        } else if (errorMessage.includes('NZEC')) {
          errorMessage = 'Runtime error. Your code exited with an error. Check for syntax errors or unhandled exceptions.';
        } else if (errorMessage.includes('compilation error')) {
          errorMessage = 'Compilation error. Please check your code for syntax errors.';
        }
      }
      
      setExecutionState({
        isRunning: false,
        output: `Error: ${errorMessage}\n\nIf you need help, try:\n- Checking for syntax errors\n- Adding print statements for debugging\n- Making sure all variables are defined\n- Verifying input/output formats`
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden main-container">
      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">AI Chat</h1>
            <div className="flex items-center space-x-3">
              <ProviderSelector
                providers={PROVIDERS}
                currentProvider={provider}
                onProviderChange={handleProviderChange}
              />
              <ModelSelector
                models={provider.models}
                currentModel={model}
                onModelChange={handleModelChange}
              />
              {provider.id === 'rapidapi' && model.id === 'rapidapi-flux' && (
                <ImageStyleSelector
                  onSelect={(styleId: number, size: string) => {
                    setImageStyle(styleId);
                    setImageSize(size);
                  }}
                  selectedStyle={imageStyle}
                  selectedSize={imageSize}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onViewCode={handleViewCode} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* File Upload Area */}
      {showFileUpload && (
        <div className="border-t border-gray-700 bg-gray-800/95 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto p-4">
            <FileUpload
              onFilesUploaded={handleFilesUploaded}
              onClose={() => setShowFileUpload(false)}
              maxFiles={5}
              maxSizeInMB={10}
              acceptedTypes={['image/*', 'text/*', '.pdf', '.doc', '.docx', '.json', '.csv', '.md', '.js', '.ts', '.py', '.java', '.cpp', '.c']}
            />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-900/95">
        {/* Show uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-2 bg-gray-800 px-3 py-2 rounded-full text-sm border border-gray-600"
                >
                  {file.preview && (
                    <div className="w-6 h-6 rounded-full overflow-hidden">
                      <img src={file.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-gray-300 truncate max-w-32">{file.name}</span>
                  <button
                    onClick={() => setUploadedFiles(files => files.filter(f => f.id !== file.id))}
                    className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-red-500/10 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center max-w-4xl mx-auto">
          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`p-3 rounded-l-lg border border-gray-700 border-r-0 transition-all duration-200 ${
              showFileUpload || uploadedFiles.length > 0
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="Upload files"
          >
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={provider.id === 'rapidapi' ? 'Describe the image you want to generate...' : 'Type a message...'}
            className="flex-1 p-3 bg-gray-800 border border-gray-700 border-l-0 border-r-0 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            disabled={isLoading || isSearching}
          />
          <button
            onClick={handleWebSearch}
            disabled={isLoading || isSearching || !input.trim()}
            className="p-3 bg-green-600 text-white border border-gray-700 border-l-0 border-r-0 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
            title="Search the web"
          >
            <Search size={20} />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={isLoading || isSearching || (!input.trim() && uploadedFiles.length === 0)}
            className="p-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
            title="Send message"
          >
            {provider.id === 'rapidapi' ? <ImageIcon size={20} /> : <Send size={20} />}
          </button>
        </div>
      </div>

      {showWorkspace && workspaceFiles && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 p-4 flex items-center justify-center">
          <div className="h-full w-full max-w-6xl bg-gray-800 rounded-lg overflow-hidden flex flex-col shadow-2xl">
            <MainWorkspace 
              files={workspaceFiles}
              onClose={() => setShowWorkspace(false)}
              onRunCode={handleRunCode}
              executionState={executionState}
              isVisible={showWorkspace}
            />
          </div>
        </div>
      )}
    </div>
  );
};