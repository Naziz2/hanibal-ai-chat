export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total_results?: number;
  search_time?: number;
  query?: string;
}

export class WebSearchService {
  private readonly RAPIDAPI_KEY = '09680219a5msh5b8b6c8ba358d17p18d7a9jsn6a9f75eca5dd';
  private readonly SEARCH_API_URL = 'https://real-time-web-search.p.rapidapi.com/search';
  private readonly SEARCH_API_HOST = 'real-time-web-search.p.rapidapi.com';

  /**
   * Perform a web search using RapidAPI
   * @param query The search query
   * @param options Additional search options
   * @returns Promise that resolves to search results
   */
  async search(query: string, options: {
    num?: number;
    start?: number;
    gl?: string;
    hl?: string;
  } = {}): Promise<SearchResponse> {
    try {
      const searchParams = new URLSearchParams({
        q: query,
        num: (options.num || 10).toString(),
        start: (options.start || 0).toString(),
        gl: options.gl || 'us',
        hl: options.hl || 'en'
      });

      const response = await fetch(`${this.SEARCH_API_URL}?${searchParams}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.RAPIDAPI_KEY,
          'x-rapidapi-host': this.SEARCH_API_HOST,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Search API request failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Search API Response:', data);

      // Handle different response formats
      let results: SearchResult[] = [];
      
      if (data.data && Array.isArray(data.data)) {
        results = data.data.map((item: any, index: number) => ({
          title: item.title || 'No title',
          url: item.url || item.link || '#',
          snippet: item.snippet || item.description || 'No description available',
          position: index + 1
        }));
      } else if (data.results && Array.isArray(data.results)) {
        results = data.results.map((item: any, index: number) => ({
          title: item.title || 'No title',
          url: item.url || item.link || '#',
          snippet: item.snippet || item.description || 'No description available',
          position: index + 1
        }));
      } else if (Array.isArray(data)) {
        results = data.map((item: any, index: number) => ({
          title: item.title || 'No title',
          url: item.url || item.link || '#',
          snippet: item.snippet || item.description || 'No description available',
          position: index + 1
        }));
      }

      return {
        results,
        total_results: data.total_results || data.totalResults || results.length,
        search_time: data.search_time || data.searchTime,
        query
      };

    } catch (error) {
      console.error('Web search error:', error);
      throw new Error(`Failed to perform web search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform a news search
   * @param query The search query
   * @param options Additional search options
   * @returns Promise that resolves to news search results
   */
  async searchNews(query: string, options: {
    num?: number;
    start?: number;
    gl?: string;
    hl?: string;
  } = {}): Promise<SearchResponse> {
    try {
      const searchParams = new URLSearchParams({
        q: query,
        num: (options.num || 10).toString(),
        start: (options.start || 0).toString(),
        gl: options.gl || 'us',
        hl: options.hl || 'en',
        tbm: 'nws' // News search parameter
      });

      const response = await fetch(`${this.SEARCH_API_URL}?${searchParams}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.RAPIDAPI_KEY,
          'x-rapidapi-host': this.SEARCH_API_HOST,
        },
      });

      if (!response.ok) {
        throw new Error(`News search failed with status ${response.status}`);
      }

      const data = await response.json();
      
      let results: SearchResult[] = [];
      
      if (data.data && Array.isArray(data.data)) {
        results = data.data.map((item: any, index: number) => ({
          title: item.title || 'No title',
          url: item.url || item.link || '#',
          snippet: item.snippet || item.description || 'No description available',
          position: index + 1
        }));
      }

      return {
        results,
        total_results: data.total_results || results.length,
        search_time: data.search_time,
        query
      };

    } catch (error) {
      console.error('News search error:', error);
      throw new Error(`Failed to perform news search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get search suggestions
   * @param query The partial search query
   * @returns Promise that resolves to search suggestions
   */
  async getSuggestions(query: string): Promise<string[]> {
    try {
      // This would typically use a different endpoint for suggestions
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error('Search suggestions error:', error);
      return [];
    }
  }
}