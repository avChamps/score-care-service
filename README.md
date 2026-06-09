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
- `POST /ai/gemini/stream` streams a Google AI Studio Gemini answer over SSE.
- `POST /credit-reports/cibil` validates user details and fetches a Surepass CIBIL report.
- `POST /loans/apply` creates a loan application with document uploads.
- `GET /notifications` lists notifications for the authenticated user.
- `POST /notifications/:notificationId/read` marks one notification as read.
- `POST /notifications/read-all` marks all authenticated user notifications as read.
- `POST /users/login` creates or updates a user and stores a login event.
- `PATCH /users/me/profile` updates PAN and full name for the logged-in user.
- `GET /users/:userId/login-events` lists login history for a user.

Example Gemini SSE request:

```bash
curl -N -X POST http://localhost:5000/ai/gemini/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain credit utilization in simple words"}'
```

The SSE stream emits `metadata`, `chunk`, `done`, and `error` events. Append
each `chunk` event's `text` value in the frontend to render the answer while
Gemini is generating it.

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
Set `MSG91_ENABLED=false` to skip MSG91 sending temporarily and return a mock
send response. In that mode, verify login with `MSG91_TEST_OTP`.
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

Example loan application payload uses `multipart/form-data` and requires a
Bearer token. Uploaded files are stored under
`{public_id}/files/` inside the configured assets root and returned as public
asset URLs.

For direct VPS uploads from this API server, configure SFTP credentials in
`.env`:

```env
ASSETS_STORAGE_DRIVER=sftp
ASSETS_PUBLIC_BASE_URL=https://scorecareapp.com/assets
ASSETS_SFTP_HOST=your-vps-host
ASSETS_SFTP_PORT=22
ASSETS_SFTP_USERNAME=your-vps-user
ASSETS_SFTP_PASSWORD=your-vps-password
ASSETS_SFTP_PRIVATE_KEY_PATH=
ASSETS_SFTP_ROOT_DIR=/var/www/scorecare-assets
```

If the API is running on the same VPS, use `ASSETS_STORAGE_DRIVER=local` and
`ASSETS_ROOT_DIR=/var/www/scorecare-assets` instead.

Fields:

- `loanAmount`
- `loanType`
- `employmentType`
- `monthlyIncome`
- `workExperience`
- `salarySlips` up to 8 image/PDF files
- `bankStatements` up to 3 image/PDF files
- `aadhaarCard` up to 2 image/PDF files
- `panCard` up to 2 image/PDF files

```bash
curl -X POST http://localhost:5000/loans/apply \
  -H "Authorization: Bearer your_token_here" \
  -F "loanAmount=500000" \
  -F "loanType=personal" \
  -F "employmentType=salaried" \
  -F "monthlyIncome=75000" \
  -F "workExperience=5" \
  -F "salarySlips=@salary-slip.pdf" \
  -F "bankStatements=@bank-statement.pdf" \
  -F "aadhaarCard=@aadhaar-front.pdf" \
  -F "panCard=@pan-card.pdf"
```

## Notifications

Loan applications automatically create a `loan_applied` notification for the
authenticated user.

Monthly CIBIL report notifications are scheduled by default for 9:00 AM on the
1st day of every month in `Asia/Kolkata`.

```env
MONTHLY_CIBIL_NOTIFICATION_ENABLED=true
MONTHLY_CIBIL_NOTIFICATION_CRON=0 9 1 * *
NOTIFICATION_TIMEZONE=Asia/Kolkata
```

The monthly job creates one `cibil_report_updated` notification per user with a
saved Surepass CIBIL report. Duplicate monthly notifications are prevented by a
unique notification key.

Run the monthly job manually:

```bash
npm run notifications:cibil-monthly
```

Get notifications:

```http
GET /notifications?limit=20&offset=0&unreadOnly=false
Authorization: Bearer your_token_here
```

Mark one notification as read:

```http
POST /notifications/123/read
Authorization: Bearer your_token_here
```

Mark all notifications as read:

```http
POST /notifications/read-all
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
