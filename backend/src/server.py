import os
import logging
from typing import Dict, Any, List
from fastmcp import FastMCP, Message

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastMCP
mcp = FastMCP(title="SoberBookings MCP Server")

@mcp.tool()
async def search_facilities(query: str, location: str = None, insurance: str = None) -> List[Dict[str, Any]]:
    """
    Search for treatment facilities based on user query and optional filters.
    
    Args:
        query: The search query for finding facilities
        location: Optional location to filter results
        insurance: Optional insurance provider to filter results
        
    Returns:
        List of matching facilities with details
    """
    logger.info(f"Searching facilities with query: {query}, location: {location}, insurance: {insurance}")
    
    # This would connect to the actual search service
    # For now, return mock data
    facilities = [
        {
            "id": "1",
            "name": "Recovery Center of Excellence",
            "location": "Los Angeles, CA",
            "insurance": ["Aetna", "Blue Cross", "Cigna"],
            "treatments": ["Detox", "Inpatient", "IOP"],
            "rating": 4.8,
        },
        {
            "id": "2",
            "name": "Serenity Treatment Center",
            "location": "San Diego, CA",
            "insurance": ["Blue Cross", "United Healthcare"],
            "treatments": ["Outpatient", "IOP", "PHP"],
            "rating": 4.6,
        }
    ]
    
    return facilities

@mcp.tool()
async def verify_insurance(provider: str, policy_number: str) -> Dict[str, Any]:
    """
    Verify insurance coverage for addiction treatment services.
    
    Args:
        provider: Insurance provider name
        policy_number: Insurance policy number
        
    Returns:
        Coverage details for addiction treatment
    """
    logger.info(f"Verifying insurance: {provider}, policy: {policy_number}")
    
    # This would connect to the actual insurance verification service
    # For now, return mock data
    coverage = {
        "verified": True,
        "provider": provider,
        "policy_number": policy_number,
        "coverage": {
            "inpatient": "80%",
            "outpatient": "90%",
            "detox": "70%",
            "medication": "Covered with $20 copay"
        },
        "deductible": "$1,500 remaining",
        "out_of_pocket_max": "$5,000 per year"
    }
    
    return coverage

@mcp.tool()
async def intake_assessment(
    name: str, 
    age: int, 
    substance: str, 
    usage_frequency: str,
    previous_treatment: bool = False
) -> Dict[str, Any]:
    """
    Perform an initial intake assessment to determine appropriate level of care.
    
    Args:
        name: Patient name
        age: Patient age
        substance: Primary substance of concern
        usage_frequency: Frequency of substance use
        previous_treatment: Whether patient has had previous treatment
        
    Returns:
        Assessment results and recommendations
    """
    logger.info(f"Performing intake assessment for {name}, age {age}")
    
    # This would connect to the actual assessment service
    # For now, return mock data
    assessment = {
        "risk_level": "Moderate",
        "recommended_care": ["Intensive Outpatient", "Individual Therapy"],
        "asam_criteria": {
            "dimension1": "Minimal risk of withdrawal",
            "dimension2": "No biomedical conditions requiring treatment",
            "dimension3": "Moderate emotional/behavioral conditions",
            "dimension4": "Ready for change",
            "dimension5": "Continued use risk without monitoring",
            "dimension6": "Supportive recovery environment with assistance"
        },
        "next_steps": [
            "Schedule assessment with treatment provider",
            "Gather insurance information",
            "Prepare list of current medications"
        ]
    }
    
    return assessment

# Run the MCP server
if __name__ == "__main__":
    # For local development
    mcp.run(host="0.0.0.0", port=8000)
else:
    # For production with UV
    app = mcp.app 