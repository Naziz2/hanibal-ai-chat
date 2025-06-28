import React, { useState, useEffect, useCallback } from 'react';
import { X, Download } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Define the FileData interface
interface FileData {
  code: string;
  language: string;
  name?: string;
}

// Define the CodeEditor component props
interface CodeEditorProps {
  code: string;
  language: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
}

// Simple CodeEditor component implementation
const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language, // Now properly used in the textarea's className
  onChange,
  readOnly = false,
}) => {
  return (
    <div className="h-full overflow-auto">
      {readOnly ? (
        <pre className="whitespace-pre-wrap p-4 font-mono text-sm">
          {code}
        </pre>
      ) : (
        <textarea
          value={code}
          onChange={(e) => onChange?.(e.target.value)}
          className={`w-full h-full p-4 font-mono text-sm bg-transparent text-gray-200 outline-none resize-none language-${language || 'plaintext'}`}
          spellCheck={false}
          data-language={language || 'plaintext'}
        />
      )}
    </div>
  );
};

type ExecutionState = {
  isRunning: boolean;
  output: string;
};

interface MainWorkspaceProps {
  files: FileData[];
  onClose: () => void;
  onRunCode: (code: string, language: string, input?: string) => Promise<void>;
  executionState: ExecutionState;
  isVisible: boolean;
}

export const MainWorkspace: React.FC<MainWorkspaceProps> = ({
  files,
  onClose,
  onRunCode,
  isVisible,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionState
}) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  // Use the executionState from props if provided, otherwise use default values
  const [localExecutionState, setLocalExecutionState] = useState<ExecutionState>({
    isRunning: executionState?.isRunning ?? false,
    output: executionState?.output ?? ''
  });

  // Update local state when executionState prop changes
  useEffect(() => {
    if (executionState) {
      setLocalExecutionState(prev => ({
        ...prev,
        ...executionState,
      }));
    }
  }, [executionState]);

  const handleRunCode = useCallback(async (code: string, language: string) => {
    // Use the language parameter by passing it to onRunCode
    try {
      // Check if code contains input-related functions
      const needsInput = code.includes('input(') ||
        code.includes('readline(') ||
        code.includes('readLine(') ||
        code.includes('cin >>') ||
        code.includes('scanf(') ||
        code.includes('nextInt(') ||
        code.includes('nextLine(') ||
        code.includes('next(');

      // If code needs input but none is provided, show a message
      if (needsInput && !input.trim()) {
        setLocalExecutionState({
          isRunning: false,
          output: 'This code needs input. Please provide the required input in the input box above.'
        });
        setIsInputExpanded(true);
        return;
      }

      // Show running state
      setLocalExecutionState({ 
        isRunning: true, 
        output: 'Executing code...' 
      });

      // Execute the code with the language parameter
      await onRunCode(code, language, input);

    } catch (error) {
      console.error('Error running code:', error);
      setLocalExecutionState({
        isRunning: false,
        output: `Error: ${error instanceof Error ? error.message : 'Failed to run code'}\n\n` +
          'Common issues:\n' +
          '- Make sure all required inputs are provided\n' +
          '- Check for syntax errors in your code\n' +
          '- Verify input format matches what your code expects',
      });
    }
  }, [input, onRunCode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      const currentFile = files[activeTabIndex];
      if (currentFile) {
        handleRunCode(currentFile.code, currentFile.language || '');
      }
    }
  }, [activeTabIndex, files, handleRunCode]);

  // Auto-detect if input might be needed
  useEffect(() => {
    const currentFile = files[activeTabIndex];
    if (currentFile?.code) {
      const needsInput = currentFile.code.includes('input(') ||
                      currentFile.code.includes('readline(') ||
                      currentFile.code.includes('readLine(') ||
                      currentFile.code.includes('cin >>') ||
                      currentFile.code.includes('scanf(');
      if (needsInput) {
        setIsInputExpanded(true);
      }
    }
  }, [activeTabIndex, files]);

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    files.forEach((file: FileData, index: number) => {
      const extension = file.language || 'txt';
      zip.file(`code_${index + 1}.${extension}`, file.code);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'code_files.zip');
  };

  if (!isVisible) return null;

  const currentFile = files[activeTabIndex];
  if (!currentFile) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="code-runner-container" style={{ width: '90%', height: '90vh' }}>
        <div className="code-tabs">
          {files.map((currentFile, index) => (
            <div
              key={index}
              onClick={() => setActiveTabIndex(index)}
              className={`code-tab ${activeTabIndex === index ? 'active' : ''}`}
            >
              {`File ${index + 1}${currentFile.language ? `.${currentFile.language}` : ''}`}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="code-content">
          <CodeEditor
            code={currentFile.code}
            language={currentFile.language || 'text'}
            readOnly={true}
          />
        </div>

        <div className="input-output-container">
          <div className="input-section">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-300">Input</span>
                <span className="ml-2 text-xs text-yellow-400">
                  {currentFile.code && (
                    currentFile.code.includes('input(') ||
                    currentFile.code.includes('readline(') ||
                    currentFile.code.includes('readLine(') ||
                    currentFile.code.includes('cin >>') ||
                    currentFile.code.includes('scanf(') ||
                    currentFile.code.includes('nextInt(') ||
                    currentFile.code.includes('nextLine(') ||
                    currentFile.code.includes('next(')
                  ) ? 'Required (separate multiple inputs with commas or newlines)' : 'Optional'}
                </span>
              </div>
              <button
                onClick={() => setIsInputExpanded(!isInputExpanded)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {isInputExpanded ? 'Hide' : 'Show'} input
              </button>
            </div>
            {isInputExpanded && (
              <div className="relative">
                <div className="w-full space-y-1">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      currentFile.code && (
                        currentFile.code.includes('input(') ||
                        currentFile.code.includes('readline(') ||
                        currentFile.code.includes('readLine(') ||
                        currentFile.code.includes('cin >>') ||
                        currentFile.code.includes('scanf(') ||
                        currentFile.code.includes('nextInt(') ||
                        currentFile.code.includes('nextLine(') ||
                        currentFile.code.includes('next(')
                      ) ? 'Enter input values (separate multiple values with commas or newlines)' : 'Enter input for your code (if needed)'
                    }
                    className="w-full p-2 text-sm font-mono bg-gray-800 text-white border border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    spellCheck={false}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="text-xs text-gray-500">
                    {currentFile.code && (
                      currentFile.code.includes('input(') ||
                      currentFile.code.includes('readline(') ||
                      currentFile.code.includes('readLine(') ||
                      currentFile.code.includes('cin >>') ||
                      currentFile.code.includes('scanf(')
                    ) ? 'Example: 42, hello, 3.14' : 'Enter each input on a new line or separate with commas'}
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                  Press Ctrl+Enter to run
                </div>
              </div>
            )}
          </div>

          <div className="output-section">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">Output</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleRunCode(currentFile.code, currentFile.language || '')}
                  disabled={localExecutionState.isRunning}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{localExecutionState.isRunning ? 'Running...' : 'Run'}</span>
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center space-x-1.5"
                >
                  <Download size={16} />
                  <span>Download All</span>
                </button>
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded-md overflow-auto max-h-60">
              {localExecutionState.output ? (
                <pre className={`text-sm font-mono whitespace-pre-wrap break-words ${
                  localExecutionState.output.startsWith('Error:') ? 'text-red-400' : 'text-gray-300'
                }`}>
                  {localExecutionState.output}
                </pre>
              ) : (
                <div className="text-gray-500 italic">
                  No output yet. Click "Run" to execute the code.
                </div>
              )}
              {localExecutionState.isRunning && (
                <div className="mt-2 flex items-center text-blue-400 text-sm">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Executing code...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
