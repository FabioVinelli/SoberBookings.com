// backend/src/services/matching/ranking.js

/**
 * Ranking and Merging Service for SoberBookings.com
 * Combines and ranks results from database and web searches
 */

const logger = require('../../utils/logger');
const { calculateDistance } = require('../../utils/geo');

/**
 * Merge and rank results from database and web searches
 * @param {Array} dbResults - Results from the database search
 * @param {Array} webResults - Results from the web search
 * @param {Object} query - The original query
 * @param {Object} options - Ranking options
 * @returns {Array} Merged and ranked results
 */
function mergeAndRankResults(dbResults, webResults, query, options = {}) {
  logger.info(`Merging ${dbResults.length} DB results with ${webResults.length} web results`);
  
  // Set up default weight factors
  const weights = {
    asamLevelMatch: 10,
    specialtiesMatch: 8,
    demographicsMatch: 6,
    insuranceMatch: 9,
    locationProximity: 7,
    verificationTier: 5,
    sourcePreference: 3, // Preference for database results
    ...options.weights
  };
  
  // Combine results
  let allResults = [...dbResults];
  
  // Check for duplicates before adding web results
  webResults.forEach(webResult => {
    // Skip web results that might be duplicates of database results
    const isDuplicate = dbResults.some(dbResult => 
      isSimilarFacility(dbResult, webResult)
    );
    
    if (!isDuplicate) {
      allResults.push(webResult);
    }
  });
  
  // Rank all results
  const rankedResults = allResults.map(result => {
    // Calculate the score for each result
    const score = calculateScore(result, query, weights);
    
    return {
      ...result,
      _score: score
    };
  });
  
  // Sort by score (descending)
  rankedResults.sort((a, b) => b._score - a._score);
  
  logger.info(`Returned ${rankedResults.length} merged and ranked results`);
  return rankedResults;
}

/**
 * Calculate score for a result based on how well it matches the query
 * @param {Object} result - The result to score
 * @param {Object} query - The original query
 * @param {Object} weights - Weight factors for scoring
 * @returns {number} Score value
 * @private
 */
function calculateScore(result, query, weights) {
  let score = 0;
  
  // ASAM Level Match
  if (query.level && result.treatmentDetails && result.treatmentDetails.asamLevel) {
    const asamMatch = result.treatmentDetails.asamLevel.includes(query.level);
    score += asamMatch ? weights.asamLevelMatch : 0;
  }
  
  // Specialties Match
  if (query.specialties && query.specialties.length > 0 && 
      result.treatmentDetails && result.treatmentDetails.specialties) {
    const specialtiesCount = query.specialties.length;
    let matchCount = 0;
    
    query.specialties.forEach(specialty => {
      if (result.treatmentDetails.specialties.some(s => 
        s.toLowerCase().includes(specialty.toLowerCase())
      )) {
        matchCount++;
      }
    });
    
    const specialtiesMatchRatio = specialtiesCount > 0 ? matchCount / specialtiesCount : 0;
    score += specialtiesMatchRatio * weights.specialtiesMatch;
  }
  
  // Demographics Match
  if (query.demographics && result.demographics) {
    let demographicsScore = 0;
    
    // Gender match
    if (query.demographics.gender && result.demographics.genderSpecific) {
      if (query.demographics.gender === result.demographics.genderSpecific ||
          result.demographics.genderSpecific === 'all') {
        demographicsScore += 1;
      }
    }
    
    // Special populations match
    if (query.demographics.specialPopulations && 
        query.demographics.specialPopulations.length > 0 &&
        result.demographics.specialPopulations) {
      const popCount = query.demographics.specialPopulations.length;
      let matchCount = 0;
      
      query.demographics.specialPopulations.forEach(pop => {
        if (result.demographics.specialPopulations.some(p => 
          p.toLowerCase().includes(pop.toLowerCase())
        )) {
          matchCount++;
        }
      });
      
      const popMatchRatio = popCount > 0 ? matchCount / popCount : 0;
      demographicsScore += popMatchRatio;
    }
    
    // Normalize demographics score (0-1) and apply weight
    demographicsScore = Math.min(demographicsScore, 1);
    score += demographicsScore * weights.demographicsMatch;
  }
  
  // Insurance Match
  if (query.insurance && result.financial && result.financial.acceptedInsurance) {
    const insuranceMatch = result.financial.acceptedInsurance.some(insurance =>
      insurance.toLowerCase().includes(query.insurance.toLowerCase())
    );
    score += insuranceMatch ? weights.insuranceMatch : 0;
  }
  
  // Location Proximity
  if (query.location && query.location.latitude && query.location.longitude && 
      result._geoloc) {
    // Calculate distance in miles
    const distance = calculateDistance(
      query.location.latitude,
      query.location.longitude,
      result._geoloc.lat,
      result._geoloc.lng
    );
    
    // Convert distance to a score (closer = higher score)
    // Score decreases linearly with distance up to max radius
    const maxRadius = query.radius || 50; // Default 50 miles
    const distanceScore = Math.max(0, 1 - (distance / maxRadius));
    score += distanceScore * weights.locationProximity;
  }
  
  // Verification Tier
  let verificationScore = 0;
  switch (result.verificationTier) {
    case 'premium':
      verificationScore = 1.0;
      break;
    case 'enhanced':
      verificationScore = 0.8;
      break;
    case 'basic':
      verificationScore = 0.6;
      break;
    default:
      verificationScore = 0.1;
  }
  score += verificationScore * weights.verificationTier;
  
  // Source Preference (database over web)
  const sourceScore = result._source === 'database' ? 1.0 : 0.3;
  score += sourceScore * weights.sourcePreference;
  
  return score;
}

/**
 * Check if two facilities are similar (likely the same facility)
 * @param {Object} facility1 - First facility
 * @param {Object} facility2 - Second facility
 * @returns {boolean} True if facilities are similar
 * @private
 */
function isSimilarFacility(facility1, facility2) {
  // Check by name similarity
  const name1 = facility1.name.toLowerCase();
  const name2 = facility2.name.toLowerCase();
  
  // If names are very similar
  if (calculateStringSimilarity(name1, name2) > 0.8) {
    return true;
  }
  
  // Check by address if both have complete addresses
  if (facility1.address && facility2.address &&
      facility1.address.city && facility2.address.city &&
      facility1.address.state && facility2.address.state) {
    
    const address1 = `${facility1.address.street}, ${facility1.address.city}, ${facility1.address.state}`.toLowerCase();
    const address2 = `${facility2.address.street}, ${facility2.address.city}, ${facility2.address.state}`.toLowerCase();
    
    // If addresses are similar
    if (calculateStringSimilarity(address1, address2) > 0.7) {
      return true;
    }
    
    // If city and state match, and they're in the same area
    if (facility1.address.city.toLowerCase() === facility2.address.city.toLowerCase() &&
        facility1.address.state.toLowerCase() === facility2.address.state.toLowerCase()) {
      
      // If we have geolocation data, check if they're close
      if (facility1._geoloc && facility2._geoloc) {
        const distance = calculateDistance(
          facility1._geoloc.lat,
          facility1._geoloc.lng,
          facility2._geoloc.lat,
          facility2._geoloc.lng
        );
        
        // If within 0.5 miles, likely the same facility
        if (distance < 0.5) {
          return true;
        }
      }
    }
  }
  
  // Check by phone number if both have phone numbers
  if (facility1.contactInfo && facility2.contactInfo &&
      facility1.contactInfo.phone && facility2.contactInfo.phone) {
    
    // Normalize phone numbers for comparison
    const phone1 = facility1.contactInfo.phone.replace(/\D/g, '');
    const phone2 = facility2.contactInfo.phone.replace(/\D/g, '');
    
    // If phone numbers match
    if (phone1 === phone2 && phone1.length >= 10) {
      return true;
    }
  }
  
  // Check by website if both have websites
  if (facility1.contactInfo && facility2.contactInfo &&
      facility1.contactInfo.website && facility2.contactInfo.website) {
    
    const website1 = facility1.contactInfo.website.toLowerCase();
    const website2 = facility2.contactInfo.website.toLowerCase();
    
    // If websites are similar
    if (calculateStringSimilarity(website1, website2) > 0.8) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate similarity between two strings (Levenshtein distance-based)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 * @private
 */
function calculateStringSimilarity(str1, str2) {
  // Levenshtein distance implementation
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Early returns for empty strings
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  // Initialize matrix
  const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
  
  // Fill first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // Fill rest of matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  // Calculate similarity score (0-1)
  const maxLength = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLength;
}

module.exports = {
  mergeAndRankResults
};
