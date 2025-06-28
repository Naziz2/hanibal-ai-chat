import React from 'react';
import { ExecutionResult } from '../services/CodeExecutionService';
import { CheckCircle, XCircle, Clock, Terminal, AlertTriangle } from 'lucide-react';

interface CodeExecutionProps {
  result: ExecutionResult | null;
  isLoading: boolean;
  onClose: () => void;
}

export const CodeExecution: React.FC<CodeExecutionProps> = ({ result, isLoading, onClose }) => {
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center text-yellow-400">
          <Clock className="animate-spin mr-2" size={16} />
          <span>Executing...</span>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isError = result.status.description !== 'Accepted';

  return (
    <div className={`p-4 rounded-lg ${isError ? 'bg-red-900/20' : 'bg-green-900/20'}`}>
      <div className="flex justify-between items-center mb-2">
        <div className={`flex items-center font-semibold ${isError ? 'text-red-400' : 'text-green-400'}`}>
          {isError ? <XCircle size={18} className="mr-2" /> : <CheckCircle size={18} className="mr-2" />}
          Status: {result.status.description}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      {result.stdout && (
        <div className="mt-2">
          <h4 className="font-semibold text-sm flex items-center"><Terminal size={14} className="mr-2" />Output:</h4>
          <pre className="bg-black/30 p-2 mt-1 rounded text-sm font-mono whitespace-pre-wrap">{result.stdout}</pre>
        </div>
      )}

      {result.stderr && (
        <div className="mt-2">
          <h4 className="font-semibold text-sm flex items-center text-red-400"><AlertTriangle size={14} className="mr-2" />Error:</h4>
          <pre className="bg-black/30 p-2 mt-1 rounded text-sm font-mono whitespace-pre-wrap">{result.stderr}</pre>
        </div>
      )}

      {result.compile_output && (
        <div className="mt-2">
          <h4 className="font-semibold text-sm flex items-center text-yellow-400"><AlertTriangle size={14} className="mr-2" />Compiler Output:</h4>
          <pre className="bg-black/30 p-2 mt-1 rounded text-sm font-mono whitespace-pre-wrap">{result.compile_output}</pre>
        </div>
      )}
    </div>
  );
};
