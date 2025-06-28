import { Provider, Model } from '../types';

export const OPENROUTER_MODELS: Model[] = [
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct:free',
    name: 'Mistral Small 3.2',
    description: 'Mistral Small 3.2 24B Instruct',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B',
    description: 'Google Gemma 3 27B IT',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    description: 'Google Gemini Flash 1.5',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'moonshotai/kimi-dev-72b:free',
    name: 'Kimi Dev 72B',
    description: 'Moonshot AI Kimi Dev 72B',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'deepseek/deepseek-r1-0528:free',
    name: 'DeepSeek R1',
    description: 'DeepSeek R1 0528',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'sarvamai/sarvam-m:free',
    name: 'Sarvam M',
    description: 'Sarvam AI Sarvam M',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'microsoft/phi-4-reasoning-plus:free',
    name: 'Phi-4 Reasoning Plus',
    description: 'Microsoft Phi-4 Reasoning Plus',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'qwen/qwen3-30b-a3b:free',
    name: 'Qwen 3 30B',
    description: 'Qwen 3 30B A3B',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'featherless/qwerky-72b:free',
    name: 'Qwerky 72B',
    description: 'Featherless Qwerky 72B',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'qwen/qwen2.5-vl-72b-instruct:free',
    name: 'Qwen 2.5 Vision',
    description: 'Qwen 2.5 VL 72B Instruct',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1:free',
    name: 'Llama 3.3 Nemotron',
    description: 'NVIDIA Llama 3.3 Nemotron Super 49B',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'thudm/glm-z1-32b:free',
    name: 'GLM-Z1 32B',
    description: 'THUDM GLM-Z1 32B',
    type: 'text',
    provider: 'openrouter'
  },
  {
    id: 'tngtech/deepseek-r1t-chimera:free',
    name: 'DeepSeek R1T Chimera',
    description: 'TNG Tech DeepSeek R1T Chimera',
    type: 'text',
    provider: 'openrouter'
  }
];

export const GOOGLE_MODELS: Model[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google Gemini 2.5 Flash (Default)',
    type: 'text',
    provider: 'google'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Google Gemini 1.5 Flash',
    type: 'text',
    provider: 'google'
  }
];

export const IMAGE_GENERATION_MODELS: Model[] = [
  {
    id: 'rapidapi-flux',
    name: 'FLUX Image',
    description: 'AI Image Generation with FLUX',
    type: 'image',
    provider: 'rapidapi'
  },
  {
    id: 'rapidapi-midjourney',
    name: 'Midjourney Style',
    description: 'AI Image Generation with Midjourney style',
    type: 'image',
    provider: 'rapidapi'
  }
];

export const PROVIDERS: Provider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    status: 'limited',
    models: OPENROUTER_MODELS
  },
  {
    id: 'google',
    name: 'Google AI',
    status: 'active',
    models: GOOGLE_MODELS
  },
  {
    id: 'rapidapi',
    name: 'Image Generation',
    status: 'active',
    models: IMAGE_GENERATION_MODELS
  }
];

export const DEFAULT_PROVIDER = PROVIDERS[0];
export const DEFAULT_MODEL = OPENROUTER_MODELS[0];