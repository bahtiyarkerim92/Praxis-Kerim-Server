# Testing Guide for Daily.co Video Calling

## Current Issue Fix

The issue you encountered was due to strict date filtering in availability. I've made these changes to allow same-day testing:

### Changes Made:

1. **Availability filtering relaxed** - Now shows availability from start of today instead of exact current timestamp
2. **Time slot filtering added** - Filters out slots that have passed, keeping only future slots (10 minutes minimum for testing)
3. **Test endpoint added** - New endpoint to debug timing issues

## Testing Steps

### Step 1: Set Environment Variables

Make sure your `.env` file has:

```env
DAILY_API_KEY=sk_live_your_daily_api_key_here
DAILY_DOMAIN=telemedker.daily.co
```

### Step 2: Restart Server

```bash
cd telemedker-server
npm run dev
```

### Step 3: Test Current Time

Visit: `http://localhost:5000/api/appointments/test/timing`

This will show you:

- Server current time
- Timezone info
- Helps debug timing issues

### Step 4: Create Availability for Testing

Now try creating availability for **13:10** (instead of 13:00) to give yourself more buffer time.

**Doctor Dashboard Steps:**

1. Go to Availability page
2. Select today's date (26.06.2025)
3. Add slot: `13:10`
4. Save availability

### Step 5: Check if Availability Shows Up

**Patient App Steps:**

1. Go to book appointment
2. Select today's date
3. You should now see the 13:10 slot available
4. Select "consultation" plan
5. Book the appointment

### Step 6: Test Video Call Access

**After booking consultation for 13:10:**

1. **Check timing endpoint with appointment ID:**

   ```
   GET http://localhost:5000/api/appointments/test/timing?appointmentId=YOUR_APPOINTMENT_ID
   ```

2. **At 12:50 (20 minutes before):**

   - Check patient dashboard appointments
   - Check doctor dashboard appointments
   - Both should show "Join Meeting" button

3. **Test the video call:**
   - Click "Join Meeting"
   - Should open Daily.co embedded video
   - Test from both patient and doctor sides

## Debugging Commands

### Check Server Logs

```bash
# In telemedker-server directory
tail -f logs/app.log | grep -i "daily\|appointment\|availability"
```

### Test API Endpoints Directly

**Check availability:**

```bash
curl "http://localhost:5000/api/availability?doctorId=YOUR_DOCTOR_ID&date=2025-06-26"
```

**Check specific appointment:**

```bash
curl "http://localhost:5000/api/appointments/YOUR_APPOINTMENT_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Time Settings for Testing

### Current Logic:

- **Availability shows:** From 10 minutes in the future
- **Meeting joinable:** 20 minutes before appointment until 2 hours after
- **Meeting expires:** 3 hours after appointment time

### For Your Test (Current time 12:43):

1. ✅ Create availability for 13:10 (27 minutes away)
2. ✅ Book consultation appointment for 13:10
3. ✅ At 12:50 - "Join Meeting" button appears
4. ✅ At 13:10 - Meeting is active
5. ✅ Until 15:10 - Meeting stays joinable

## Common Issues & Solutions

### Issue: "Meeting URL not available"

- **Check:** DAILY_API_KEY in environment
- **Solution:** Verify Daily.co credentials

### Issue: "Meeting not yet available"

- **Check:** Current time vs appointment time
- **Solution:** Use test endpoint to verify timing

### Issue: Availability not showing

- **Check:** Date/time filtering
- **Solution:** Ensure slot is at least 10 minutes in future

### Issue: Video not loading

- **Check:** Browser console for errors
- **Check:** Daily.co service status
- **Solution:** Test with simple HTML iframe first

## Production Notes

**Before going live, change these settings back:**

1. **Increase minimum booking time:** Change 10 minutes to 30-60 minutes
2. **Add proper timezone handling:** Consider user timezones
3. **Add booking cutoff times:** E.g., no same-day bookings after certain time

## Success Verification

✅ Availability created for today shows up in calendar  
✅ Consultation appointment can be booked  
✅ Daily.co room is created automatically  
✅ "Join Meeting" button appears at correct time  
✅ Video call loads in embedded iframe  
✅ Both patient and doctor can join same room  
✅ Meeting controls work properly

If all these work, your video calling integration is successful! 🎉
