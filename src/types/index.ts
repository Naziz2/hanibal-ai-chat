export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  model?: string;
  provider?: string;
  type?: 'text' | 'image';
  isLoading?: boolean;
  isError?: boolean;
  error?: string;
  images?: string[];
}

export interface Model {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'image';
  provider: string;
  endpoint?: string;
  requestFormat?: 'inputs' | 'prompt';
  defaultOptions?: Record<string, any>;
}

export interface Provider {
  id: string;
  name: string;
  status: 'active' | 'limited' | 'error';
  models: Model[];
}

export interface ChatState {
  messages: Message[];
  currentModel: Model;
  currentProvider: Provider;
  isLoading: boolean;
}