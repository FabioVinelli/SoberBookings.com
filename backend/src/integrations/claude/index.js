// backend/src/integrations/claude/intaker.js

/**
 * Claude Integration for The Intaker
 * Handles ASAM assessment and facility matching through Claude API
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../../utils/logger');
const HybridSearchService = require('../../services/search/hybrid');

class ClaudeIntaker {
  constructor(config = {}) {
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
    });
    
    // Initialize search service
    this.searchService = new HybridSearchService(config.searchConfig);
    
    // Default Claude model version
    this.modelVersion = config.modelVersion || 'claude-3-opus-20240229';
    
    // Maximum token context
    this.maxTokens = config.maxTokens || 100000;
    
    logger.info(`Claude Intaker initialized with model: ${this.modelVersion}`);
  }

  /**
   * Conduct an ASAM assessment with a patient
   * @param {string} patientId - Patient identifier
   * @param {Array} initialMessages - Previous conversation messages (if any)
   * @returns {Promise<Object>} Assessment results and conversation
   */
  async conductAssessment(patientId, initialMessages = []) {
    logger.info(`Starting ASAM assessment for patient: ${patientId}`);
    
    try {
      // Prepare the system prompt with ASAM assessment instructions
      const systemPrompt = this.getASAMAssessmentPrompt();
      
      // Prepare messages array
      const messages = [
        { role: 'system', content: systemPrompt },
        ...initialMessages
      ];
      
      // If no initial messages, add a welcome message from the assistant
      if (initialMessages.length === 0) {
        messages.push({
          role: 'assistant',
          content: 'Hello, I\'m The Intaker, and I\'m here to help you find the right treatment options for your needs. I\'ll be asking a series of questions based on the ASAM criteria to better understand your situation and match you with appropriate care. Everything you share with me is confidential and will be used only for treatment matching purposes. Would you like to begin the assessment now?'
        });
      }
      
      // Start or continue the conversation
      const response = await this.anthropic.messages.create({
        model: this.modelVersion,
        max_tokens: 1000,
        system: systemPrompt,
        messages: initialMessages
      });
      
      // Extract ASAM criteria if assessment is complete
      const asamCriteria = this.extractASAMCriteria(response);
      
      // Return assessment results
      return {
        patientId,
        asamCriteria,
        conversationId: response.id,
        messages: [...initialMessages, response.message],
        isComplete: asamCriteria !== null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error conducting ASAM assessment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Match facilities based on assessment results
   * @param {Object} asamCriteria - ASAM criteria from assessment
   * @param {Object} patientPreferences - Additional patient preferences
   * @returns {Promise<Array>} Matched facilities
   */
  async matchFacilities(asamCriteria, patientPreferences = {}) {
    logger.info(`Matching facilities for ASAM criteria: ${JSON.stringify(asamCriteria)}`);
    
    try {
      // Combine ASAM criteria with patient preferences
      const searchCriteria = {
        ...asamCriteria,
        ...patientPreferences
      };
      
      // Use the search service to find matches
      const matchedFacilities = await this.searchService.matchByAsamCriteria(searchCriteria);
      
      // Return matched facilities
      return matchedFacilities;
    } catch (error) {
      logger.error(`Error matching facilities: ${error.message}`);
      throw error;
    }
  }

  /**
   * Explain facility matches to the patient
   * @param {Array} facilities - Matched facilities
   * @param {Object} asamCriteria - Patient's ASAM criteria
   * @returns {Promise<Object>} Explanation and recommendation
   */
  async explainMatches(facilities, asamCriteria) {
    logger.info(`Explaining ${facilities.length} facility matches to patient`);
    
    try {
      // Prepare the system prompt for match explanation
      const systemPrompt = this.getMatchExplanationPrompt();
      
      // Prepare the facilities data for Claude
      const facilitiesData = facilities.map(facility => ({
        name: facility.name,
        location: facility.address ? `${facility.address.city}, ${facility.address.state}` : 'Unknown',
        asamLevel: facility.treatmentDetails?.asamLevel || 'Unknown',
        specialties: facility.treatmentDetails?.specialties || [],
        services: facility.treatmentDetails?.services || [],
        verificationTier: facility.verificationTier || 'none',
        score: facility._score || 0
      }));
      
      // Create the user message with facilities and ASAM criteria
      const userMessage = JSON.stringify({
        facilities: facilitiesData,
        asamCriteria: asamCriteria
      });
      
      // Get explanation from Claude
      const response = await this.anthropic.messages.create({
        model: this.modelVersion,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      });
      
      // Extract recommendations
      const explanation = response.message.content;
      
      return {
        explanation,
        topRecommendations: facilities.slice(0, 3),
        allMatches: facilities,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error explaining matches: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the system prompt for ASAM assessment
   * @returns {string} System prompt
   * @private
   */
  getASAMAssessmentPrompt() {
    return `
    You are The Intaker, an AI assistant specializing in addiction and recovery treatment assessments.
    Your role is to conduct a comprehensive ASAM (American Society of Addiction Medicine) criteria assessment
    to help match patients with appropriate treatment facilities.
    
    # ASAM CRITERIA DIMENSIONS
    
    During the conversation, you need to gather information about these six dimensions:
    
    1. Acute Intoxication and/or Withdrawal Potential
    2. Biomedical Conditions and Complications
    3. Emotional, Behavioral, or Cognitive Conditions and Complications
    4. Readiness to Change
    5. Relapse, Continued Use, or Continued Problem Potential
    6. Recovery/Living Environment
    
    # ASSESSMENT APPROACH
    
    - Be empathetic, non-judgmental, and respectful
    - Ask questions conversationally, not as a rigid questionnaire
    - Adapt to the patient's responses and follow relevant threads
    - Maintain a professional, supportive tone
    - Focus on understanding the patient's needs for proper treatment matching
    - Do not provide medical advice or diagnosis
    
    # DATA COLLECTION REQUIREMENTS
    
    Your goal is to collect enough information to determine:
    
    1. Recommended ASAM Level of Care (0.5, 1.0, 2.1, 2.5, 3.1, 3.3, 3.5, 3.7, or 4.0)
    2. Primary substances of concern
    3. Co-occurring conditions
    4. Special population needs (if any)
    5. Insurance or payment information
    6. Location preferences
    7. Other important treatment considerations
    
    # OUTPUT FORMAT
    
    When you have gathered sufficient information for all dimensions, include a JSON assessment summary within triple backticks
    at the end of your response, following this format:
    
    ```json
    {
      "asamCriteria": {
        "dimension1Score": 0-4,
        "dimension2Score": 0-4,
        "dimension3Score": 0-4,
        "dimension4Score": 0-4,
        "dimension5Score": 0-4,
        "dimension6Score": 0-4,
        "recommendedLevel": "0.5/1.0/2.1/2.5/3.1/3.3/3.5/3.7/4.0",
        "substancesOfConcern": ["substance1", "substance2"],
        "coOccurringConditions": ["condition1", "condition2"],
        "specialtyNeeds": ["specialty1", "specialty2"],
        "patientAge": "Adolescent/Young Adult/Adult/Older Adult",
        "patientGender": "Male/Female/Non-binary/Other",
        "specialPopulations": ["population1", "population2"],
        "insuranceProvider": "provider name",
        "location": {
          "city": "city name",
          "state": "state name",
          "zipCode": "zip code"
        },
        "searchRadius": number in miles,
        "additionalNotes": "any other important considerations"
      }
    }
    ```
    
    Do NOT include this JSON until you have gathered sufficient information for all six dimensions.
    If more information is needed, continue the conversation normally without including the JSON.
    `;
  }

  /**
   * Get the system prompt for match explanation
   * @returns {string} System prompt
   * @private
   */
  getMatchExplanationPrompt() {
    return `
    You are The Intaker, an AI assistant that helps explain treatment facility matches to patients
    based on their ASAM assessment results.
    
    # YOUR TASK
    
    You will receive a JSON object containing:
    1. A list of matched treatment facilities ("facilities")
    2. The patient's ASAM criteria assessment results ("asamCriteria")
    
    Your job is to:
    
    1. Explain to the patient why these facilities match their needs
    2. Highlight the top 3 facilities and explain why they're particularly good matches
    3. Explain the key factors from their assessment that led to these recommendations
    4. Present the information in a supportive, clear, and non-clinical way
    
    # RESPONSE FORMAT
    
    Structure your response like this:
    
    1. Brief introduction explaining that these matches are based on their assessment
    2. Overview of their treatment needs based on ASAM criteria
    3. Top 3 recommended facilities with explanations of why each is a good match
    4. Brief mention of other options and their features
    5. Next steps for contacting these facilities or further assistance
    
    Keep your explanation concise, supportive, and focused on how these facilities meet the patient's specific needs.
    Avoid technical jargon where possible, and focus on what matters most to the patient.
    `;
  }

  /**
   * Extract ASAM criteria from Claude's response
   * @param {Object} response - Claude API response
   * @returns {Object|null} Extracted ASAM criteria or null if not found
   * @private
   */
  extractASAMCriteria(response) {
    try {
      const content = response.message.content;
      
      // Look for JSON within triple backticks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch && jsonMatch[1]) {
        const jsonStr = jsonMatch[1];
        const parsed = JSON.parse(jsonStr);
        
        // Return ASAM criteria if present
        if (parsed && parsed.asamCriteria) {
          return parsed.asamCriteria;
        }
      }
      
      // No ASAM criteria found
      return null;
    } catch (error) {
      logger.warn(`Error extracting ASAM criteria: ${error.message}`);
      return null;
    }
  }
}

module.exports = ClaudeIntaker;
