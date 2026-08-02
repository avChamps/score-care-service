# ScoreCare Backend Service Documentation

## Project Overview

ScoreCare Service is the backend API for the ScoreCare credit intelligence platform. It supports mobile app, website, and admin panel workflows for user authentication, credit report access, credit repair, disputes, loans, subscriptions, notifications, content management, and admin operations.

## Technology Stack

- Runtime: Node.js 20+
- Framework: Express.js
- Database: MySQL
- Authentication: JWT token based authentication
- File Uploads: Multer with local or SFTP asset storage
- Notifications: Firebase Cloud Messaging, WhatsApp alerts, email alerts
- Payments: Razorpay
- Credit Bureau Provider: Surepass
- AI Provider: Google Gemini

## Main Features

### User Application Features

- Mobile OTP login and verification
- User profile management
- PAN, full name, email, date of birth, and language update
- Account deletion OTP flow
- Credit score and credit report access
- CIBIL/CRIF report download tracking
- Loan application submission with document uploads
- Loan status tracking
- Credit repair request creation
- Credit repair document upload
- Dispute submission with supporting documents
- Feedback submission
- Notification preferences
- In-app notification listing and read status

### Admin Features

- Admin dashboard counts
- User listing, detail view, and CSV export
- Loan application listing, status update, details download, and CSV export
- Subscription plan management
- Basic plan and subscription management
- Credit repair request management
- Credit repair timeline/content management
- Uploaded credit repair document management
- Dispute management
- Contact request listing
- Feedback listing
- FAQ management
- Announcement management
- Legal content management
- Website settings management
- General app settings management
- Loan option management
- Employee management
- Employee role and permission management
- Employee login event tracking
- Admin notifications
- Admin app notification sending

### Content & Website Features

- FAQ content
- Legal content
- Website settings
- General app settings
- Homepage image themes
- CIBIL repair landing/content sections
- Announcements
- Contact form submissions

## API Base Modules

| Module | Base Path | Purpose |
| --- | --- | --- |
| Health | `/health` | API and database health checks |
| Auth | `/auth` | User/admin OTP, authenticator, logout, permissions |
| Users | `/users`, `/api/users` | User login, profile, preferences, account actions |
| Admin | `/admin` | Admin dashboard and management APIs |
| AI | `/ai` | Gemini chat and streaming responses |
| Credit Reports | `/credit-reports` | Credit score, report data, downloads |
| CIBIL Repair | `/cibil-repair-content` | Repair content, payment order, user repair requests |
| Credit Repair Documents | `/credit-repair`, `/api/credit-repair` | User repair document upload/listing |
| Disputes | `/disputes`, `/api/disputes` | User disputes and dispute documents |
| Loans | `/loans` | Loan options, applications, status |
| Notifications | `/notifications`, `/api/notifications` | Device registration and in-app notifications |
| Subscription Plans | `/subscription-plans` | Public plans and Razorpay subscription flow |
| Feedback | `/feedback` | User feedback |
| Contact | `/contact` | Website contact messages |
| FAQs | `/faqs` | Public FAQs |
| General | `/general` | Public app settings and image themes |
| Legal Content | `/legal-content` | Public legal content |
| Website Settings | `/website-settings` | Public website settings |
| Improve Tool Analytics | `/improve-tool-analytics` | Improve-tool usage analytics |

## Key Integrations

### Surepass

Used for credit bureau report and score APIs, including CIBIL/CRIF report data and PDF report generation.

Required configuration:

- `SUREPASS_BASE_URL`
- `SUREPASS_BEARER_TOKEN`
- `SUREPASS_CIBIL_REPORT_PATH`
- `SUREPASS_CRIF_SCORE_PATH`
- `SUREPASS_CRIF_REPORT_PATH`
- `SUREPASS_CRIF_REPORT_PDF_PATH`
- `SUREPASS_EXPERIAN_REPORT_PDF_PATH`

### Razorpay

Used for subscription payments and CIBIL repair payment orders.

Required configuration:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_BASE_URL`

### MSG91

Used for OTP delivery.

Required configuration:

- `MSG91_AUTH_KEY`
- `MSG91_ENABLED`
- `MSG91_FLOW_ID`
- `MSG91_OTP_LENGTH`
- `MSG91_SEND_SMS_URL`

### Firebase

Used for mobile push notifications.

Required configuration:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### WhatsApp

Used for WhatsApp alerts through Baileys.

Required configuration:

- `WHATSAPP_ALERT_ENABLED`
- `WHATSAPP_ALERT_NUMBER`
- `WHATSAPP_GROUP_JID`
- `WHATSAPP_SESSION_DIR`

### SMTP Email

Used for email alerts.

Required configuration:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_NAME`
- `SMTP_TEST_RECIPIENTS`

### Gemini

Used for AI assistant responses.

Required configuration:

- `GEMINI_API_KEY`
- `GEMINI_BASE_URL`
- `GEMINI_MODEL`
- `GEMINI_MAX_ATTEMPTS`
- `GEMINI_RETRY_DELAY_MS`

## Database

The application uses MySQL with migration files located in `database/migrations`.

Main database areas:

- Users and login events
- Admins and employee access
- Employee roles and permissions
- Subscription plans and payment records
- Credit reports and report downloads
- Credit bureau API hit logs
- CIBIL repair requests and timelines
- Credit repair documents
- Loan applications and loan options
- Disputes and dispute remarks
- Notifications and notification logs
- Feedback and contact messages
- FAQs, announcements, legal content, website settings, and general settings

Migration command:

```bash
npm run db:migrate
```

## File Storage

Uploaded assets can be stored locally or through SFTP.

Supported storage configuration:

- `ASSETS_STORAGE_DRIVER`
- `ASSETS_ROOT_DIR`
- `ASSETS_PUBLIC_BASE_URL`
- `ASSETS_SFTP_HOST`
- `ASSETS_SFTP_PORT`
- `ASSETS_SFTP_USERNAME`
- `ASSETS_SFTP_PASSWORD`
- `ASSETS_SFTP_PRIVATE_KEY_PATH`
- `ASSETS_SFTP_ROOT_DIR`

Public uploaded files are served from the configured public asset base URL.

## Authentication & Security

- User and admin protected APIs use Bearer token authentication.
- JWT secret is configured through `JWT_SECRET`.
- Admin APIs require admin access validation.
- Employee role APIs support role based access control.
- Helmet is enabled for standard HTTP security headers.
- CORS is enabled for credentialed requests.
- Uploaded document limits are handled through route specific upload middleware.

## Scheduled Jobs

The service starts notification scheduling when the API server starts.

Configured jobs:

- Daily notification reminders
- Monthly CIBIL report update notifications

Relevant configuration:

- `DAILY_NOTIFICATION_REMINDER_CRON`
- `MONTHLY_CIBIL_NOTIFICATION_ENABLED`
- `MONTHLY_CIBIL_NOTIFICATION_CRON`
- `NOTIFICATION_REMINDERS_ENABLED`
- `NOTIFICATION_TIMEZONE`

Manual monthly CIBIL notification command:

```bash
npm run notifications:cibil-monthly
```

## Available Scripts

```bash
npm run dev
npm start
npm run db:migrate
npm run health
npm run notifications:cibil-monthly
npm run whatsapp:connect
```

## Health Checks

```http
GET /health
GET /health/db
```

These endpoints can be used by deployment monitoring, load balancers, or uptime tools.

## Deployment Notes

- Node.js version should be 20 or above.
- MySQL database must be available before starting production usage.
- Required environment variables should be configured before deployment.
- Migrations should be executed after code deployment when database changes are included.
- Asset storage should be configured as either local server storage or SFTP storage.
- Razorpay webhook URL should point to `/subscription-plans/razorpay/webhook`.
- WhatsApp session setup requires running the WhatsApp connection script once.
- Firebase credentials are required for push notifications.

## Client Handover Summary

This backend is production-oriented and includes the core APIs required for the ScoreCare platform:

- User onboarding and profile management
- Credit score/report workflows
- Loan application workflows
- Credit repair and dispute workflows
- Subscription and payment workflows
- Notifications across app, WhatsApp, and email
- Admin panel management APIs
- Dynamic content and website settings APIs
- Database migrations and health checks

