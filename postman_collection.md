# LendBloc API Postman Collection

This Postman collection provides a comprehensive set of requests to interact with the LendBloc API. LendBloc is a beginner-friendly crypto lending platform that empowers users to put their digital assets to work. Instead of letting crypto sit idle in a wallet, users can securely lend their assets and earn interest—opening up new income opportunities without complex DeFi tools.

## Getting Started

To use this collection, you will need to have the Postman app installed. You can download it from the [Postman website](https://www.postman.com/downloads/).

### Importing the Collection and Environment

1.  **Download the Collection and Environment:**
    *   [Download the LendBloc API Postman Collection](https://www.postman.com/collections/your-collection-id)
    *   [Download the LendBloc API Postman Environment](https://www.postman.com/environments/your-environment-id)

2.  **Import into Postman:**
    *   Open the Postman app and click on the "Import" button in the top-left corner.
    *   Select the downloaded collection and environment files to import them into your workspace.

### Configuration

The LendBloc API uses a Postman environment to manage variables such as the base URL, authentication tokens, and other sensitive data. Before you can start making requests, you will need to configure the environment with your own credentials.

1.  **Open the Environment:**
    *   In the top-right corner of the Postman app, select the "LendBloc API" environment from the dropdown menu.
    *   Click on the "eye" icon to view the environment variables.

2.  **Set the Variables:**
    *   `baseUrl`: The base URL of the LendBloc API.
    *   `authToken`: Your authentication token.
    *   `adminToken`: Your admin authentication token.

## API Documentation

The LendBloc API is organized into the following modules:

*   **`auth` module:** Handles user registration, login, and account recovery.
*   **`users` module:** Manages user profiles, KYC data, and preferences.
*   **`wallets` module:** Core logic for creating and managing user wallets, handling deposits, and withdrawals.
*   **`lending` module:** Implements all logic related to creating, managing, and repaying loans.
*   **`savings` module:** Manages user savings accounts, interest accrual, and distributions.
*   **`exchange` module:** Handles crypto-to-crypto swaps and coin voting.
*   **`notifications` module:** Manages sending emails and SMS messages to users.
*   **`admin` module:** Provides the API for the admin panel to manage the platform.

For more information on each endpoint, please refer to the individual requests in the collection.

## Authentication

The Authentication module is responsible for managing user access to the LendBloc platform. It provides a secure and seamless experience for users to register, log in, and recover their accounts. The module uses a combination of email/phone and password authentication, along with a one-time password (OTP) system for enhanced security.

### Endpoints

The Authentication module provides the following endpoints:

*   **User Registration:** `POST /api/v1/auth/register`
*   **User Login:** `POST /api/v1/auth/login`
*   **OTP Verification:** `POST /api/v1/auth/verify-login`
*   **Password Reset:** `POST /api/v1/auth/request-password-reset`
*   **Set New Password:** `POST /api/v1/auth/set-password`

### Logic Explanation for Front-End Developers

#### User Registration

When a user registers, the `registerUser` function is called. This function first checks if a user with the same email, phone number, or social issuance number already exists. If so, it returns a `409 Conflict` error. Otherwise, it creates a new user and a default Bitcoin wallet for them. The response will be a `200 OK` with a success message and the new user's ID.

#### User Login

The `loginUser` function handles the login process. It first checks if the user has provided either an email or a phone number. If not, it returns a `400 Bad Request` error. It then checks if the user exists and if the password is correct. If the credentials are valid, it generates a 6-digit OTP and sends it to the user's email or phone. The response will be a `200 OK` with a message indicating that an OTP has been sent.

#### OTP Verification

Once the user receives the OTP, they need to send it back to the server for verification. The `verifyLogin` function handles this process. It first checks if the user has provided either an email or a phone number. If not, it returns a `400 Bad Request` error. It then checks if the user exists and if the OTP is valid and has not expired. If the OTP is valid, it generates an access token and a refresh token. The access token is sent in the response body, and the refresh token is sent as an HTTP-only cookie. The response will be a `200 OK` with the access token.

#### Password Reset

If the user forgets their password, they can request a password reset. The `requestPasswordReset` function handles this process. It first checks if the user has provided either an email or a phone number. If not, it returns a `400 Bad Request` error. It then checks if the user exists. If so, it generates a 5-digit OTP and sends it to the user's email or phone. The response will be a `200 OK` with a message indicating that a password reset has been requested.

#### Set New Password

Once the user receives the OTP for the password reset, they can set a new password. The `setPassword` function handles this process. It first checks if the user has provided either an email or a phone number. If not, it returns a `400 Bad Request` error. It then checks if the user exists and if the OTP is valid and has not expired. It also checks if the new password is the same as the old password. If all the checks pass, it updates the user's password and returns a `200 OK` with a success message.