import axios, { AxiosError } from 'axios';

interface ImageGenerationOptions {
  style_id?: number;
  size?: string;
}

export class ImageGenerationService {
  private readonly RAPIDAPI_KEY = '09680219a5msh5b8b6c8ba358d17p18d7a9jsn6a9f75eca5dd';
  
  // FLUX API endpoints
  private readonly FLUX_API_URL = 'https://ai-text-to-image-generator-flux-free-api.p.rapidapi.com/aaaaaaaaaaaaaaaaaiimagegenerator/quick.php';
  private readonly FLUX_API_HOST = 'ai-text-to-image-generator-flux-free-api.p.rapidapi.com';
  
  private readonly axiosInstance = axios.create({
    baseURL: '',
    headers: {
      'x-rapidapi-key': this.RAPIDAPI_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 60000, // 60 seconds timeout
  });

  /**
   * Generate an image from a text prompt
   * @param prompt The text prompt to generate an image from
   * @param options Additional options for image generation
   * @returns Promise that resolves to the URL of the generated image
   */
  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<string> {
    const requestData = {
      prompt,
      style_id: 2,
      size: '1-1',
      ...options
    };

    try {
      const response = await this.axiosInstance({
        method: 'post',
        url: this.FLUX_API_URL,
        headers: {
          'x-rapidapi-host': this.FLUX_API_HOST
        },
        data: requestData,
      });

      const responseData = response.data;
      console.log('API Response:', responseData);

      // Handle different response formats
      let imageUrl: string | null = null;

      // Handle the new response format with final_result array
      if (responseData.final_result && Array.isArray(responseData.final_result) && responseData.final_result.length > 0) {
        imageUrl = responseData.final_result[0]?.origin || responseData.final_result[0]?.url;
      } 
      // Fallback to other possible response formats
      else {
        imageUrl = responseData.url || responseData.data?.url || responseData.imageUrl || responseData.result;
      }

      // If we still don't have a URL but the response is a string that looks like a URL
      if (!imageUrl && typeof responseData === 'string') {
        const potentialUrl = responseData.trim();
        if (potentialUrl.startsWith('http') || potentialUrl.startsWith('data:image')) {
          imageUrl = potentialUrl;
        }
      }

      if (!imageUrl) {
        console.error('Unexpected API response format:', responseData);
        throw new Error('Could not extract image URL from the response');
      }

      return imageUrl;
    } catch (error) {
      console.error('Image generation error:', error);
      
      // Handle Axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.error('API Error Response:', {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data,
          });
          throw new Error(`API request failed with status ${axiosError.response.status}: ${axiosError.response.statusText}`);
        } else if (axiosError.request) {
          console.error('No response received:', axiosError.request);
          throw new Error('No response received from the server');
        }
      }
      
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
    /**
     * Generate multiple images from a text prompt
     * @param prompt The text prompt to generate images from
     * @param count Number of images to generate (max 4)
     * @param options Additional options for image generation
     * @returns Promise that resolves to an array of image URLs
     */
    async generateMultipleImages(prompt: string, count: number = 1, options: ImageGenerationOptions = {}): Promise<string[]> {
      const maxCount = Math.min(Math.max(1, count), 4); // Limit to max 4 images
      const generations = [];
  
      for (let i = 0; i < maxCount; i++) {
        try {
          const imageUrl = await this.generateImage(prompt, options);
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
  