# Patient Appointment Management System

## Overview

This system allows patients to manage their appointments directly via a unique link sent in their confirmation email. Patients can view, cancel, or reschedule their appointments without logging in.

## Features

- ✅ **Unique Management Link**: Each appointment gets a secure token-based link
- ✅ **View Appointment Details**: Patients can see their appointment information
- ✅ **Cancel Appointment**: Patient-initiated cancellation
- ✅ **Reschedule Appointment**: Select new date/time from available slots
- ✅ **Multilingual Support**: All features available in 5 languages (DE, EN, BG, PL, TR)
- ✅ **Security**: Token-based authentication, no account required
- ✅ **Validation**: Prevents canceling past/completed appointments

## How It Works

### 1. Appointment Creation
When a patient books an appointment:
```javascript
// Generate unique 64-character token
const managementToken = crypto.randomBytes(32).toString("hex");

// Save in appointment
{
  managementToken: "abc123...",
  // ... other fields
}
```

### 2. Email with Management Link
The confirmation email includes a management button:
```
https://praxiskerim.de/termin-verwalten?token=abc123...
```

### 3. Patient Access
- Patient clicks link → No login required
- Token validates appointment access
- Patient can view/cancel/reschedule

## API Endpoints

All endpoints are PUBLIC (no authentication required)

### GET `/api/appointment-management/:token`
Get appointment details by token

**Parameters:**
- `token` (URL param): Management token

**Response:**
```json
{
  "success": true,
  "appointment": {
    "_id": "...",
    "doctorId": { ... },
    "date": "2025-11-10T00:00:00.000Z",
    "slot": "10:30",
    "patientName": "Max Mustermann",
    "patientEmail": "max@example.com",
    "status": "scheduled",
    "locale": "de"
  }
}
```

### PATCH `/api/appointment-management/:token/cancel`
Cancel appointment

**Parameters:**
- `token` (URL param): Management token
- `reason` (body, optional): Cancellation reason

**Request Body:**
```json
{
  "reason": "Kann leider nicht kommen"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully",
  "appointment": {
    "_id": "...",
    "status": "cancelled",
    "cancelledAt": "2025-11-05T10:30:00.000Z"
  }
}
```

### PATCH `/api/appointment-management/:token/reschedule`
Reschedule appointment

**Parameters:**
- `token` (URL param): Management token
- `newDate` (body): New date (YYYY-MM-DD)
- `newSlot` (body): New time slot (HH:MM)
- `newDoctorId` (body, optional): Different doctor ID

**Request Body:**
```json
{
  "newDate": "2025-11-15",
  "newSlot": "14:30"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment rescheduled successfully",
  "appointment": {
    "_id": "...",
    "date": "2025-11-15T00:00:00.000Z",
    "slot": "14:30",
    "status": "scheduled"
  }
}
```

### GET `/api/appointment-management/available-slots/:doctorId`
Get available time slots for rescheduling

**Parameters:**
- `doctorId` (URL param): Doctor ID
- `date` (query): Date (YYYY-MM-DD)

**Request:**
```
GET /api/appointment-management/available-slots/507f1f77bcf86cd799439011?date=2025-11-15
```

**Response:**
```json
{
  "success": true,
  "date": "2025-11-15",
  "doctorId": "...",
  "doctorName": "Dr. Ibrahim Kerim",
  "availableSlots": ["08:00", "08:30", "09:00", ...]
}
```

## Frontend Implementation

The frontend page needs to be created at:
```
praxis-kerim-website/src/app/termin-verwalten/page.tsx
```

### Recommended Structure

```typescript
// app/termin-verwalten/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AppointmentManagementPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      fetchAppointment();
    }
  }, [token]);

  const fetchAppointment = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/appointment-management/${token}`);
      const data = await res.json();
      setAppointment(data.appointment);
    } catch (err) {
      setError('Failed to load appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (reason?: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/appointment-management/${token}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      // Show success message
      fetchAppointment(); // Refresh
    } catch (err) {
      // Handle error
    }
  };

  const handleReschedule = async (newDate: string, newSlot: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/appointment-management/${token}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDate, newSlot }),
      });
      // Show success message
      fetchAppointment(); // Refresh
    } catch (err) {
      // Handle error
    }
  };

  // ... render UI
}
```

### Required UI Components

1. **Appointment Details Card**
   - Doctor name
   - Date and time
   - Status badge
   - Patient information

2. **Cancel Button**
   - Modal for cancellation confirmation
   - Optional reason field
   - Confirmation button

3. **Reschedule Section**
   - Date picker
   - Available slots grid
   - Confirmation button

4. **Status Messages**
   - Success notifications
   - Error handling
   - Loading states

## Security Considerations

### Token Security
- **64-character tokens**: Cryptographically secure
- **Single-use recommended**: Consider invalidating after use (optional)
- **No expiration**: Tokens remain valid (consider adding expiration if needed)

### Validation Rules
1. ❌ Cannot cancel past appointments
2. ❌ Cannot reschedule completed appointments
3. ❌ Cannot reschedule to past dates
4. ❌ Cannot book already-taken slots
5. ✅ Validates time slot availability

### Privacy
- No personal data in URL (only token)
- Token doesn't expose patient information
- Access limited to appointment holder

## Database Schema

### Appointment Model Updates
```javascript
{
  // ... existing fields
  managementToken: {
    type: String,
    unique: true,
    sparse: true,
  },
  cancelledBy: String, // 'admin' or 'patient'
  locale: {
    type: String,
    default: "de",
    enum: ["de", "en", "bg", "pl", "tr"],
  },
}
```

## Email Template Integration

The confirmation email now includes:

```html
<p><strong>Termin verwalten</strong></p>
<p>Sie können Ihren Termin jederzeit absagen oder verschieben:</p>
<a href="https://praxiskerim.de/termin-verwalten?token=...">
  Termin verwalten
</a>
```

Translations available in all 5 languages.

## Environment Variables

Add to `.env`:
```env
# Website URL for management links
WEBSITE_URL="https://praxiskerim.de"

# For testing
TEST_EMAIL="your-test-email@example.com"
```

## Testing

### Backend Testing
```bash
# Test fetching appointment
curl http://localhost:8080/api/appointment-management/YOUR_TOKEN

# Test cancellation
curl -X PATCH http://localhost:8080/api/appointment-management/YOUR_TOKEN/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test cancellation"}'

# Test rescheduling
curl -X PATCH http://localhost:8080/api/appointment-management/YOUR_TOKEN/reschedule \
  -H "Content-Type: application/json" \
  -d '{"newDate": "2025-11-15", "newSlot": "14:30"}'
```

### Frontend Testing
1. Create a test appointment
2. Check confirmation email for management link
3. Click link → Should open management page
4. Test cancel functionality
5. Test reschedule functionality

## Troubleshooting

### "Appointment not found"
- Token is invalid or expired
- Appointment was deleted
- Check URL for complete token

### "Time slot already booked"
- Selected slot is no longer available
- Fetch available slots again
- Choose different time

### "Cannot cancel past appointment"
- Appointment date has passed
- Only future appointments can be cancelled

### Email doesn't have management link
- Check `managementToken` field in database
- Verify `WEBSITE_URL` environment variable
- Check email template includes management section

## Implementation Checklist

### Backend ✅ Complete
- [x] Add `managementToken` field to Appointment model
- [x] Generate token on appointment creation
- [x] Create API endpoints (GET, PATCH cancel, PATCH reschedule)
- [x] Add validation and security checks
- [x] Update email template with management link
- [x] Add translations for all languages

### Frontend 🚧 TODO
- [ ] Create `/termin-verwalten` page
- [ ] Implement appointment details view
- [ ] Add cancel functionality with confirmation modal
- [ ] Add reschedule functionality with date/time picker
- [ ] Add multilingual support (i18n)
- [ ] Add success/error notifications
- [ ] Add loading states
- [ ] Test all functionality

## Next Steps

1. **Create Frontend Page**
   - File: `praxis-kerim-website/src/app/termin-verwalten/page.tsx`
   - Use provided structure above

2. **Style Components**
   - Match existing website design
   - Use TailwindCSS
   - Responsive design

3. **Test Complete Flow**
   - Book appointment
   - Receive email
   - Click management link
   - Cancel/reschedule appointment

4. **Deploy**
   - Test in staging environment
   - Verify email links work in production
   - Monitor for errors

## Support

For questions or issues:
- Check server logs: `tail -f logs/server.log`
- Test API endpoints with Postman/cURL
- Review environment variables
- Contact: info@praxiskerim.de

