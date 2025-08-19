import axios, { AxiosError } from 'axios';

const SHUFTI_PRO_CLIENT_ID = process.env.SHUFTI_PRO_CLIENT_ID;
const SHUFTI_PRO_CLIENT_SECRET = process.env.SHUFTI_PRO_CLIENT_SECRET;

const SHUFTI_BASE_URL = 'https://api.shuftipro.com';

const AUTH_TOKEN = Buffer.from(`${SHUFTI_PRO_CLIENT_ID}:${SHUFTI_PRO_CLIENT_SECRET}`).toString('base64');

export const verifyUser = async (kycReferenceId: string) => {
    let payload = {
        reference: kycReferenceId,
        // callback_url: `${process.env.PORT_FORWARD_URL}/api/v1/webhooks/shufti/callback`,
        // redirect_url: `${process.env.PORT_FORWARD_URL}/api/v1/webhooks/shufti/redirect`,
        country: "GB",
        language: "EN",
        verification_mode: "any", // Can be 'any' or 'all'
        ttl: 60, // Time to live in seconds
        allow_warnings: "1",
        document: {
            supported_types: ["id_card", "passport", "driving_license"],
            allow_unsupported_document: "0",
            allow_offline: "1",
            allow_photocopy: "0",
            allow_scanned: "0",
            allow_screenshot: "0",
            allow_id_mismatch: "0",
            age: {
                min: 18,
                max: 100
            },
            backside_proof_required: "0",
            allow_upload: "1"
        },
        face: {
            allow_offline: "1",
            allow_photocopy: "0",
            allow_scanned: "0",
            allow_screenshot: "0",
            allow_padding: "0",
            allow_online: "0"
        },
    };

    try {
        const response = await axios.post(SHUFTI_BASE_URL, payload, {
            headers: {
                'Authorization': `Basic ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
        });

        return response.data;
    } catch (error: any) {
        console.error('Error verifying user:', error.response.data);
        throw error;
    }
}

export const getVerificationStatus = async (kycReferenceId: string) => {
    try {

        let payload = {
            reference: kycReferenceId
        }

        const response = await axios.post("https://api.shuftipro.com/status", payload, {
            headers: {
                'Authorization': `Basic ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
        });

        return response.data;
    } catch (error: any) {
        console.error('Error getting verification status:', error.response.data);
        throw error;
    }
}