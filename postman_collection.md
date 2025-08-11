# LendBloc Authentication Module API Documentation

## Introduction

This document provides a comprehensive guide to integrating with the LendBloc Authentication Module API. This module handles all user authentication-related functionalities, including user registration, login, OTP verification, password reset, and token management. The API is designed to be secure and efficient, utilizing JWT for authentication and refresh tokens for session management.

## Frontend Developer Integration Guide

This section outlines the steps and best practices for frontend developers to integrate with the LendBloc Authentication Module.

### 1. Base URL

All authentication API endpoints are prefixed with `/api/v1/auth`.

### 2. User Registration (`POST /register`)

This endpoint allows new users to create an account on the LendBloc platform. Upon successful registration, the system will automatically initialize a crypto wallet for the user and send an email verification OTP to the provided email address. Developers should guide users to check their email for the OTP to proceed with email verification, which is a prerequisite for full account activation.

*   **Success Response (200 OK):**
    ```json
    {
      "message": "User registered successfully",
      "userId": "60d5ec49f8c7a1b2c3d4e5f6"
    }
    ```
*   **Error Responses:**
    *   `409 Conflict`: If a user with the provided email or phone number already exists.
    *   `400 Bad Request`: For validation errors (e.g., invalid email format, weak password).

### 3. Email Verification (`POST /verify/email`)

This endpoint is used to confirm the user's email address. After a user registers, an OTP is sent to their email. The developer should prompt the user to enter this OTP. The system verifies the OTP against the stored one for the user. If the OTP is valid and not expired, the user's email is marked as verified, allowing them to proceed with other platform functionalities. If the email is already verified, an appropriate error is returned.

*   **Success Response (200 OK):**
    ```json
    {
      "message": "Email verified successfully"
    }
    ```
*   **Error Responses:**
    *   `404 Not Found`: User not found.
    *   `400 Bad Request`: Invalid or expired OTP, or email already verified.

### 4. Phone Number Verification (`POST /send/phone` and `POST /verify/phone`)

These endpoints manage the verification of a user's phone number. First, `POST /send/phone` is called to request an OTP to be sent to the user's provided phone number. A rate limit is applied to prevent abuse. Once the OTP is received by the user, `POST /verify/phone` is used to submit the OTP for verification. Upon successful verification, the user's phone number is marked as verified in the system. Developers should ensure the phone number is in E.164 format.

*   **`POST /send/phone` Success Response (200 OK):**
    ```json
    {
      "message": "An OTP has been sent to your phone number."
    }
    ```
*   **`POST /verify/phone` Success Response (200 OK):**
    ```json
    {
      "message": "Phone number verified successfully"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid phone number format, invalid or expired OTP, phone number already verified, or phone number does not match.
    *   `429 Too Many Requests`: If too many OTP requests are made within a short period.

### 5. User Login (`POST /login`)

This endpoint initiates the login process. Users can provide either their email or phone number along with their password. The system authenticates the user's credentials. If successful, an OTP is generated and sent to the user's registered email or phone number (depending on the provided identifier). This OTP is required for the final step of the login process via the `/verify-login` endpoint. Developers should inform users to expect an OTP for the next step.

*   **Success Response (200 OK):**
    ```json
    {
      "message": "An OTP has been sent to your email/phone."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If both email and phone are provided, or neither is provided.
    *   `401 Unauthorized`: Invalid credentials, or user not verified (email/phone).

### 6. Verify Login OTP (`POST /verify-login`)

This endpoint completes the user login process by verifying the OTP sent to the user. Upon successful OTP verification, the system generates and returns an access token and a refresh token. For web clients, the refresh token is securely set as an `httpOnly` cookie, while for mobile clients, both tokens are returned in the response body. Developers should store these tokens appropriately for subsequent authenticated requests and session management.

*   **Success Response (200 OK - Web Client):**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
    *   **Note:** For web clients, the `refreshToken` is set as an `httpOnly` cookie.
*   **Success Response (200 OK - Mobile Client):**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If both email and phone are provided, or neither is provided, or invalid/expired OTP.
    *   `404 Not Found`: User not found.

### 7. Request Password Reset (`POST /request-password-reset`)

This endpoint allows users to initiate the password reset process. By providing their registered email, the system sends a password reset OTP to that email address. A rate limit is in place to prevent excessive requests. Developers should inform the user to check their email for the OTP, which will be used in the `set-password` endpoint.

*   **Success Response (200 OK):**
    ```json
    {
      "message": "Password reset requested. Check your email/phone for OTP."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Email is required.
    *   `404 Not Found`: User not found.
    *   `429 Too Many Requests`: If too many password reset requests are made within a short period.

### 8. Set New Password (`POST /set-password`)

This endpoint is used to finalize the password reset process. After receiving an OTP from the `request-password-reset` endpoint, the user provides their email, the OTP, and their new password. The system verifies the OTP and updates the user's password. It prevents setting the new password to be the same as the old one for security reasons. Upon successful update, the OTP is invalidated.

*   **Success Response (200 OK):**
    ```json
    {
      "message": "Password set successfully"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Email is required, invalid/expired OTP, or new password is the same as the old password.
    *   `404 Not Found`: User not found.

### 9. Refresh Token (`POST /refresh-token`)

This endpoint allows clients to obtain a new access token and a new refresh token using a valid, existing refresh token. This is crucial for maintaining user sessions without requiring frequent re-authentication. The system validates the provided refresh token; if valid and not expired, it invalidates the old refresh token and issues a new pair of tokens. This mechanism enhances security by rotating refresh tokens.

*   **Success Response (200 OK):**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Refresh token is required.
    *   `401 Unauthorized`: Invalid or expired refresh token.

### 10. KYC Initialization (`POST /initialize-kyc`)

This endpoint initiates the Know Your Customer (KYC) verification process for a user. It takes the user's ID and prepares the system for KYC verification. Developers should call this endpoint to begin the KYC flow for users who are not yet verified. The system checks if the user is already verified and returns an error if so.

*   **Success Response (200 OK):**
    ```json
    {
      "message": "KYC Initialized"
    }
    ```
*   **Error Responses:**
    *   `404 Not Found`: User not found.
    *   `400 Bad Request`: User is already KYC verified.

### 11. Confirm KYC Status (`POST /verify-kyc`)

This endpoint is used to confirm the completion of the KYC verification process and to provide authentication tokens if the KYC is successful. After a user completes the external KYC process, this endpoint is called with the user's ID and client device type. If the user's KYC status is successfully updated to verified, the system issues an access token and, for mobile clients, a refresh token. For web clients, the refresh token is set as an `httpOnly` cookie. This effectively logs the user in after successful KYC.

*   **Success Response (200 OK - Web Client):**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "Login & KYC verification successful"
    }
    ```
    *   **Note:** For web clients, the `refreshToken` is set as an `httpOnly` cookie.
*   **Success Response (200 OK - Mobile Client):**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "Login & KYC verification successful"
    }
    ```
*   **Error Responses:**
    *   `404 Not Found`: User not found.
    *   `400 Bad Request`: User is already KYC verified.

### 12. Logout (`POST /logout`)

This endpoint allows a user to securely log out of their session. For web clients, this involves clearing the `refreshToken` cookie, effectively ending the session on the browser. For mobile clients, the endpoint invalidates the refresh token stored on the server, and the mobile application is responsible for deleting its locally stored tokens (access and refresh tokens). This ensures that the user's session is terminated across all relevant platforms.

*   **Success Response (200 OK):**
    ```json
    {
      "message": "Logged out successfully"
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized`: If the user is not authenticated or the token is invalid/expired.
    *   `500 Internal Server Error`: An unexpected error occurred during logout.

## Mobile Developer Integration Guide

Mobile application integration largely follows the same principles as frontend web integration, with a few key differences primarily concerning token storage and handling.

### 1. Token Storage

*   **Access Token:** Store the access token securely in memory or a secure storage mechanism (e.g., Keychain for iOS, Keystore for Android) for the duration of the user's session. Avoid storing it in `UserDefaults` or `SharedPreferences` directly, as these are not encrypted by default.
*   **Refresh Token:** For mobile clients, the `refreshToken` is returned directly in the `verify-login` and `verify-kyc` responses. This token should be stored securely, preferably in an encrypted storage solution provided by the platform (e.g., Keychain, Keystore). This allows the app to obtain new access tokens without requiring the user to re-authenticate frequently.

### 2. Refreshing Tokens

When an API call returns a 401 Unauthorized error (due to an expired access token), the mobile application should:
1.  Attempt to use the stored `refreshToken` to call the `POST /refresh-token` endpoint.
2.  If successful, replace the old access and refresh tokens with the new ones.
3.  Retry the original failed API call with the new access token.
4.  If the refresh token is also invalid or expired, the user should be prompted to log in again.

### 3. Secure Communication

Always ensure that all communication with the API is done over HTTPS to protect sensitive user data and tokens in transit.

### 4. Error Handling

Implement robust error handling for all API calls, especially for authentication-related endpoints. Provide clear and user-friendly messages for different error scenarios (e.g., invalid credentials, expired OTP, network issues).

### 5. Session Management

Consider implementing proper session management, including:
*   **Logout:** Clear all stored tokens (access and refresh) upon user logout.
*   **Inactivity Timeout:** Implement an inactivity timeout that automatically logs out the user and clears tokens after a period of inactivity.
*   **Biometric Authentication:** For enhanced security and user convenience, consider integrating biometric authentication (e.g., Face ID, Fingerprint) to unlock the stored tokens.
