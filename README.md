# SoberBookings.com

SoberBookings.com is a platform connecting people seeking addiction treatment with appropriate facilities based on their needs, location, and insurance coverage.

## Project Overview

This platform uses a hybrid search approach combining private database and web search to provide comprehensive, up-to-date information about treatment facilities. It integrates with Claude for intelligent assistant capabilities and Notion for CMS functionality.

## Key Features

- Intelligent facility search and matching
- Insurance verification
- ASAM criteria-based intake assessment
- Facility verification system
- Admin portal for facility management
- HIPAA-compliant data handling

## Directory Structure

The project follows a monorepo structure:

- `backend/` - API services and business logic
- `frontend/` - User-facing web application
- `admin-portal/` - Admin dashboard for facility management
- `shared/` - Shared utilities, types, and constants
- `infrastructure/` - Deployment and infrastructure code

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourorganization/soberbookings.git
   cd soberbookings
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create an `.env` file in each package directory based on the provided examples.

4. Start the development environment:
   ```
   # Start all services
   npm run dev
   
   # Or start individual services
   npm run dev:frontend
   npm run dev:backend
   npm run dev:admin
   ```

5. The services will be available at:
   - Frontend: http://localhost:3000
   - Admin Portal: http://localhost:3001
   - Backend API: http://localhost:5000
   - MCP Server: http://localhost:8000

## HIPAA Compliance

This application is designed with HIPAA compliance in mind. All PHI is handled according to HIPAA requirements, including:

- Encryption at rest and in transit
- Access controls and authentication
- Audit logging
- Secure backup procedures

## License

MIT 