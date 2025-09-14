# LendBloc API — Postman Endpoint Descriptions
Generated: 2025-09-13

Notes
- Auth denotes the required Authorization context per call: None, User Bearer (user JWT), Admin Bearer (admin JWT).
- DEV behavior refers to when CURRENT_ENVIRONMENT=DEVELOPMENT.
- Endpoints marked Deprecated/Disabled are present in code but should not be used for new integrations.


Auth
- POST /api/v1/auth/otp/start — Starts OTP-only auth using email or phone; creates a minimal user if needed and sends OTP (DEV: OTP step is bypassed). Returns userId for the next step. Auth: None. Rate limits: none.
- POST /api/v1/auth/otp/verify — Verifies OTP and issues access/refresh tokens (web sets refresh cookie; mobile returns refresh in body). DEV: OTP check bypassed; access token lasts ~3 days. Also initializes default wallets and top balances on first login. Auth: None.
- POST /api/v1/auth/kyc/bio — Saves KYC bio data (title, fullName, DOB, email, password) and links to user’s KYC record; enforces email uniqueness. Auth: None.
- POST /api/v1/auth/verify/email — Confirms a user’s email with 6‑digit OTP. Auth: None.
- POST /api/v1/auth/send/phone — Sends a phone verification OTP via SMS. Auth: None. Rate limit: 3 requests / 2 minutes (per userId).
- POST /api/v1/auth/verify/phone — Verifies a user’s phone with 6‑digit OTP. Auth: None.
- POST /api/v1/auth/edit-phone — Updates phone number prior to successful verification. Auth: None.
- POST /api/v1/auth/kyc/document — Uploads document proof (multipart/form-data) and stores it on the user’s KYC record. Auth: None.
- POST /api/v1/auth/kyc/face — Uploads facial proof (multipart/form-data) and stores it on the user’s KYC record. Auth: None.
- POST /api/v1/auth/kyc/address — Saves full address details for KYC; blocked if the user is already verified. Auth: None.
- POST /api/v1/auth/kyc/consent — Uploads consent proof (multipart/form-data) with optional text. Auth: None.
- POST /api/v1/auth/kyc/submit — Submits accumulated KYC proofs to Shufti Pro and marks status pending. May return 202 while awaiting provider. Auth: None.
- GET  /api/v1/auth/kyc/status — Returns latest KYC status; fetches from provider when a reference is present and may resubmit on invalid references. Auth: None.
- POST /api/v1/auth/request-password-reset — Sends a short OTP to email or phone to initiate password reset. Auth: None. Rate limit: 1 request / 2 minutes (per email/phone).
- POST /api/v1/auth/validate-password-reset-otp — Validates password reset OTP and permits setting a new password. Auth: None.
- POST /api/v1/auth/set-password — Sets a new password after successful OTP validation; rejects reuse of the current password. Auth: None.
- POST /api/v1/auth/refresh-token — Exchanges a valid refresh token for a new access (and refresh) token; web sets cookie, mobile returns both in body. Auth: None.
- POST /api/v1/auth/logout — Logs out the authenticated user by clearing stored refresh tokens (and cookie for web). Auth: User Bearer.


Users
- GET  /api/v1/users/profile — Returns the authenticated user’s profile (sans password hash). Auth: User Bearer.
- PUT  /api/v1/users/profile — Partially updates profile fields (title, fullName, DOB, phone). Auth: User Bearer.
- GET  /api/v1/users/transactions — Lists the user’s transactions filtered by assetSymbol or contractAddress with paging and optional type/status. Auth: User Bearer.
- POST /api/v1/users/request-password-change — Sends an OTP to the specified email to confirm a password change for a logged-in user. Auth: User Bearer.
- POST /api/v1/users/validate-password-change-otp — Validates the password-change OTP and allows updating the password. Auth: User Bearer.
- POST /api/v1/users/update-password-change — Updates the password after validation; disallows reusing the old password. Auth: User Bearer.
- POST /api/v1/users/request-email-change — Sends a verification OTP to the new email address to confirm email change. Auth: User Bearer.
- POST /api/v1/users/validate-email-change-otp — Validates the email-change OTP before committing the new email. Auth: User Bearer.
- POST /api/v1/users/update-email-change — Updates the user’s email after OTP validation. Auth: User Bearer.


Wallets
- GET  /api/v1/wallets — Lists all wallets owned by the authenticated user. Auth: User Bearer.
- GET  /api/v1/wallets/:id — Returns wallet details by ID if it belongs to the user. Auth: User Bearer.
- GET  /api/v1/wallets/address/:walletAddress — Finds a wallet by its on-chain address. Auth: User Bearer.
- POST /api/v1/wallets — Creates a new wallet for the specified asset symbol if one does not already exist. Auth: User Bearer.


Lending
- POST /api/v1/lending/quotes — Returns a borrow quote given borrowSymbol, borrowNetwork (ETH/TRON), borrowAmount and collateralSymbol; includes required collateral, LTVs, interest, and fees. Auth: User Bearer.
- POST /api/v1/lending/loans/from-quote — Creates a loan from a quote; allocates a collateral receiving address and sets PENDING_COLLATERAL. DEV: simulate=true auto-activates and disburses internally. Auth: User Bearer.
- GET  /api/v1/lending/loans — Lists loans for the user with optional status, page, and limit; enriches with current and origination USD rates. Auth: User Bearer.
- GET  /api/v1/lending/loans/:id — Returns a single loan by ID with current/origination USD rates. Auth: User Bearer.
- POST /api/v1/lending/loans/:id/cancel — Cancels a loan only while it is PENDING_COLLATERAL. Auth: User Bearer.
- POST /api/v1/lending/loans/:id/collateral/increase — Tops up collateral using INTERNAL (balance) or EXTERNAL (on-chain) methods; PROD may relocate funds to liquidity wallet. Auth: User Bearer.
- POST /api/v1/lending/loans/:id/repay/otp — Requests a repayment OTP via SMS (PROD only). DEV: OTP not required. Auth: User Bearer.
- POST /api/v1/lending/loans/:id/repay/confirm — Confirms repayment via INTERNAL balance or EXTERNAL tx (PROD requires OTP and txHash for external). Auto-updates loan status on full repayment. Auth: User Bearer.
- POST /api/v1/lending/loans — Deprecated: legacy direct-loan creation; always returns 410 and should not be used. Auth: User Bearer.
- POST /api/v1/lending/loans/:id/repay — Legacy single-step repayment from balance; prefer the new two-step OTP flow. Auth: User Bearer.


Savings
- POST /api/v1/savings — Opens a term savings account for an asset and amount; APY depends on account type and term (7/30/180/365 days). Funds lock until term end. Auth: User Bearer.
- POST /api/v1/savings/:id/unsave — Closes the savings account (after or before maturity) and credits principal (plus any accrued monthly payouts already applied). Auth: User Bearer.
- POST /api/v1/savings/:id/deposit — Disabled: returns 400; deposits are not supported under the current spec. Auth: User Bearer. [Disabled]
- POST /api/v1/savings/:id/withdraw — Disabled: returns 403; withdrawals replaced by unsave at term end. Auth: User Bearer. [Disabled]
- GET  /api/v1/savings — Lists all savings accounts for the user. Auth: User Bearer.
- GET  /api/v1/savings/asset/:id — Gets the active savings account for a given asset (or latest legacy record). Auth: User Bearer.
- GET  /api/v1/savings/asset/:id/history — Lists monthly earnings for a savings asset between optional date ranges, including USD amounts. Auth: User Bearer.


Exchange
- POST /api/v1/exchange/quote — Estimates a swap via USD parity and applies split fees; returns net amount to be received. Auth: User Bearer.
- GET  /api/v1/exchange/price-change — Returns 24h percent change for from/to symbols via CoinMarketCap. Requires CMC_API_KEY. Auth: User Bearer.
- POST /api/v1/exchange/swap — Performs an atomic swap between two listed assets, debiting source with fee and crediting destination net of fee; checks platform liquidity. Auth: User Bearer.
- POST /api/v1/exchange/vote — Records a user vote for listing a coin. Auth: User Bearer.


Notifications
- POST /api/v1/notifications — Sends a demo notification to the user via email or SMS and records it. Auth: User Bearer.


Admin Auth
- POST /api/v1/admin/auth/register — Registers a new admin and initializes liquidity wallet(s). DEV: email/phone are auto-verified. Auth: None.
- POST /api/v1/admin/auth/send-phone-otp — Sends a phone verification OTP to an admin. Auth: None.
- POST /api/v1/admin/auth/verify-phone-otp — Verifies admin phone with OTP (DEV: OTP bypassed). Auth: None.
- POST /api/v1/admin/auth/login — Starts admin login; PROD sends an email OTP, DEV issues tokens immediately. Auth: None.
- POST /api/v1/admin/auth/verify-login — Verifies OTP and issues admin tokens (refresh cookie for web). Auth: None.
- POST /api/v1/admin/auth/logout — Revokes the provided refresh token. Auth: None.


Admin
- GET  /api/v1/admin/profile — Returns the authenticated admin’s profile. Auth: Admin Bearer.
- PUT  /api/v1/admin/profile/avatar — Uploads an avatar image (multipart/form-data, max ~3MB). Auth: Admin Bearer.
- DELETE /api/v1/admin/profile/avatar — Removes the admin’s avatar. Auth: Admin Bearer.
- POST /api/v1/admin/users/block — Blocks a user by email or phone; marks account BLOCKED and clears refresh tokens. Auth: Admin Bearer.
- POST /api/v1/admin/users/unblock — Unblocks a user and resets status to ACTIVE. Auth: Admin Bearer.
- GET  /api/v1/admin/users/blocked — Lists blocked users with pagination. Auth: Admin Bearer.
- GET  /api/v1/admin/kyc — Lists users with their KYC records and statuses, paginated. Auth: Admin Bearer.
- GET  /api/v1/admin/settings — Returns global system settings (e.g., savings APY). Auth: Admin Bearer.
- PUT  /api/v1/admin/settings/savings-apy — Updates the global savings APY value. Auth: Admin Bearer.
- POST /api/v1/admin/invite — Sends an admin invite email; SUPER_ADMIN only. Auth: Admin Bearer (role: SUPER_ADMIN).
- GET  /api/v1/admin/users — Lists users. Auth: Admin Bearer.
- GET  /api/v1/admin/loans — Lists loans. Auth: Admin Bearer.
- GET  /api/v1/admin/savings — Lists savings accounts. Auth: Admin Bearer.
- GET  /api/v1/admin/transactions — Lists transactions. Auth: Admin Bearer.


Admin Assets
- POST /api/v1/admin/assets — Creates a new asset (native or token) with per-account fees; prevents duplicate symbol/token per network. Auth: Admin Bearer.
- GET  /api/v1/admin/assets — Lists assets with filters and pagination. Auth: Admin Bearer.
- GET  /api/v1/admin/assets/overview — Lists assets with a reduced field set for overview screens. Auth: Admin Bearer.
- GET  /api/v1/admin/assets/:id — Returns a single asset. Auth: Admin Bearer.
- GET  /api/v1/admin/assets/:id/fees — Returns the current fee configuration for an asset. Auth: Admin Bearer.
- PUT  /api/v1/admin/assets/:id — Updates asset fields including fees and status; supports legacy fee mapping. Auth: Admin Bearer.
- PUT  /api/v1/admin/assets/:id/fees — Updates only the asset’s fees using partial per-account structures. Auth: Admin Bearer.
- POST /api/v1/admin/assets/:id/list — Sets asset status to LISTED. Auth: Admin Bearer.
- POST /api/v1/admin/assets/:id/delist — Sets asset status to DELISTED. Auth: Admin Bearer.


Admin Chat
- GET  /api/v1/admin/chat/messages — Returns paginated admin-to-admin chat history between two admins, newest first. Auth: Admin Bearer.
- POST /api/v1/admin/chat/messages — Sends a chat message to another admin and broadcasts via WebSocket. Auth: Admin Bearer.
- GET  /api/v1/admin/chat/ws — WebSocket endpoint for realtime admin chat (JWT in Authorization or ?token=). Auth: Admin Bearer.


Webhooks
- POST /api/v1/webhooks/shufti/callback — Receives KYC verification callbacks from Shufti Pro and updates user/KYC records. Auth: None (provider callback).
- GET  /api/v1/webhooks/shufti/redirect — Simple HTML page used as a user-facing redirect after completing Shufti flow. Auth: None.
- POST /api/v1/webhooks/tatum — Receives Tatum deposit notifications and enqueues processing (credits net of receive fees). Auth: None (provider callback).


Referrals
- GET  /api/v1/referrals — Returns the authenticated user’s referrals list. Auth: User Bearer.
- GET  /api/v1/referrals/earnings — Returns accumulated referral earnings for the user. Auth: User Bearer.
- POST /api/v1/referrals/test-email — Sends a test referral email to the user. Auth: User Bearer.


Calculator
- POST /api/v1/calculator — Simple referral profit calculator (amount x referrals x 10%). Auth: None.


Prices
- GET  /api/v1/prices — Fetches public crypto prices from CoinGecko (demo). Auth: None.


Dashboard
- GET  /api/v1/dashboard — Aggregated user dashboard including loans, savings, transactions, and a sample wallet. Auth: User Bearer.


Balances
- GET  /api/v1/balances — Lists balances for all LISTED assets, including fetched USD prices and total USD value. Auth: User Bearer.
- GET  /api/v1/balances/:id — Returns the user’s balance for a specific asset with USD valuation. Auth: User Bearer.

