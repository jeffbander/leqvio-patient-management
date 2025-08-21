# LEQVIO Patient Management System

A comprehensive patient management system for LEQVIO cardiovascular care, featuring e-signature workflows, OCR document processing, and clinical automation.

## Features

- **Patient Management**: Complete patient database with demographics, insurance, and clinical data
- **E-Signature Forms**: Digital LEQVIO enrollment forms with signature capture
- **Document Processing**: OCR extraction from insurance cards, Epic screenshots, and medical documents
- **PDF Generation**: Automated LEQVIO form generation with patient data
- **Automation Integration**: AIGENTS workflow automation and webhook processing
- **Multi-Organization Support**: Manage multiple healthcare organizations
- **Clinical Documentation**: Notes, voicemails, and authorization tracking

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, TanStack Query
- **Backend**: Express.js, PostgreSQL with Drizzle ORM
- **Services**: OpenAI (OCR), SendGrid (email), Google Cloud Storage

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- OpenAI API key
- SendGrid account (for email functionality)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd leqvio-2
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Set up database:**
   ```bash
   # Create PostgreSQL database
   createdb leqvio
   
   # Run database migrations
   npm run db:push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   The app will be available at http://localhost:3000

### Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for OCR processing
- `SENDGRID_API_KEY`: SendGrid API key for email delivery
- `SESSION_SECRET`: Secure session secret for authentication

Optional:
- `PORT`: Server port (default: 3000)
- `AIGENTS_WEBHOOK_URL`: External automation webhook endpoint
- `GOOGLE_CLOUD_STORAGE_BUCKET`: GCS bucket for file storage

## Production Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Database Setup

1. Set up PostgreSQL database (recommend managed service like Neon, Supabase, or AWS RDS)
2. Update `DATABASE_URL` in production environment
3. Run migrations: `npm run db:push`

### Security Considerations

- Use strong `SESSION_SECRET` (32+ random characters)
- Enable SSL for database connections in production
- Set up proper CORS policies
- Configure rate limiting for API endpoints
- Use environment variables for all sensitive data

## API Endpoints

### Patients
- `GET /api/patients` - List patients with filtering
- `POST /api/patients` - Create new patient
- `PUT /api/patients/:id` - Update patient
- `POST /api/patients/create-from-upload` - Create patient from document

### Documents
- `POST /api/patients/:id/documents` - Upload and process documents
- `POST /api/extract-patient-info` - OCR extraction endpoint

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/register` - User registration

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Apply database schema changes

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilities
├── server/                # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes
│   ├── db.ts             # Database connection
│   └── *.ts              # Service modules
├── shared/               # Shared types and schemas
└── attached_assets/      # File uploads and assets
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details