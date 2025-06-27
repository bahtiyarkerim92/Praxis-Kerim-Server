# Daily.co Video Calling Setup

This document explains how to set up Daily.co video calling for the Telemedker application.

## Prerequisites

1. Daily.co account with API access
2. Daily.co domain set up (e.g., `telemedker.daily.co`)
3. Daily.co API key (starts with `sk_live_` for production or `sk_test_` for testing)

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Daily.co Configuration for Video Calls
DAILY_API_KEY=sk_live_your_daily_api_key_here
DAILY_DOMAIN=telemedker.daily.co
```

## How it Works

### Appointment Creation

1. When a patient books a consultation appointment, the server automatically creates a Daily.co room
2. The room name and URL are stored in the appointment document
3. Rooms are configured to expire 3 hours after the appointment time

### Meeting Access

1. Both patients and doctors can join the meeting 20 minutes before the scheduled time
2. Meetings remain accessible for 2 hours after the start time
3. Access is restricted to the specific patient and doctor for each appointment

### Database Schema

The `Appointment` model has been extended with:

- `meetingRoomName`: Unique room identifier (e.g., "telemedker-consult-uuid")
- `meetingUrl`: Full Daily.co room URL
- `isJoinable`: Computed field indicating if the meeting can be joined now
- `minutesUntilJoinable`: Minutes until the meeting becomes available
- `hasPassed`: Whether the meeting window has closed

## Client Integration

### Patient App (Nuxt 3)

- Appointment list shows "Join Meeting" button when available
- Meeting page at `/dashboard/meeting/[id]` embeds Daily.co iframe
- Automatic redirect after leaving meeting

### Doctor Dashboard (Vue 3)

- Similar "Join Meeting" functionality in appointments table
- Meeting page at `/meeting/[id]` with doctor-specific interface
- Integration with existing doctor authentication

## API Endpoints

### GET /api/appointments

Returns appointments with computed meeting status:

```json
{
  "_id": "...",
  "plan": "consultation",
  "meetingUrl": "https://telemedker.daily.co/telemedker-consult-uuid",
  "isJoinable": true,
  "minutesUntilJoinable": -5,
  "hasPassed": false
}
```

### GET /api/appointments/:id

Returns individual appointment with meeting details for joining.

## Security Considerations

1. **Room Privacy**: Rooms are created as 'public' but with unique, unguessable names
2. **Access Control**: Server validates user permissions before returning meeting URLs
3. **Time Restrictions**: Meetings are only joinable within the specified time window
4. **Automatic Cleanup**: Rooms expire automatically after the meeting window

## Testing

To test the integration:

1. Create a consultation appointment for 1 hour from now
2. Wait until 20 minutes before the appointment time
3. Check that "Join Meeting" button appears for both patient and doctor
4. Click to join and verify Daily.co iframe loads correctly
5. Test that meeting ends properly when users leave

## Troubleshooting

### Common Issues

1. **"Meeting URL not available"**: Check that DAILY_API_KEY is set and valid
2. **"Meeting not yet available"**: Verify appointment time and ensure it's within the 20-minute window
3. **Daily.co iframe not loading**: Check network connectivity and Daily.co service status
4. **Permission denied**: Ensure user is authenticated and owns the appointment

### Logs

Check server logs for Daily.co API errors:

```bash
grep "Daily.co" logs/app.log
```

## Daily.co Dashboard

Monitor usage and manage rooms at: https://dashboard.daily.co

## Support

For Daily.co API documentation: https://docs.daily.co/reference/api
