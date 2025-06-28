export interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
}

export interface SupportedLanguage {
  id: number;
  name: string;
  ext: string;
  aliases: string[];
}

// API Configuration
const JUDGE0_RAPID_API_KEY = import.meta.env.VITE_JUDGE0_RAPID_API_KEY || '';
if (!JUDGE0_RAPID_API_KEY) {
  console.warn('Judge0 RapidAPI key is not set. Code execution will not work. Please set VITE_JUDGE0_RAPID_API_KEY in your .env file');
}
const JUDGE0_RAPID_API_HOST = 'judge0-ce.p.rapidapi.com';
const SUBMISSION_URL = `https://${JUDGE0_RAPID_API_HOST}/submissions`;

export class CodeExecutionService {
  static async executeCode(
    sourceCode: string, 
    languageId: number, 
    input: string = ''
  ): Promise<ExecutionResult> {
    try {
      // Prepare the request body
      const requestBody: any = {
        source_code: btoa(unescape(encodeURIComponent(sourceCode))),
        language_id: languageId,
        wait: true,
        base64_encoded: true,
        // Set reasonable time and memory limits
        cpu_time_limit: 10, // 10 seconds
        wall_time_limit: 15, // 15 seconds
        memory_limit: 256000, // 256MB
        max_file_size: 4096, // 4KB max output
      };

      // Add input if provided
      if (input) {
        // Normalize line endings and ensure proper formatting
        const normalizedInput = input.replace(/\r\n/g, '\n').trim();
        
        // For Python, handle multiple inputs by adding newlines between them
        if (languageId === 71 || languageId === 70) { // Python
          // Split multiple inputs by commas or newlines
          const inputs = normalizedInput.split(/[,\n]/).map(i => i.trim()).filter(Boolean);
          requestBody.stdin = btoa(unescape(encodeURIComponent(inputs.join('\n') + '\n')));
        } 
        // For Java, C, C++ - ensure proper newline handling
        else if ([62, 50, 54].includes(languageId)) { // Java, C, C++
          const inputs = normalizedInput.split('\n').map(i => i.trim()).filter(Boolean);
          requestBody.stdin = btoa(unescape(encodeURIComponent(inputs.join('\n') + '\n')));
        }
        // For other languages, just use the input as is
        else {
          requestBody.stdin = btoa(unescape(encodeURIComponent(normalizedInput + '\n')));
        }
      }

      console.log('Sending request to Judge0 API with language ID:', languageId);
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(
        `https://${JUDGE0_RAPID_API_HOST}/submissions?base64_encoded=true&wait=true`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-rapidapi-key': JUDGE0_RAPID_API_KEY,
            'x-rapidapi-host': JUDGE0_RAPID_API_HOST,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Judge0 API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
      }

      const result = await response.json();
      console.log('Judge0 API Response:', JSON.stringify(result, null, 2));
      
      // Handle different statuses
      if (result.status && result.status.id > 3) { // Status 3 and below are successful
        const errorDetails = {
          status: result.status,
          stderr: result.stderr ? this.safeDecode(result.stderr) : null,
          compile_output: result.compile_output ? this.safeDecode(result.compile_output) : null,
          message: result.message || 'No additional error information',
        };
        console.error('Execution failed with details:', errorDetails);
        throw new Error(`Execution failed (${result.status.description}): ${
          errorDetails.stderr || errorDetails.compile_output || errorDetails.message
        }`);
      }
      
      const decodedResult: ExecutionResult = {
        ...result,
        stdout: result.stdout ? this.safeDecode(result.stdout) : null,
        stderr: result.stderr ? this.safeDecode(result.stderr) : null,
        compile_output: result.compile_output ? this.safeDecode(result.compile_output) : null,
        message: result.message || null,
      };

      return decodedResult;
    } catch (error) {
      console.error('Code execution error:', error);
      throw new Error(`Failed to execute code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static safeDecode(base64: string): string {
    try {
      return atob(base64);
    } catch (error) {
      console.warn('Failed to decode base64 string, returning as is');
      return base64;
    }
  }
}

export const detectLanguage = (code: string, languageHint: string = ''): SupportedLanguage => {
  // First try to match by the provided language hint
  if (languageHint) {
    const hint = languageHint.toLowerCase().trim();
    const matchedByHint = SUPPORTED_LANGUAGES.find(lang => 
      lang.aliases.some(alias => alias.toLowerCase() === hint)
    );
    
    if (matchedByHint) {
      return matchedByHint;
    }
  }
  
  // If no match by hint, try to detect by code content
  const trimmedCode = code.trim();
  
  // Detect Python
  if (trimmedCode.startsWith('def ') || 
      trimmedCode.startsWith('import ') || 
      trimmedCode.startsWith('print(') ||
      trimmedCode.startsWith('class ')) {
    return SUPPORTED_LANGUAGES.find(lang => lang.id === 71)!; // Python 3
  }
  
  // Detect JavaScript/TypeScript
  if (trimmedCode.includes('function') || 
      trimmedCode.includes('const ') || 
      trimmedCode.includes('let ') ||
      trimmedCode.includes('console.log')) {
    return SUPPORTED_LANGUAGES.find(lang => lang.id === 93)!; // Node.js
  }
  
  // Default to JavaScript (Node.js) as it's the most common case
  return SUPPORTED_LANGUAGES.find(lang => lang.id === 93)!;
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  // JavaScript/Node.js
  { id: 93, name: 'JavaScript (Node.js 18.15.0)', ext: 'js', aliases: ['javascript', 'js', 'node', 'nodejs', 'node.js'] },
  
  // Python
  { id: 71, name: 'Python (3.10.0)', ext: 'py', aliases: ['python', 'py', 'python3'] },
  { id: 70, name: 'Python (2.7.18)', ext: 'py', aliases: ['python2', 'py2'] },
  
  // TypeScript
  { id: 74, name: 'TypeScript', ext: 'ts', aliases: ['typescript', 'ts'] },
  
  // Java
  { id: 62, name: 'Java', ext: 'java', aliases: ['java'] },
  
  // C#
  { id: 51, name: 'C#', ext: 'cs', aliases: ['csharp', 'cs'] },
  
  // C/C++
  { id: 54, name: 'C++', ext: 'cpp', aliases: ['cpp', 'c++'] },
  { id: 50, name: 'C', ext: 'c', aliases: ['c'] },
  
  // Scripting
  { id: 1, name: 'Bash', ext: 'sh', aliases: ['bash', 'sh', 'shell'] },
  { id: 60, name: 'Shell', ext: 'sh', aliases: ['shell', 'bash', 'sh'] },
  
  // Web
  { id: 63, name: 'JavaScript', ext: 'js', aliases: ['javascript', 'js'] },
  
  // Databases
  { id: 82, name: 'SQL', ext: 'sql', aliases: ['sql'] },
  
  // Mobile
  { id: 78, name: 'Kotlin', ext: 'kt', aliases: ['kotlin', 'kt'] },
  { id: 83, name: 'Swift', ext: 'swift', aliases: ['swift'] },
  
  // Other
  { id: 68, name: 'PHP', ext: 'php', aliases: ['php'] },
  { id: 73, name: 'Rust', ext: 'rs', aliases: ['rust', 'rs'] },
  { id: 72, name: 'Ruby', ext: 'rb', aliases: ['ruby', 'rb'] },
];


