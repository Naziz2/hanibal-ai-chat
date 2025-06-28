import axios, { AxiosError } from 'axios';

export interface MidjourneyStyleOptions {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  samples?: number;
  num_inference_steps?: number;
  safety_checker?: boolean;
  enhance_prompt?: boolean;
  seed?: number | null;
  guidance_scale?: number;
  multi_lingual?: boolean;
  panorama?: boolean;
  self_attention?: boolean;
  upscale?: boolean;
  embeddings_model?: string | null;
  lora_model?: string | null;
  tomesd?: boolean;
  use_karras_sigmas?: boolean;
  vae?: string | null;
  lora_strength?: number | null;
  scheduler?: string;
  safety_checker_type?: string;
}

export class MidjourneyService {
  private readonly RAPIDAPI_KEY = '09680219a5msh5b8b6c8ba358d17p18d7a9jsn6a9f75eca5dd';
  private readonly MIDJOURNEY_API_URL = 'https://midjourney-sd-text-to-image-uncensored.p.rapidapi.com/midjourney';
  private readonly MIDJOURNEY_API_HOST = 'midjourney-sd-text-to-image-uncensored.p.rapidapi.com';
  
  private readonly axiosInstance = axios.create({
    baseURL: '',
    headers: {
      'x-rapidapi-key': this.RAPIDAPI_KEY,
      'x-rapidapi-host': this.MIDJOURNEY_API_HOST,
      'Content-Type': 'application/json',
    },
    timeout: 120000, // 120 seconds timeout
  });

  /**
   * Generate an image using Midjourney-style generation
   * @param prompt The text prompt to generate an image from
   * @param options Additional options for image generation
   * @returns Promise that resolves to the generated image data
   */
  async generateImage(
    prompt: string, 
    options: Omit<MidjourneyStyleOptions, 'prompt'> = {}
  ): Promise<string> {
    const requestData: MidjourneyStyleOptions = {
      prompt,
      negative_prompt: '',
      width: 1024,
      height: 1024,
      samples: 1,
      num_inference_steps: 21,
      safety_checker: false,
      enhance_prompt: true,
      seed: null,
      guidance_scale: 7.5,
      multi_lingual: false,
      panorama: false,
      self_attention: false,
      upscale: false,
      embeddings_model: null,
      lora_model: null,
      tomesd: true,
      use_karras_sigmas: false,
      vae: null,
      lora_strength: null,
      scheduler: 'DPMSolverMultistepScheduler',
      safety_checker_type: 'blip',
      ...options
    };

    try {
      const response = await this.axiosInstance({
        method: 'post',
        url: this.MIDJOURNEY_API_URL,
        data: requestData
      });

      console.log('Midjourney API Response:', response.data);
      
      // Handle the response - adjust based on actual API response structure
      const result = response.data;
      
      // If the response contains image data directly
      if (result.images && Array.isArray(result.images)) {
        return result.images[0];
      }
      
      // If the response is a direct URL
      if (typeof result === 'string' && (result.startsWith('http') || result.startsWith('data:image'))) {
        return result;
      }
      
      // If the response contains a URL in a nested structure
      if (result.url || result.imageUrl) {
        return result.url || result.imageUrl;
      }
      
      // If we get here, return the full response as a fallback
      return JSON.stringify(result);
      
    } catch (error) {
      console.error('Midjourney style generation error:', error);
      
      // Handle Axios errors specifically
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.error('Midjourney API Error:', {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data,
          });
          throw new Error(`Midjourney API error: ${axiosError.response.status} - ${axiosError.response.statusText}`);
        } else if (axiosError.request) {
          console.error('No response from Midjourney API:', axiosError.request);
          throw new Error('No response received from Midjourney API');
        }
      }
      
      throw new Error(`Failed to generate Midjourney style image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple images with the same prompt
   * @param prompt The text prompt to generate images from
   * @param count Number of images to generate (max 4)
   * @param options Additional options for image generation
   * @returns Promise that resolves to an array of generated image URLs
   */
  async generateMultipleImages(
    prompt: string,
    count: number = 1,
    options: Omit<MidjourneyStyleOptions, 'prompt'> = {}
  ): Promise<string[]> {
    const maxCount = Math.min(Math.max(1, count), 4); // Limit to max 4 images
    const generations: string[] = [];
    
    for (let i = 0; i < maxCount; i++) {
      try {
        const imageUrl = await this.generateImage(prompt, {
          ...options,
          seed: options.seed ? (options.seed as number) + i : null // Use different seeds for variation
        });
        generations.push(imageUrl);
      } catch (error) {
        console.error(`Error generating image ${i + 1}:`, error);
        // Continue with other generations even if one fails
      }
    }
    
    if (generations.length === 0) {
      throw new Error('Failed to generate any images');
    }
    
    return generations;
  }
}
