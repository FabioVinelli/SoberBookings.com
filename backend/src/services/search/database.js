// backend/src/services/search/database.js

/**
 * Database Search Service for SoberBookings.com
 * Searches the verified private database of treatment facilities
 */

const { Client } = require('@notionhq/client');
const { SearchClient } = require('algoliasearch');
const logger = require('../../utils/logger');

class DatabaseSearchService {
  constructor(config = {}) {
    // Initialize Notion client for CMS
    this.notionClient = new Client({ 
      auth: config.notionApiKey || process.env.NOTION_API_KEY 
    });
    this.notionDatabaseId = config.notionDatabaseId || process.env.NOTION_DATABASE_ID;
    
    // Initialize search index (Algolia or Elasticsearch)
    this.searchClient = new SearchClient(
      config.searchAppId || process.env.SEARCH_APP_ID,
      config.searchApiKey || process.env.SEARCH_API_KEY
    );
    this.searchIndex = this.searchClient.initIndex(
      config.searchIndexName || process.env.SEARCH_INDEX_NAME
    );
    
    logger.info('Database Search Service initialized');
  }

  /**
   * Search for facilities in the verified database
   * @param {Object} query - The search query parameters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    logger.info(`Searching database with query: ${JSON.stringify(query)}`);
    
    try {
      // Convert query to search parameters
      const searchParams = this.buildSearchParams(query, options);
      
      // Perform search using Algolia/Elasticsearch
      const searchResults = await this.searchIndex.search(searchParams);
      
      // Process and transform results
      const processedResults = this.processResults(searchResults.hits);
      
      // Add verification status and tier information
      const resultsWithVerification = await this.addVerificationInfo(processedResults);
      
      return resultsWithVerification;
    } catch (error) {
      logger.error(`Error in database search: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build search parameters from query object
   * @param {Object} query - The search query 
   * @param {Object} options - Search options
   * @returns {Object} Search parameters for the search engine
   * @private
   */
  buildSearchParams(query, options) {
    // Build base search parameters
    const params = {
      query: query.keywords || '',
      filters: [],
      page: options.offset ? Math.floor(options.offset / options.limit) : 0,
      hitsPerPage: options.limit || 20
    };
    
    // Add filters based on query parameters
    if (query.level) {
      params.filters.push(`asamLevel:${query.level}`);
    }
    
    if (query.specialties && query.specialties.length > 0) {
      const specialtiesFilter = query.specialties.map(s => `specialties:${s}`).join(' OR ');
      params.filters.push(`(${specialtiesFilter})`);
    }
    
    if (query.demographics) {
      if (query.demographics.age) {
        params.filters.push(`ageGroups:${query.demographics.age}`);
      }
      
      if (query.demographics.gender) {
        params.filters.push(`genderSpecific:${query.demographics.gender}`);
      }
      
      if (query.demographics.specialPopulations && query.demographics.specialPopulations.length > 0) {
        const populationsFilter = query.demographics.specialPopulations
          .map(p => `specialPopulations:${p}`)
          .join(' OR ');
        params.filters.push(`(${populationsFilter})`);
      }
    }
    
    if (query.insurance) {
      params.filters.push(`acceptedInsurance:${query.insurance}`);
    }
    
    // Add location-based filtering
    if (query.location) {
      params.aroundLatLng = `${query.location.latitude}, ${query.location.longitude}`;
      params.aroundRadius = query.radius ? query.radius * 1609 : 80467; // Convert miles to meters (default 50 miles)
    }
    
    // If verified only, add verification filter
    if (options.includeVerifiedOnly) {
      params.filters.push('verificationStatus:verified');
    }
    
    // Combine all filters with AND operator
    if (params.filters.length > 0) {
      params.filters = params.filters.join(' AND ');
    } else {
      delete params.filters;
    }
    
    return params;
  }

  /**
   * Process and transform search results
   * @param {Array} hits - Raw search hits
   * @returns {Array} Processed results
   * @private
   */
  processResults(hits) {
    return hits.map(hit => ({
      id: hit.objectID,
      name: hit.name,
      address: {
        street: hit.address.street,
        city: hit.address.city,
        state: hit.address.state,
        zipCode: hit.address.zipCode,
        country: hit.address.country || 'US'
      },
      contactInfo: {
        phone: hit.phone,
        email: hit.email,
        website: hit.website
      },
      treatmentDetails: {
        asamLevel: hit.asamLevel,
        specialties: hit.specialties || [],
        services: hit.services || []
      },
      demographics: {
        ageGroups: hit.ageGroups || [],
        genderSpecific: hit.genderSpecific || 'all',
        specialPopulations: hit.specialPopulations || []
      },
      financial: {
        acceptedInsurance: hit.acceptedInsurance || [],
        privatePayOptions: hit.privatePayOptions || false,
        slidingScale: hit.slidingScale || false
      },
      facilityFeatures: hit.facilityFeatures || [],
      verificationTier: hit.verificationTier,
      verificationStatus: hit.verificationStatus,
      _geoloc: hit._geoloc,
      _source: 'database' // Mark as coming from verified database
    }));
  }

  /**
   * Add verification information to results
   * @param {Array} results - Processed search results
   * @returns {Promise<Array>} Results with verification info
   * @private
   */
  async addVerificationInfo(results) {
    // For each result, fetch the latest verification status from Notion
    // This ensures we have the most up-to-date verification information
    const resultsWithVerification = await Promise.all(
      results.map(async (result) => {
        try {
          const verificationInfo = await this.getVerificationInfo(result.id);
          return {
            ...result,
            verification: verificationInfo
          };
        } catch (error) {
          logger.warn(`Could not fetch verification for ${result.id}: ${error.message}`);
          return result;
        }
      })
    );
    
    return resultsWithVerification;
  }

  /**
   * Get verification information for a facility
   * @param {string} facilityId - The facility ID
   * @returns {Promise<Object>} Verification information
   * @private
   */
  async getVerificationInfo(facilityId) {
    // Query Notion database for the facility's verification info
    const response = await this.notionClient.databases.query({
      database_id: this.notionDatabaseId,
      filter: {
        property: 'ID',
        text: {
          equals: facilityId
        }
      }
    });
    
    if (response.results.length === 0) {
      return {
        tier: 'none',
        status: 'unverified',
        lastVerified: null
      };
    }
    
    const facilityPage = response.results[0];
    const properties = facilityPage.properties;
    
    return {
      tier: properties.VerificationTier?.select?.name || 'basic',
      status: properties.VerificationStatus?.select?.name || 'pending',
      lastVerified: properties.LastVerified?.date?.start || null,
      documents: properties.VerificationDocuments?.files || [],
      notes: properties.VerificationNotes?.rich_text?.map(text => text.plain_text).join('') || ''
    };
  }

  /**
   * Get detailed information for a specific facility by ID
   * @param {string} facilityId - The facility ID
   * @returns {Promise<Object>} Facility details
   */
  async getFacilityById(facilityId) {
    logger.info(`Fetching facility details for ID: ${facilityId}`);
    
    try {
      // Get the facility from the search index
      const facility = await this.searchIndex.getObject(facilityId);
      
      // Process the result
      const processedFacility = this.processResults([facility])[0];
      
      // Add verification info
      const facilityWithVerification = (await this.addVerificationInfo([processedFacility]))[0];
      
      // Get additional details from Notion if available
      const notionDetails = await this.getNotionDetails(facilityId);
      
      // Merge with Notion details
      return {
        ...facilityWithVerification,
        ...notionDetails
      };
    } catch (error) {
      logger.error(`Error fetching facility by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get additional facility details from Notion
   * @param {string} facilityId - The facility ID
   * @returns {Promise<Object>} Additional details
   * @private
   */
  async getNotionDetails(facilityId) {
    // Query Notion database for additional facility details
    const response = await this.notionClient.databases.query({
      database_id: this.notionDatabaseId,
      filter: {
        property: 'ID',
        text: {
          equals: facilityId
        }
      }
    });
    
    if (response.results.length === 0) {
      return {};
    }
    
    const facilityPage = response.results[0];
    const properties = facilityPage.properties;
    
    // Extract additional details from Notion properties
    return {
      description: properties.Description?.rich_text?.map(text => text.plain_text).join('') || '',
      amenities: properties.Amenities?.multi_select?.map(option => option.name) || [],
      staff: properties.Staff?.rich_text?.map(text => text.plain_text).join('') || '',
      programLength: properties.ProgramLength?.rich_text?.map(text => text.plain_text).join('') || '',
      successMetrics: properties.SuccessMetrics?.rich_text?.map(text => text.plain_text).join('') || '',
      testimonialsCount: properties.TestimonialsCount?.number || 0,
      ratings: {
        overall: properties.OverallRating?.number || 0,
        staffSupport: properties.StaffSupportRating?.number || 0,
        accommodations: properties.AccommodationsRating?.number || 0,
        treatmentEffectiveness: properties.TreatmentEffectivenessRating?.number || 0
      },
      images: properties.Images?.files?.map(file => file.external?.url || file.file?.url) || []
    };
  }

  /**
   * Verify if a facility accepts a specific insurance
   * @param {string} facilityId - The facility ID
   * @param {string} insuranceProvider - The insurance provider
   * @param {string} insurancePlan - The insurance plan (optional)
   * @returns {Promise<Object>} Verification result
   */
  async verifyInsurance(facilityId, insuranceProvider, insurancePlan = null) {
    logger.info(`Verifying insurance for facility ${facilityId}: ${insuranceProvider} ${insurancePlan || ''}`);
    
    try {
      // Get facility details
      const facility = await this.getFacilityById(facilityId);
      
      // Check if the insurance provider is in the accepted list
      const acceptedInsurance = facility.financial.acceptedInsurance || [];
      const isProviderAccepted = acceptedInsurance.some(
        insurance => insurance.toLowerCase() === insuranceProvider.toLowerCase()
      );
      
      // If provider not accepted, return negative result
      if (!isProviderAccepted) {
        return {
          facilityId,
          insuranceProvider,
          insurancePlan,
          isAccepted: false,
          verificationMethod: 'database',
          timestamp: new Date().toISOString()
        };
      }
      
      // If no specific plan was provided, return positive for the provider
      if (!insurancePlan) {
        return {
          facilityId,
          insuranceProvider,
          isAccepted: true,
          verificationMethod: 'database',
          timestamp: new Date().toISOString()
        };
      }
      
      // For specific plans, we would ideally have a more detailed database
      // For now, assume plan is accepted if provider is accepted
      return {
        facilityId,
        insuranceProvider,
        insurancePlan,
        isAccepted: true,
        verificationMethod: 'database',
        verificationConfidence: 'medium', // Medium confidence for plan-level verification
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error verifying insurance: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DatabaseSearchService;
