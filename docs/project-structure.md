# SoberBookings.com Project Structure

This document outlines the recommended project structure for SoberBookings.com, incorporating the hybrid search approach and integrating with Claude Desktop and Notion MCP.

## Directory Structure

```
soberbookings/
├── .github/                      # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml                # CI pipeline
│       └── deploy.yml            # Deployment pipeline
├── backend/                      # Backend API services
│   ├── src/
│   │   ├── api/                  # API endpoints
│   │   │   ├── facilities/       # Facility search & management APIs
│   │   │   ├── insurance/        # Insurance verification APIs
│   │   │   └── intake/           # Intake assessment APIs
│   │   ├── config/               # Configuration files
│   │   ├── db/                   # Database models and migrations
│   │   ├── services/             # Business logic services
│   │   │   ├── search/           # Search engine components
│   │   │   │   ├── database.js   # Private database search
│   │   │   │   ├── web.js        # Web search component
│   │   │   │   └── hybrid.js     # Combined search logic
│   │   │   ├── verification/     # Facility verification logic
│   │   │   └── matching/         # ASAM-based matching algorithms
│   │   ├── integrations/         # Third-party integrations
│   │   │   ├── notion/           # Notion CMS integration
│   │   │   ├── claude/           # Claude MCP integration
│   │   │   └── search-api/       # Web search API integrations
│   │   └── utils/                # Utility functions
│   ├── tests/                    # Backend tests
│   ├── package.json
│   └── README.md
├── frontend/                     # Frontend application
│   ├── public/                   # Static assets
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   │   ├── search/           # Search interface components
│   │   │   ├── results/          # Search results display
│   │   │   └── facility/         # Facility information components
│   │   ├── pages/                # Main application pages
│   │   │   ├── home/             # Homepage
│   │   │   ├── search/           # Search interface
│   │   │   ├── facility/         # Facility details
│   │   │   ├── intake/           # Intake assessment
│   │   │   └── admin/            # Admin dashboard
│   │   ├── services/             # Frontend services
│   │   ├── styles/               # CSS/styling files
│   │   └── utils/                # Utility functions
│   ├── package.json
│   └── README.md
├── admin-portal/                 # Admin portal for facility management
│   ├── src/
│   │   ├── components/           # Admin UI components
│   │   ├── pages/                # Admin pages
│   │   │   ├── dashboard/        # Admin dashboard
│   │   │   ├── facilities/       # Facility management
│   │   │   ├── verification/     # Verification workflow
│   │   │   └── analytics/        # Analytics dashboard
│   ├── package.json
│   └── README.md
├── shared/                       # Shared code/types
│   ├── models/                   # Shared data models
│   ├── constants/                # Shared constants
│   └── utils/                    # Shared utilities
├── infrastructure/               # Infrastructure as code
│   ├── terraform/                # Terraform configs
│   ├── docker/                   # Docker configurations
│   │   ├── docker-compose.yml    # Local development
│   │   └── Dockerfile            # Production build
├── scripts/                      # Utility scripts
│   ├── setup.sh                  # Project setup script
│   └── seed-data.js              # Database seeding script
├── docs/                         # Documentation
│   ├── api/                      # API documentation
│   ├── architecture/             # Architecture docs
│   └── hipaa/                    # HIPAA compliance docs
├── .env.example                  # Example environment variables
├── .gitignore                    # Git ignore file
├── package.json                  # Root package.json
├── README.md                     # Project README
└── LICENSE                       # MIT License
```

## Technology Stack

### Backend
- **Framework**: Node.js with Express
- **Database**: PostgreSQL for primary data storage
- **Search Engine**: Elasticsearch or Algolia
- **Integration**: Notion API, Claude API
- **Authentication**: OAuth2.0 + JWT

### Frontend
- **Framework**: Next.js with React
- **Styling**: Tailwind CSS
- **State Management**: React Context or Redux
- **UI Components**: Custom components with accessibility

### Admin Portal
- **Framework**: Next.js with React
- **Dashboard**: Custom admin dashboard

### Infrastructure
- **Hosting**: AWS or Azure (HIPAA-compliant)
- **CI/CD**: GitHub Actions
- **Containerization**: Docker
- **Monitoring**: Datadog or New Relic

## Development Workflow

1. Setup local development environment
2. Develop backend API endpoints
3. Implement search and matching algorithms
4. Create frontend user interfaces
5. Integrate with Notion and Claude
6. Implement verification workflows
7. Deploy to staging and test
8. Deploy to production

## HIPAA Compliance Considerations

- Data encryption at rest and in transit
- Access control and authentication
- Audit logging
- Backup and disaster recovery
- PHI handling procedures
- Business Associate Agreements with vendors
