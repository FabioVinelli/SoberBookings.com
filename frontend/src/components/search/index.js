// backend/src/services/search/hybrid.js

/**
 * Hybrid Search Service for SoberBookings.com
 * Combines results from private verified database with web search results
 */

const DatabaseSearch = require('./database');
const WebSearch = require('./web');
const { mergeAndRankResults } = require('../matching/ranking');
const logger = require('../../utils/logger');

class HybridSearchService {
  constructor(config = {}) {
    this.dbSearch = new DatabaseSearch(config.database);
    this.webSearch = new WebSearch(config.webSearch);
    this.config = {
      useWebSearch: true,
      webSearchThreshold: 5, // Minimum number of database results before using web search
      maxWebResults: 10,
      ...config
    };
    
    logger.info('Hybrid Search Service initialized');
  }

  /**
   * Perform a search using the hybrid approach
   * @param {Object} query - The search query parameters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Merged and ranked search results
   */
  async search(query, options = {}) {
    logger.info(`Performing hybrid search with query: ${JSON.stringify(query)}`);
    
    try {
      // First, search the verified database
      const dbResults = await this.dbSearch.search(query, options);
      logger.info(`Database search returned ${dbResults.length} results`);
      
      // If database results are insufficient, supplement with web search
      let webResults = [];
      if (this.config.useWebSearch && dbResults.length < this.config.webSearchThreshold) {
        logger.info('Database results below threshold, performing web search');
        webResults = await this.webSearch.search(query, {
          ...options,
          maxResults: this.config.maxWebResults
        });
        logger.info(`Web search returned ${webResults.length} results`);
      }
      
      // Merge and rank the results
      const mergedResults = mergeAndRankResults(dbResults, webResults, query);
      logger.info(`Returning ${mergedResults.length} merged results`);
      
      return mergedResults;
    } catch (error) {
      logger.error(`Error in hybrid search: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform an ASAM-based matching search
   * @param {Object} asamCriteria - The ASAM criteria for matching
   * @param {Object} options - Matching options
   * @returns {Promise<Array>} Matched facilities
   */
  async matchByAsamCriteria(asamCriteria, options = {}) {
    logger.info(`Performing ASAM matching with criteria: ${JSON.stringify(asamCriteria)}`);
    
    try {
      // Convert ASAM criteria to search query
      const query = this.convertAsamToSearchQuery(asamCriteria);
      
      // Use the hybrid search with the converted query
      const results = await this.search(query, {
        ...options,
        rankingFactors: {
          asamLevelMatch: 10,
          patientDemographicsMatch: 8,
          insuranceMatch: 6,
          locationProximity: 4,
          ...options.rankingFactors
        }
      });
      
      return results;
    } catch (error) {
      logger.error(`Error in ASAM matching: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert ASAM criteria to a search query
   * @param {Object} asamCriteria - The ASAM criteria 
   * @returns {Object} A search query object
   * @private
   */
  convertAsamToSearchQuery(asamCriteria) {
    // Map ASAM dimensions to search parameters
    return {
      level: asamCriteria.recommendedLevel,
      specialties: asamCriteria.specialtyNeeds || [],
      demographics: {
        age: asamCriteria.patientAge,
        gender: asamCriteria.patientGender,
        specialPopulations: asamCriteria.specialPopulations || []
      },
      insurance: asamCriteria.insuranceProvider,
      location: asamCriteria.location,
      radius: asamCriteria.searchRadius || 50, // Default 50 miles
    };
  }
}

module.exports = HybridSearchService;
