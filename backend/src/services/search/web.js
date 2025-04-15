// backend/src/services/search/web.js

/**
 * Web Search Service for SoberBookings.com
 * Supplements the private database with web search results
 */

const axios = require('axios');
const { parse } = require('node-html-parser');
const logger = require('../../utils/logger');

class WebSearchService {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.WEB_SEARCH_API_KEY,
      engineId: config.engineId || process.env.WEB_SEARCH_ENGINE_ID,
      placesApiKey: config.placesApiKey || process.env.GOOGLE_PLACES_API_KEY,
      maxResults: 20,
      ...config
    };
    
    this.searchClient = axios.create({
      baseURL: 'https://www.googleapis.com/customsearch/v1',
      params: {
        key: this.config.apiKey,
        cx: this.config.engineId
      }
    });
    
    this.placesClient = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api/place',
      params: {
        key: this.config.placesApiKey
      }
    });
    
    logger.info('Web Search Service initialized');
  }

  /**
   * Search for facilities using web search
   * @param {Object} query - The search query parameters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    logger.info(`Performing web search with query: ${JSON.stringify(query)}`);
    
    try {
      // Build search query string
      const searchQuery = this.buildSearchQuery(query);
      
      // Perform search
      const searchResults = await this.performSearch(searchQuery, options);
      
      // Process results
      const processedResults = await this.processResults(searchResults, query);
      
      // Return top results
      return processedResults.slice(0, options.maxResults || this.config.maxResults);
    } catch (error) {
      logger.error(`Error in web search: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build a search query string from the query object
   * @param {Object} query - The search query 
   * @returns {string} Search query string
   * @private
   */
  buildSearchQuery(query) {
    let queryParts = ['recovery center', 'treatment facility', 'rehabilitation'];
    
    // Add ASAM level if present
    if (query.level) {
      queryParts.push(`ASAM level ${query.level}`);
    }
    
    // Add specialties if present
    if (query.specialties && query.specialties.length > 0) {
      queryParts = queryParts.concat(query.specialties);
    }
    
    // Add demographics if present
    if (query.demographics) {
      if (query.demographics.gender && query.demographics.gender !== 'all') {
        queryParts.push(`${query.demographics.gender} specific`);
      }
      
      if (query.demographics.specialPopulations && query.demographics.specialPopulations.length > 0) {
        queryParts = queryParts.concat(query.demographics.specialPopulations);
      }
    }
    
    // Add insurance if present
    if (query.insurance) {
      queryParts.push(`accepts ${query.insurance} insurance`);
    }
    
    // Add location if present
    if (query.location) {
      if (query.location.city && query.location.state) {
        queryParts.push(`in ${query.location.city}, ${query.location.state}`);
      } else if (query.location.state) {
        queryParts.push(`in ${query.location.state}`);
      } else if (query.location.zipCode) {
        queryParts.push(`near ${query.location.zipCode}`);
      }
    }
    
    // Combine parts into a query string
    return queryParts.join(' ');
  }

  /**
   * Perform the web search
   * @param {string} searchQuery - The search query string
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Raw search results
   * @private
   */
  async performSearch(searchQuery, options) {
    // Perform custom search
    const response = await this.searchClient.get('', {
      params: {
        q: searchQuery,
        num: options.maxResults || this.config.maxResults,
        start: options.offset || 1
      }
    });
    
    return response.data.items || [];
  }

  /**
   * Process and transform search results
   * @param {Array} results - Raw search results
   * @param {Object} originalQuery - The original query object
   * @returns {Promise<Array>} Processed results
   * @private
   */
  async processResults(results, originalQuery) {
    // Process each result in parallel
    const processedResults = await Promise.all(
      results.map(async (result) => {
        try {
          // Extract basic information
          const basicInfo = this.extractBasicInfo(result);
          
          // Extract contact information
          const contactInfo = await this.extractContactInfo(result);
          
          // Extract treatment details
          const treatmentDetails = this.extractTreatmentDetails(result, originalQuery);
          
          // Create a structured result
          return {
            id: `web-${this.generateId(result.link)}`,
            name: basicInfo.name,
            address: basicInfo.address,
            contactInfo,
            treatmentDetails,
            // Set default values for other fields
            demographics: {
              ageGroups: [],
              genderSpecific: 'all',
              specialPopulations: []
            },
            financial: {
              acceptedInsurance: [],
              privatePayOptions: true,
              slidingScale: false
            },
            facilityFeatures: [],
            verificationTier: 'none',
            verificationStatus: 'unverified',
            _source: 'web', // Mark as coming from web search
            _webData: {
              title: result.title,
              snippet: result.snippet,
              url: result.link,
              displayLink: result.displayLink
            }
          };
        } catch (error) {
          logger.warn(`Error processing web result ${result.link}: ${error.message}`);
          return null;
        }
      })
    );
    
    // Filter out null results
    return processedResults.filter(result => result !== null);
  }

  /**
   * Extract basic information from a search result
   * @param {Object} result - Raw search result
   * @returns {Object} Basic information
   * @private
   */
  extractBasicInfo(result) {
    // Extract the facility name from the title
    const title = result.title || '';
    const name = title.split('|')[0].split('-')[0].trim();
    
    // Extract address from snippet or pagemap
    let address = {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    };
    
    // Try to extract from pagemap if available
    if (result.pagemap && result.pagemap.postaladdress) {
      const postalAddress = result.pagemap.postaladdress[0];
      address = {
        street: postalAddress.streetaddress || '',
        city: postalAddress.addresslocality || '',
        state: postalAddress.addressregion || '',
        zipCode: postalAddress.postalcode || '',
        country: postalAddress.addresscountry || 'US'
      };
    } else {
      // Try to extract from snippet
      const snippet = result.snippet || '';
      
      // Look for address patterns
      const addressRegex = /(\d+\s+[\w\s]+),\s+([A-Za-z\s]+),\s+([A-Z]{2})\s+(\d{5})/;
      const match = snippet.match(addressRegex);
      
      if (match) {
        address = {
          street: match[1] || '',
          city: match[2] || '',
          state: match[3] || '',
          zipCode: match[4] || '',
          country: 'US'
        };
      }
    }
    
    return { name, address };
  }

  /**
   * Extract contact information from a search result
   * @param {Object} result - Raw search result
   * @returns {Promise<Object>} Contact information
   * @private
   */
  async extractContactInfo(result) {
    let contactInfo = {
      phone: '',
      email: '',
      website: result.link || ''
    };
    
    // Try to extract from pagemap if available
    if (result.pagemap && result.pagemap.metatags) {
      const metaTags = result.pagemap.metatags[0];
      
      // Look for phone number
      for (const key in metaTags) {
        if (key.includes('phone') || key.includes('telephone')) {
          contactInfo.phone = metaTags[key];
          break;
        }
      }
      
      // Look for email
      for (const key in metaTags) {
        if (key.includes('email')) {
          contactInfo.email = metaTags[key];
          break;
        }
      }
    }
    
    // If we couldn't find a phone number, try to find it in the snippet
    if (!contactInfo.phone) {
      const snippet = result.snippet || '';
      const phoneRegex = /(\(?[0-9]{3}\)?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4})/;
      const match = snippet.match(phoneRegex);
      
      if (match) {
        contactInfo.phone = match[1];
      }
    }
    
    return contactInfo;
  }

  /**
   * Extract treatment details from a search result
   * @param {Object} result - Raw search result
   * @param {Object} originalQuery - The original query object
   * @returns {Object} Treatment details
   * @private
   */
  extractTreatmentDetails(result, originalQuery) {
    let treatmentDetails = {
      asamLevel: originalQuery.level || '',
      specialties: [],
      services: []
    };
    
    const snippet = result.snippet || '';
    const title = result.title || '';
    const combinedText = `${title} ${snippet}`;
    
    // Look for mentions of specialties
    const specialtyKeywords = [
      'alcohol', 'drug', 'opioid', 'heroin', 'cocaine', 'meth',
      'addiction', 'substance abuse', 'dual diagnosis', 'mental health',
      'trauma', 'PTSD', 'anxiety', 'depression'
    ];
    
    specialtyKeywords.forEach(keyword => {
      if (combinedText.toLowerCase().includes(keyword.toLowerCase())) {
        treatmentDetails.specialties.push(keyword);
      }
    });
    
    // Look for mentions of services
    const serviceKeywords = [
      'detox', 'inpatient', 'residential', 'outpatient', 'IOP',
      'PHP', 'therapy', 'counseling', 'medication', 'MAT',
      'aftercare', 'sober living', 'holistic', '12-step'
    ];
    
    serviceKeywords.forEach(keyword => {
      if (combinedText.toLowerCase().includes(keyword.toLowerCase())) {
        treatmentDetails.services.push(keyword);
      }
    });
    
    return treatmentDetails;
  }

  /**
   * Generate a unique ID from a URL
   * @param {string} url - URL to hash
   * @returns {string} Unique ID
   * @private
   */
  generateId(url) {
    // Simple hash function for URLs
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

module.exports = WebSearchService;