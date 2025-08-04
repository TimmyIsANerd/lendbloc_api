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

The Authentication module handles user registration, login, and account recovery. It provides endpoints for:

*   **User Registration:** Create a new user account with either an email or phone number.
*   **User Login:** Log in with an email or phone number and password. This will send an OTP to the user's email or phone.
*   **OTP Verification:** Verify the OTP to complete the login process and receive an access token.
*   **Password Reset:** Request a password reset, which will send an OTP to the user's email or phone.
*   **Set New Password:** Set a new password using the OTP received from the password reset request.