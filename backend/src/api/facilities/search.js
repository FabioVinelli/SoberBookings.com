// backend/src/api/facilities/search.js

const express = require('express');
const router = express.Router();
const HybridSearchService = require('../../services/search/hybrid');
const { validateSearchQuery } = require('../../utils/validators');
const { asyncHandler } = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

// Initialize the search service
const searchService = new HybridSearchService({
  database: {
    // Database connection config from environment
    url: process.env.DB_URL,
    apiKey: process.env.DB_API_KEY
  },
  webSearch: {
    // Web search API config from environment
    apiKey: process.env.WEB_SEARCH_API_KEY,
    engineId: process.env.WEB_SEARCH_ENGINE_ID
  }
});

/**
 * @route GET /api/v1/facilities/search
 * @desc Search for facilities using the hybrid approach
 * @access Public
 */
router.get('/search', validateSearchQuery, asyncHandler(async (req, res) => {
  const { query } = req;
  logger.info(`Received search request: ${JSON.stringify(query)}`);
  
  const searchResults = await searchService.search(query, {
    limit: parseInt(query.limit) || 20,
    offset: parseInt(query.offset) || 0,
    includeVerifiedOnly: query.verifiedOnly === 'true'
  });
  
  return res.json({
    success: true,
    count: searchResults.length,
    results: searchResults,
    metadata: {
      query: query,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * @route POST /api/v1/facilities/match
 * @desc Match facilities based on ASAM criteria
 * @access Public
 */
router.post('/match', asyncHandler(async (req, res) => {
  const asamCriteria = req.body;
  logger.info(`Received ASAM matching request: ${JSON.stringify(asamCriteria)}`);
  
  // Validate the ASAM criteria
  if (!asamCriteria.recommendedLevel) {
    return res.status(400).json({
      success: false,
      error: 'ASAM recommended level is required'
    });
  }
  
  const matchedFacilities = await searchService.matchByAsamCriteria(asamCriteria, {
    limit: parseInt(req.query.limit) || 20,
    includeVerifiedOnly: req.query.verifiedOnly !== 'false'
  });
  
  return res.json({
    success: true,
    count: matchedFacilities.length,
    results: matchedFacilities,
    metadata: {
      criteria: asamCriteria,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * @route GET /api/v1/facilities/:id
 * @desc Get detailed information for a specific facility
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Fetching facility details for ID: ${id}`);
  
  const facility = await searchService.dbSearch.getFacilityById(id);
  
  if (!facility) {
    return res.status(404).json({
      success: false,
      error: 'Facility not found'
    });
  }
  
  return res.json({
    success: true,
    facility
  });
}));

/**
 * @route GET /api/v1/facilities/verify-insurance/:facilityId
 * @desc Verify if a facility accepts a specific insurance
 * @access Public
 */
router.get('/verify-insurance/:facilityId', asyncHandler(async (req, res) => {
  const { facilityId } = req.params;
  const { insuranceProvider, insurancePlan } = req.query;
  
  if (!insuranceProvider) {
    return res.status(400).json({
      success: false,
      error: 'Insurance provider is required'
    });
  }
  
  logger.info(`Verifying insurance for facility ${facilityId}: ${insuranceProvider} ${insurancePlan || ''}`);
  
  const verification = await searchService.dbSearch.verifyInsurance(
    facilityId, 
    insuranceProvider, 
    insurancePlan
  );
  
  return res.json({
    success: true,
    verification
  });
}));

module.exports = router;
