# LendBloc: Beginner-Friendly Crypto Lending Platform (Bun + Hono)

LendBloc is a beginner-friendly crypto lending platform that empowers users to put their digital assets to work. Instead of letting crypto sit idle in a wallet, users can securely lend their assets and earn interest—opening up new income opportunities without complex DeFi tools.

This project will be developed using a **modular architecture** powered by **Bun** and the **Hono framework**, ensuring high performance, type safety, and a clear separation of concerns.

## Key Features

### User Account & Security

*   **Onboarding:** Simple registration process using either a phone number or email address.
*   **Authentication:** Secure login with two-factor authentication (2FA) for enhanced security.
*   **Account Recovery:** Straightforward process for account recovery in case of forgotten credentials.
*   **Profile Management:** Users can manage their personal information and security settings.
*   **KYC Verification:** A comprehensive Know Your Customer (KYC) process involving national ID, facial recognition, and address verification to ensure a secure and compliant platform.
*   **Geolocation Check-Up for Compliance System Review:** The platform incorporates geolocation checks to ensure compliance with regional regulations.

### Core Platform Functionality

*   **Dashboard:** A centralized view of the user's portfolio, including active loans, savings, transaction history, and overall asset value.
*   **Crypto Wallet Management:**
    *   **Multi-Asset Support:** Send, receive, and store a variety of cryptocurrencies.
    *   **Transaction Management:** A clear and detailed transaction history.
    *   **Buy & Sell:** Easily buy and sell cryptocurrencies using various payment methods, including Visa, PayPal, and Skrill.
*   **Lending & Borrowing:**
    *   **Get a Loan:** Users can easily get a loan by using their crypto assets as collateral.
    *   **Flexible Loan Terms:** Loan terms can be extended indefinitely.
    *   **Loan Management:** View active loans, track margin calls, and set up alerts.
    *   **Repayment:** Flexible repayment options, including partial or full repayment, with the ability to use external wallets.
*   **Savings:**
    *   **Earn Passive Income:** Users can deposit their crypto into savings accounts to earn interest (APY).
    *   **Flexible Withdrawals:** Withdraw funds at any time with all the interest gained.
    *   **Savings Insights:** Track total savings, rewards earned, and simulate potential earnings with a demo feature.
*   **Crypto Exchange:**
    *   **Seamless Swapping:** Exchange one cryptocurrency for another directly within the platform.
    *   **Coin Voting:** Users can vote for new coins to be listed on the exchange.
*   **Crypto Prices Monitoring:** Real-time monitoring of cryptocurrency prices and market trends.

### User Engagement & Growth

*   **Referral Program:** A robust referral program where users can earn a percentage of their referrals' loan amounts.
*   **Profit Calculator:** A tool to estimate potential earnings from the referral program.
*   **Notification System (Email & SMS):** Real-time notifications for important account activities, such as loan repayments, interest accrual, and security alerts, delivered via email and SMS.

### Administrative Capabilities

*   **Admin Panel:** A comprehensive back-office for administrators to manage the platform.
*   **Super Admin Management:** Functionality for super administrators to manage other administrators, including inviting new admins and defining their roles and permissions.
*   **User Management:** View and manage user accounts, including the ability to restrict accounts or hold transactions.
*   **Loan & Savings Management:** Tools for administrators to oversee and manage all loan and savings activities on the platform.
*   **Transaction Monitoring:** A centralized view of all platform transactions, including loans, savings, and exchanges.
*   **KYC Management:** A dedicated portal for reviewing and managing user KYC submissions.
*   **System Configuration:** Tools for adjusting platform fees, managing coin listings, and monitoring server status.

## Bun + Hono Backend Architecture

## Technology Stack

*   **Runtime**: Bun
*   **Framework**: Hono
*   **Database**: MongoDB with Mongoose
*   **Validation**: Zod
*   **Authentication**: JWT (`@hono/jwt`)

## Development Practices

## Project Status & Feature Checklist

This section will be updated after each task to track the progress of the project.

### `auth` service
- [x] User Registration (`/auth/register`)
- [x] User Login with OTP (`/auth/login`)
- [x] OTP Verification and Token Generation (`/auth/verify-login`)
- [x] Account Recovery OTP Request (`/auth/request-password-reset`)
- [x] Set New Password with OTP (`/auth/set-password`)
- [x] Token Refresh (`/auth/refresh-token`)
- [x] Email Verification (`/auth/verify/email`)
- [x] Phone Verification (`/auth/verify/phone`)
- [x] KYC Initialization (`/auth/initialize-kyc`)
- [x] KYC Status Confirmation (`/auth/verify-kyc`)

### `users` module
- [x] User Profile Management (`/users/profile`)
- [x] KYC Verification (Address, ID, Facial Recognition) and Callback Handling

### `wallets` module
- [x] Wallet Management (`/wallets`)
- [x] Wallet Generation for New Users
- [x] Wallet Initialization Guard

### `lending` module
- [x] Loan Creation (`/lending/loans`)
- [x] Loan Repayment (`/lending/loans/:id/repay`)

### `savings` module
- [x] Savings Account Management (`/savings`)

### `exchange` module
- [x] Crypto Swaps (`/exchange/swap`)
- [x] Coin Voting (`/exchange/vote`)

### `notifications` module
- [x] Send Notifications (`/notifications`)

### `helpers`
- [x] OTP Generation
- [x] JSDoc for Twilio `sendOtp` function
- [x] Shufti Pro Integration (`src/helpers/shufti/index.ts`)

### Email Templates
- [x] Improved UI and UX-centered copy for all email templates
- [x] Email Verification Success Email (`email-verification-success.ts`)

This project will be developed with the following best practices in mind:

*   **Code Quality:** The codebase will be type-safe, modular, and adhere to the Don't Repeat Yourself (DRY) principle to ensure maintainability and reduce redundancy.
*   **Git Workflow:** After each file is modified, it should be committed with a clear and descriptive message. The agent will read the file and provide a commit message for the user to approve.

The backend will be structured as a set of modular routes using Hono. This approach promotes modularity and allows for independent development and scaling of each feature.

*   **`auth` module:** Handles user registration, login, and account recovery.
*   **`users` module:** Manages user profiles, KYC data, and preferences.
*   **`wallets` module:** Core logic for creating and managing user wallets, handling deposits, and withdrawals.
*   **`lending` module:** Implements all logic related to creating, managing, and repaying loans.
*   **`savings` module:** Manages user savings accounts, interest accrual, and distributions.
*   **`exchange` module:** Handles crypto-to-crypto swaps and coin voting.
*   **`notifications` module:** Manages sending emails and SMS messages to users.
*   **`admin` module:** Provides the API for the admin panel to manage the platform.

## Git Repository Root

The Git repository for this project is located at: `/home/timmy/Desktop/Web3Projects/LendBlock/lendbloc_api/`

## Developer Instructions

*   **Role:** You are to act as an expert full-stack developer with over a decade of experience.
*   **Server Status:** The development server is already running. Do not attempt to start or restart it.
*   **Implementation:** Implement the features as described in the documentation to the best of your ability, following all established guidelines and best practices. Be proactive and thorough in your work.
*   **Testing:** Write unit tests for each feature to ensure correctness and facilitate future development. Do not run the tests; I will handle that.
*   **Progress Tracking:** After completing a feature or a significant task, update the "Project Status & Feature Checklist" section in this `GEMINI.md` file to reflect the changes.