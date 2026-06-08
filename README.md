# ScoreCare Service

Node.js backend API setup for the SCORECARE app.

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Update `.env` with your local database credentials before starting the server.

## Database

Create the database once:

```sql
CREATE DATABASE scorecare;
```

The service uses a MySQL connection pool from `mysql2/promise`.

Run migrations:

```bash
npm run db:migrate
```

## Scripts

- `npm run dev` starts the API with Node watch mode.
- `npm start` starts the API normally.
- `npm run db:migrate` creates or updates database tables.
- `npm run health` calls the local health endpoint.
- `npm run whatsapp:connect` prints a WhatsApp QR code for Baileys login.

## Endpoints

- `GET /health` checks API uptime.
- `GET /health/db` checks database connectivity.
- `POST /auth/send-otp` sends a mobile OTP through MSG91.
- `POST /auth/verify-otp` verifies OTP through MSG91 and returns an app token.
- `POST /ai/gemini` sends a message to Google AI Studio Gemini and returns the answer.
- `POST /credit-reports/cibil` validates user details and fetches a Surepass CIBIL report.
- `POST /users/login` creates or updates a user and stores a login event.
- `PATCH /users/me/profile` updates PAN and full name for the logged-in user.
- `GET /users/:userId/login-events` lists login history for a user.

When OTP verification or `/users/login` creates a new user, the service can send
a WhatsApp account creation alert through Baileys. Existing-user logins send a
WhatsApp login alert. Set `WHATSAPP_ALERT_ENABLED=true`, configure
`WHATSAPP_ALERT_NUMBER` if alerts should go to an admin number instead of the
user, then run `npm run whatsapp:connect` once to pair the Baileys session.
When `/users/me/profile` updates a user with an email address, the service sends
a profile update email alert through the hardcoded GoDaddy SMTP transport.

Example OTP payload:

```json
{
  "mobileNumber": "9876543210"
}
```

For backend OTP sending, set `MSG91_TEMPLATE_ID` from the MSG91 OTP section.
The service sends `MSG91_OTP_LENGTH=6` as `otp_length=6` to MSG91.
`/auth/verify-otp` accepts `MSG91_TEST_OTP=123456` or verifies the OTP with
MSG91 before returning an app token.

Example verify OTP payload:

```json
{
  "mobileNumber": "9876543210",
  "otp": "123456"
}
```

Use the returned token on protected APIs:

```http
Authorization: Bearer your_token_here
```

Example CIBIL report payload:

```http
POST /credit-reports/cibil
Authorization: Bearer your_token_here
Content-Type: application/json
```

Example Gemini payload:

```http
POST /ai/gemini
Content-Type: application/json
```

```json
{
  "message": "Explain credit utilization in simple words"
}
```

Set `GEMINI_API_KEY` from Google AI Studio before using this endpoint.

```json
{
  "mobileNumber": "9876543210",
  "panNumber": "ABCDE1234F",
  "fullName": "Rahul Sharma",
  "gender": "male",
  "consent": "Y"
}
```

The first successful CIBIL call is saved against the authenticated user. Later
calls to `POST /credit-reports/cibil` return the saved report from the database
instead of calling Surepass again.

Example update profile payload:

```http
PATCH /users/me/profile
Authorization: Bearer your_token_here
Content-Type: application/json
```

```json
{
  "panNumber": "ABCDE1234F",
  "fullName": "Rahul Sharma",
  "email": "rahul@example.com",
  "dateOfBirth": "1995-08-21"
}
```

Example login payload:

```json
{
  "mobileNumber": "9876543210",
  "panNumber": "ABCDE1234F",
  "fullName": "Rahul Sharma",
  "email": "rahul@example.com",
  "dateOfBirth": "1995-08-21",
  "loginMethod": "otp",
  "deviceId": "android-device-id"
}
```
# score-care-service
