import React, { useState, useEffect, useRef } from 'react';
import { Message, Model, Provider } from '../types';

import { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL } from '../config/models';
import { CodeExecutionService, detectLanguage } from '../services/CodeExecutionService';
import { GoogleGenAIService } from '../services/GoogleGenAIService';
import { OpenRouterService } from '../services/OpenRouterService';
import { ImageGenerationService } from '../services/ImageGenerationService';
import { MidjourneyService } from '../services/MidjourneyService';
import { FileAnalysisService } from '../services/FileAnalysisService';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';
import { ProviderSelector } from './ProviderSelector';
import { WelcomeScreen } from './WelcomeScreen';
import { FileUpload } from './FileUpload';
import { Send, Image as ImageIcon, Paperclip, X, Brain, FileText } from 'lucide-react';
import { MainWorkspace } from './MainWorkspace';
import ImageStyleSelector from './ImageStyleSelector';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
  analysis?: string;
  uploadedFile?: { uri: string; mimeType: string; name: string };
  isAnalyzed?: boolean;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openRouterService = useRef(new OpenRouterService()).current;
  const googleAIService = useRef(new GoogleGenAIService()).current;
  const imageGenerationService = useRef(new ImageGenerationService()).current;
  const midjourneyService = useRef(new MidjourneyService()).current;
  const fileAnalysisService = useRef<FileAnalysisService | null>(null);

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
    // Just store the files without analyzing them - analysis happens only when sending
    setUploadedFiles(files);
  };

  const analyzeFilesInConversation = async (files: UploadedFile[]): Promise<UploadedFile[]> => {
    if (!fileAnalysisService.current || files.length === 0 || analysisInProgress) {
      return files;
    }

    // Check if any files need analysis
    const filesToAnalyze = files.filter(file => !file.isAnalyzed && !file.analysis);
    if (filesToAnalyze.length === 0) {
      return files;
    }

    setAnalysisInProgress(true);
    setIsAnalyzing(true);

    // Add analysis message to conversation
    const analysisMessageId = `analysis-${Date.now()}`;
    const analysisMessage: Message = {
      id: analysisMessageId,
      role: 'assistant',
      content: `🧠 **Analyzing Files**\n\nI'm analyzing ${filesToAnalyze.length} file${filesToAnalyze.length > 1 ? 's' : ''} to better understand their content...\n\n${filesToAnalyze.map((f, i) => `${i + 1}. 📄 **${f.name}** (${f.type}, ${formatFileSize(f.size)})`).join('\n')}`,
      isLoading: true,
      timestamp: new Date(),
      model: 'file-analysis',
    };
    
    setMessages(prev => [...prev, analysisMessage]);

    const analyzedFiles: UploadedFile[] = [...files];
    let analysisResults = '';

    try {
      for (const file of filesToAnalyze) {
        try {
          // Convert UploadedFile back to File object for analysis
          const fileBlob = file.content.startsWith('data:') 
            ? await fetch(file.content).then(r => r.blob())
            : new Blob([file.content], { type: file.type });
          
          const fileObj = new File([fileBlob], file.name, { type: file.type });
          
          const result = await fileAnalysisService.current.analyzeFile(fileObj);
          
          const formattedAnalysis = `📄 **${file.name}** (${file.type}, ${formatFileSize(file.size)})

${result.analysis}

---`;

          // Update the file in the analyzedFiles array
          const fileIndex = analyzedFiles.findIndex(f => f.id === file.id);
          if (fileIndex !== -1) {
            analyzedFiles[fileIndex] = {
              ...analyzedFiles[fileIndex],
              analysis: formattedAnalysis,
              uploadedFile: result.uploadedFile,
              isAnalyzed: true
            };
          }

          analysisResults += `\n\n${formattedAnalysis}\n`;

        } catch (error) {
          console.error(`Error analyzing file ${file.name}:`, error);
          
          const errorAnalysis = `📄 **${file.name}** (${file.type}, ${formatFileSize(file.size)})

❌ **Analysis Error:** ${error instanceof Error ? error.message : 'Unknown error occurred during analysis'}

**File Information:**
- Type: ${file.type || 'Unknown'}
- Size: ${formatFileSize(file.size)}

*Note: The file was uploaded but automatic analysis failed. You can still use this file in your conversation.*

---`;

          // Update the file in the analyzedFiles array
          const fileIndex = analyzedFiles.findIndex(f => f.id === file.id);
          if (fileIndex !== -1) {
            analyzedFiles[fileIndex] = {
              ...analyzedFiles[fileIndex],
              analysis: errorAnalysis,
              isAnalyzed: true
            };
          }

          analysisResults += `\n\n${errorAnalysis}\n`;
        }
      }

      // Update the analysis message with results
      const finalAnalysisContent = `🧠 **File Analysis Complete**

I've successfully analyzed ${filesToAnalyze.length} file${filesToAnalyze.length > 1 ? 's' : ''} and extracted detailed information about their content:

${analysisResults}

✅ **Ready for Conversation**
The files are now ready to be used in our conversation. You can ask me questions about their content, request modifications, or use them as context for further discussion.`;

      setMessages(prev => 
        prev.map(msg => 
          msg.id === analysisMessageId 
            ? { 
                ...msg, 
                content: finalAnalysisContent, 
                isLoading: false 
              } 
            : msg
        )
      );

    } catch (error) {
      console.error('Error during file analysis:', error);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === analysisMessageId 
            ? { 
                ...msg, 
                content: `❌ **File Analysis Failed**\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThe files have been uploaded but could not be analyzed. You can still use them in the conversation.`, 
                isLoading: false,
                isError: true
              } 
            : msg
        )
      );

      // Return original files if analysis fails
      return files;
    } finally {
      setIsAnalyzing(false);
      setAnalysisInProgress(false);
    }

    return analyzedFiles;
  };

  const formatFilesForMessage = (files: UploadedFile[]): string => {
    if (files.length === 0) return '';
    
    let filesText = '\n\n--- Uploaded Files ---\n';
    files.forEach((file, index) => {
      filesText += `\n${index + 1}. **${file.name}** (${file.type}, ${formatFileSize(file.size)})\n`;
      
      // Always include analysis if available, prioritizing it over raw content
      if (file.analysis) {
        filesText += `\n${file.analysis}\n\n`;
      } else {
        // For files without analysis, provide basic info
        if (file.type.startsWith('image/')) {
          filesText += `[Image file: ${file.name} - Please analyze this image and describe what you see in detail, including any text, objects, people, colors, composition, and other visual elements.]\n\n`;
        } else if (file.type.startsWith('text/') || 
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
        } else {
          filesText += `[File: ${file.name} - ${file.type}]\n`;
        }
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

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    if (provider.id === 'rapidapi') {
      handleGenerateImage();
      return;
    }

    const now = Date.now();
    let messageContent = input;
    
    // Create user message with file names instead of generic "files attached"
    const fileNames = uploadedFiles.length > 0 
      ? uploadedFiles.map(f => f.name).join(', ')
      : '';
    
    const userMessage: Message = {
      id: `user-${now}`,
      role: 'user',
      content: messageContent + (uploadedFiles.length > 0 ? `\n\n📎 **Files:** ${fileNames}` : ''),
      timestamp: new Date(now),
    };

    // Add user message to conversation immediately
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input and files immediately to prevent re-processing
    const currentInput = input;
    const currentFiles = [...uploadedFiles];
    setInput('');
    setUploadedFiles([]);

    // Only analyze files if they exist and haven't been analyzed yet
    let finalFiles = currentFiles;
    if (currentFiles.length > 0 && fileAnalysisService.current && !analysisInProgress) {
      // Check if files need analysis (don't have analysis property or isAnalyzed flag)
      const needsAnalysis = currentFiles.some(file => !file.isAnalyzed && !file.analysis);
      if (needsAnalysis) {
        finalFiles = await analyzeFilesInConversation(currentFiles);
      }
    }
    
    // Create loading message for AI response
    const loadingMessageId = `loading-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
      model: model.id,
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    setIsLoading(true);

    try {
      let responseText = '';
      
      // Check if we have files with Google AI uploads for direct file handling
      const filesWithUploads = finalFiles.filter(f => f.uploadedFile);
      
      if (filesWithUploads.length > 0 && provider.id === 'google') {
        // Use Google AI's file upload API for better handling
        responseText = await googleAIService.generateContentWithFiles(
          currentInput,
          filesWithUploads.map(f => f.uploadedFile!),
          model.id
        );
      } else {
        // For files without analysis or non-Google providers, include file information in message
        const fullMessageContent = currentInput + formatFilesForMessage(finalFiles);
        
        const recentMessages = messages.slice(-MAX_CONVERSATION_HISTORY_MESSAGES);
        const conversationHistory = recentMessages.map(msg => ({ 
          role: msg.role, 
          content: msg.content || '' 
        }));
        
        const currentMessages = [...conversationHistory, { role: 'user' as const, content: fullMessageContent }];
        
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
        content: `❌ Error: ${error.message}`,
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
        content: '❌ Please select the Image Generation provider to generate images.',
        timestamp: new Date(now),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const now = Date.now();
    const userMessage: Message = {
      id: `user-img-${now}`,
      role: 'user',
      content: `🎨 Image prompt: ${input}`,
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
                content: isMidjourney ? '🎨 Generated Midjourney image:' : '🎨 Generated image:', 
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
        content: `❌ Sorry, I encountered an error generating the image: ${error.message}`,
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
              acceptedTypes={['image/*', 'text/*', '.pdf', '.doc', '.docx', '.json', '.csv', '.md', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.mp3', '.mp4', '.wav']}
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
                  className="flex items-center space-x-2 bg-gray-800 px-3 py-2 rounded-full text-sm border border-gray-600 hover:border-gray-500 transition-colors"
                >
                  {file.preview ? (
                    <div className="w-6 h-6 rounded-full overflow-hidden">
                      <img src={file.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <FileText size={16} className="text-blue-400" />
                  )}
                  <span className="text-gray-300 truncate max-w-32" title={file.name}>
                    {file.name}
                  </span>
                  {file.isAnalyzed ? (
                    <div className="w-2 h-2 bg-green-400 rounded-full" title="Analyzed" />
                  ) : (
                    <div className="w-2 h-2 bg-purple-400 rounded-full" title="Ready for analysis" />
                  )}
                  <button
                    onClick={() => setUploadedFiles(files => files.filter(f => f.id !== file.id))}
                    className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-red-500/10 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-purple-400">
              <Brain size={12} />
              <span>
                {uploadedFiles.some(f => f.isAnalyzed) 
                  ? `${uploadedFiles.filter(f => f.isAnalyzed).length} of ${uploadedFiles.length} files analyzed`
                  : 'Files will be analyzed when you send your message'
                }
              </span>
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
            disabled={isLoading || isAnalyzing}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || isAnalyzing || (!input.trim() && uploadedFiles.length === 0)}
            className="p-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
            title={isAnalyzing ? "Analyzing files..." : provider.id === 'rapidapi' ? "Generate image" : "Send message"}
          >
            {isLoading || isAnalyzing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : provider.id === 'rapidapi' ? (
              <ImageIcon size={20} />
            ) : (
              <Send size={20} />
            )}
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