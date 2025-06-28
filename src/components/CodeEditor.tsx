import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeEditorProps {
  code: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language,
  onChange,
  readOnly = false,
}) => {
  return (
    <div className="h-full overflow-auto">
      {readOnly ? (
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            height: '100%',
            fontSize: '0.875rem',
          }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <textarea
          value={code}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full h-full p-4 font-mono text-sm bg-transparent text-gray-200 outline-none resize-none"
          spellCheck={false}
        />
      )}
    </div>
  );
};
