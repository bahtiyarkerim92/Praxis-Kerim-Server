# Environment Setup

Create a `.env` file in the telemedker-server root directory with the following configuration:

```env
# Database
DB_CONNECTION_STRING=mongodb://localhost:27017/telemedker

# JWT Secrets for Patients
ACCESS_TOKEN_SECRET=your_access_token_secret_here_make_it_long_and_secure
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here_make_it_different_and_secure

# JWT Secret for Doctors (can be same as ACCESS_TOKEN_SECRET if preferred)
DOCTOR_JWT_SECRET=your_doctor_jwt_secret_here_make_it_long_and_secure

# Server Configuration
PORT=8000
NODE_ENV=development

# CORS Configuration
CLIENT_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:5173

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# AWS S3 Configuration (optional)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-central-1
AWS_S3_BUCKET=your-bucket-name
```

## Quick Setup for Development

1. Install dependencies:

```bash
cd telemedker-server
npm install
```

2. Set up MongoDB (either local or MongoDB Atlas)

3. Copy the environment configuration above into a `.env` file

4. Generate secure JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

5. Run the server:

```bash
npm run dev
```

## Frontend Configuration

For the Nuxt client, create a `.env` file in `Telemedker-Client/`:

```env
BASE_URL=http://localhost:3030
SITE_URL=http://localhost:3000
```

For the Vue dashboard, create a `.env` file in `telemedker-dashboard/`:

```env
VITE_API_URL=http://localhost:3030
```

## Database Seeding

To populate the database with sample doctors and availability:

```bash
cd telemedker-server
```

This will create:

- Sample doctors
- Availability slots for the next 30 days
- Ready-to-use test data

## API Endpoints

The server provides these main endpoints:

- `GET /api/doctors` - List all active doctors
- `GET /api/availability?doctorId=xxx` - Get doctor availability
- `POST /api/appointments` - Book an appointment (requires patient auth)
- `GET /api/appointments?doctorId=xxx` - Get doctor appointments (requires doctor auth)

## Authentication

- Patients use `/auth/login` and `/auth/register`
- Doctors use `/api/doctor-auth/login`
- JWT tokens are required for booking and viewing appointments
