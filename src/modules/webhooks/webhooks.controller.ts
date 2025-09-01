import { type Context } from 'hono';
import User from '../../models/User'; // Import the User model
import Wallet from '../../models/Wallet'; // Import the Wallet model

export const shuftiRedirect = async (c: Context) => {
    // This redirect is for the user's browser after verification, not the webhook callback.
    // You might want to redirect to a success/failure page in your frontend.
    return c.html(`
        <html>
            <head>
                <title>Verification Status</title>
                <style>
                    body {
                        background-color: #3498db; /* A neutral blue */
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        font-family: Arial, sans-serif;
                        margin: 0;
                    }
                    .container {
                        text-align: center;
                        background-color: #fff;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    }
                    h1 {
                        color: #2c3e50;
                        font-size: 2.5em;
                        margin-bottom: 20px;
                    }
                    p {
                        color: #7f8c8d;
                        font-size: 1.2em;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Verification Process Complete</h1>
                    <p>Please check your application for the updated verification status.</p>
                </div>
            </body>
        </html>
    `);
}

export const shuftiCallback = async (c: Context) => {
    try {
        const body = await c.req.json();
        console.log('Shufti Callback Received:', JSON.stringify(body, null, 2));

        const { event, reference, verification_result } = body;

        // Best practice: Validate webhook signature if Shufti provides one.
        // For this example, we'll proceed without signature validation,
        // but in a production environment, this is crucial for security.

        if (!reference) {
            console.error('Shufti Callback: Missing reference ID');
            return c.json({ message: 'Missing reference ID' }, 400);
        }

        const user = await User.findOne({ kycReferenceId: reference });

        if (!user) {
            console.error(`Shufti Callback: User not found for reference ID: ${reference}`);
            return c.json({ message: 'User not found' }, 404);
        }

        if (event === 'verification.accepted' && verification_result === 'accepted') {
            user.isKycVerified = true;
            await user.save();
            console.log(`User ${user.email} (ID: ${user._id}) KYC status updated to verified.`);
            return c.json({ message: 'Callback processed successfully' }, 200);
        } else if (event === 'verification.declined' || verification_result === 'declined') {
            // Handle declined verification (e.g., log, notify user, keep isKycVerified as false)
            console.log(`User ${user.email} (ID: ${user._id}) KYC verification declined. Event: ${event}, Result: ${verification_result}`);
            // Optionally, you might want to store the reason for decline
            return c.json({ message: 'Verification declined, status updated' }, 200);
        } else {
            console.log(`Shufti Callback: Unhandled event or status. Event: ${event}, Result: ${verification_result}`);
            return c.json({ message: 'Unhandled event or status' }, 200);
        }

    } catch (error) {
        console.error('Error processing Shufti callback:', error);
        return c.json({ message: 'Internal server error' }, 500);
    }
}

import { enqueueDepositJob } from '../../jobs/deposit.processor';

export const tatumCallback = async (c: Context) => {
    try {
        const body = await c.req.json();
        console.log('Tatum Webhook Received:', JSON.stringify(body, null, 2));

        // Normalize payload
        const { address, amount, txId, currency, chain, subscriptionType, contractAddress, blockNumber } = body;

        if (!address || !amount || !txId || !chain || !subscriptionType || typeof blockNumber === 'undefined') {
            console.error('Tatum Callback: Missing required fields (address, amount, txId, chain, subscriptionType, blockNumber)');
            return c.json({ message: 'Missing required fields' }, 400);
        }

        // Enqueue and return quickly
        enqueueDepositJob({
            address,
            amount: String(amount),
            txId: String(txId),
            currency: String(currency || ''),
            chain: String(chain),
            subscriptionType: String(subscriptionType),
            contractAddress: contractAddress ? String(contractAddress) : undefined,
            blockNumber: Number(blockNumber),
            counterAddress: String(body.counterAddress || ''),
        });

        return c.json({ ok: true }, 200);

    } catch (error) {
        console.error('Error processing Tatum callback:', error);
        return c.json({ message: 'Internal server error' }, 500);
    }
};
