# Praxis Kerim Server

## 🏥 Overview
Backend API server for Praxis Dr. Kerim medical practice management system. Built with Node.js, Express, and MongoDB.

## ✨ Features

### 🔐 **Authentication & Authorization**
- Admin login with JWT tokens
- Access & refresh token system
- Secure password hashing with bcrypt
- Role-based access control

### 👨‍⚕️ **Doctor Management**
- CRUD operations for doctors
- Specialty and language assignment
- Working hours and availability
- Doctor profiles

### 📅 **Appointment System**
- Create, read, update, delete appointments
- Appointment booking from website
- Status management (scheduled, completed, cancelled)
- Patient information storage
- Doctor-patient assignment

### ⏰ **Availability Management**
- Weekly schedules
- Custom date availability
- Time slot management
- Bulk slot creation
- Integration with appointment booking

### 🎉 **Holiday Management**
- Add public holidays
- Holiday calendar
- Automatic date blocking in booking system
- Holiday descriptions

### 📋 **Orders System**
- Prescription orders (Rezepte)
- Referral orders (Überweisungen)
- Sick note orders (Krankmeldungen)
- Order status tracking
- Patient information
- Detailed order explanations

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Express-validator
- **Security**: bcryptjs, helmet, cors
- **Environment**: dotenv

## 📦 Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Configure MongoDB connection
MONGODB_URI=your_mongodb_connection_string
```

## 🔧 Environment Variables

Create a `.env` file with:

```env
# Server
PORT=3030
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# JWT
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# CORS
FRONTEND_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:5173
```

## 🚀 Usage

```bash
# Development
npm run dev

# Production
npm start

# Create admin user
npm run create-admin
```

## 📚 API Endpoints

### Authentication
```
POST   /api/auth/login              # Admin login
POST   /api/auth/refresh            # Refresh access token
POST   /api/auth/logout             # Logout (clear tokens)
```

### Doctors
```
GET    /api/doctors                 # Get all doctors (public)
GET    /api/doctors/:id             # Get doctor by ID
POST   /api/doctors                 # Create doctor (admin)
PUT    /api/doctors/:id             # Update doctor (admin)
DELETE /api/doctors/:id             # Delete doctor (admin)
```

### Appointments
```
GET    /api/appointments            # Get all appointments (public)
GET    /api/appointments/:id        # Get appointment by ID (public)
POST   /api/appointments            # Book appointment (public)
PATCH  /api/appointments/:id        # Update appointment (admin)
DELETE /api/appointments/:id        # Delete appointment (admin)
```

### Availability
```
GET    /api/availability            # Get availability (public)
GET    /api/availability/:id        # Get specific availability
POST   /api/availability            # Create availability (admin)
PUT    /api/availability/:id        # Update availability (admin)
DELETE /api/availability/:id        # Delete availability (admin)
POST   /api/availability/:id/add-slot    # Add time slot
DELETE /api/availability/:id/remove-slot # Remove time slot
```

### Holidays
```
GET    /api/holidays                # Get all holidays (public)
POST   /api/holidays                # Create holiday (admin)
DELETE /api/holidays/:id            # Delete holiday (admin)
```

### Orders
```
GET    /api/orders                  # Get all orders (admin)
POST   /api/orders                  # Create order (public)
PATCH  /api/orders/:id              # Update order status (admin)
DELETE /api/orders/:id              # Delete order (admin)
```

## 🗄️ Database Models

### Admin
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (admin/superadmin),
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Doctor
```javascript
{
  name: String,
  fachrichtung: String (specialty),
  languages: [String],
  isActive: Boolean,
  isAdmin: Boolean,
  isDoctor: Boolean,
  countriesOfOperation: [String],
  createdAt: Date,
  updatedAt: Date
}
```

### Appointment
```javascript
{
  doctorId: ObjectId (ref: Doctor),
  patientId: ObjectId (optional),
  date: Date,
  slot: String (e.g., "09:00"),
  status: String (scheduled/completed/cancelled),
  title: String,
  description: String,
  notes: String (JSON patient info),
  createdAt: Date,
  updatedAt: Date
}
```

### Availability
```javascript
{
  doctorId: ObjectId (ref: Doctor),
  date: Date,
  slots: [String] (e.g., ["09:00", "09:30"]),
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Holiday
```javascript
{
  date: Date,
  name: String,
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Order
```javascript
{
  patientInfo: {
    vorname: String,
    nachname: String,
    telefon: String,
    email: String,
    strasse: String,
    hausnummer: String,
    plz: String,
    stadt: String,
    versicherungsart: String (gesetzlich/privat),
    versicherungsnummer: String
  },
  orderItems: [{
    type: String (rezept/ueberweisung/krankenschein),
    erlaeuterung: String
  }],
  status: String (neu/in_bearbeitung/erledigt/storniert),
  createdAt: Date,
  updatedAt: Date
}
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **CORS**: Configured for specific origins
- **Helmet**: Security headers
- **Input Validation**: Express-validator
- **Rate Limiting**: (Optional) Can be added
- **MongoDB Injection Protection**: Mongoose schema validation

## 📁 Project Structure

```
telemedker-server/
├── config/
│   └── routes.js           # Centralized route configuration
├── controllers/
│   ├── auth.js             # Authentication logic
│   ├── doctors.js          # Doctor CRUD
│   ├── appointments.js     # Appointment management
│   ├── availability.js     # Availability management
│   ├── holidays.js         # Holiday management
│   └── orders.js           # Orders management
├── models/
│   ├── Admin.js            # Admin user model
│   ├── Doctor.js           # Doctor model
│   ├── Appointment.js      # Appointment model
│   ├── Availability.js     # Availability model
│   ├── Holiday.js          # Holiday model
│   └── Order.js            # Order model
├── middleware/
│   └── auth.js             # JWT authentication middleware
├── services/
│   └── token/
│       └── tokenService.js # Token generation & validation
├── scripts/
│   └── createAdmin.js      # Create admin user script
├── utils/
│   └── appointmentUtils.js # Utility functions
├── index.js                # Server entry point
├── package.json            # Dependencies
└── .env                    # Environment variables
```

## 🔧 Middleware

### Authentication Middleware
```javascript
authenticateToken(req, res, next)
```
- Validates JWT access token
- Attaches decoded user to req.user
- Returns 401 if invalid/expired

## 🎯 Use Cases

### 1. Patient Books Appointment
```
1. Patient visits website
2. Selects doctor and date
3. POST /api/appointments
4. Server creates appointment
5. Returns confirmation
```

### 2. Admin Manages Availability
```
1. Admin logs in
2. Creates weekly schedule
3. POST /api/availability (bulk)
4. Slots become available for booking
```

### 3. Patient Orders Prescription
```
1. Patient fills order form
2. POST /api/orders
3. Order saved with status "neu"
4. Admin sees in dashboard
5. Admin processes order
```

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check connection string
# Ensure IP is whitelisted in MongoDB Atlas
# Verify credentials
```

### JWT Token Errors
```bash
# Clear browser cookies
# Check token expiry times
# Verify JWT_SECRET is set
```

### CORS Errors
```bash
# Add frontend URL to CORS whitelist
# Check FRONTEND_URL and DASHBOARD_URL in .env
```

## 🧪 Testing

```bash
# Manual API testing with curl
curl -X POST http://localhost:3030/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Or use Postman/Insomnia
```

## 📈 Monitoring & Logs

```bash
# Server logs
npm start

# Watch for changes (development)
npm run dev

# Check MongoDB logs
# Access MongoDB Atlas dashboard
```

## 🚀 Deployment

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS
- [ ] Set up MongoDB backup
- [ ] Configure CORS for production domains
- [ ] Set up error logging (e.g., Sentry)
- [ ] Enable rate limiting
- [ ] Set up monitoring (e.g., PM2)

### Deploy to VPS
```bash
# Using PM2
npm install -g pm2
pm2 start index.js --name praxis-kerim-server
pm2 save
pm2 startup
```

## 📄 License

Private - Praxis Dr. Kerim

## 🔗 Related Projects

- **Dashboard**: Praxis-Kerim-Dashboard (Vue.js)
- **Website**: praxis-kerim-website (Next.js)

## 👨‍💻 Developers

Developed for Praxis Dr. Kerim medical practice.

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**API Base URL**: `http://localhost:3030/api`
