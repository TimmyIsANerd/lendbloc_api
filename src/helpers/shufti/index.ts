import axios, { type AxiosError, type AxiosInstance } from "axios";
import crypto from "crypto";

// Individual proof params
export type DocumentProof = {
    proof: string; // base64
    name: string[];
    dob: string; // YYYY-MM-DD
    supported_types?: Array<"id_card" | "driving_license" | "passport">;
};

export type FaceProof = {
    proof: string; // base64
};

export type AddressProof = {
    proof: string; // base64
    full_address: string;
    supported_types?: Array<"id_card" | "bank_statement" | "driving_license" | "utility_bill">;
};

export type ConsentProof = {
    proof: string; // base64
    text: string;
    supported_types?: Array<"handwritten" | "printed">;
};

export type BackgroundChecksProof = {
    name: {
        first_name: string;
        last_name: string;
        middle_name?: string;
    };
    dob: string; // YYYY-MM-DD
};

// The main params object for the verify method
export type ShuftiVerifyPayload = {
    reference: string;
    callback_url?: string;
    document?: DocumentProof;
    face?: FaceProof;
    address?: AddressProof;
    consent?: ConsentProof;
    background_checks?: BackgroundChecksProof;
};

export interface ShuftiResponse {
    event?: string; // e.g., "verification.accepted" | "verification.declined"
    declined_reason?: string;
    error?: { message?: string; code?: string };
    [k: string]: unknown;
}

export interface ShuftiConfig {
    clientId: string;
    secretKey: string;
    baseUrl?: string;        // default: https://api.shuftipro.com
    timeoutMs: number // default: 30_000
    defaultCallbackUrl?: string;
}

class ShuftiPro {
    private axios: AxiosInstance;

    constructor(private cfg: ShuftiConfig) {
        const base64Creds = Buffer.from(`${cfg.clientId}:${cfg.secretKey}`).toString("base64");

        this.axios = axios.create({
            baseURL: (cfg.baseUrl ?? "https://api.shuftipro.com").replace(/\/+$/, ""),
            timeout: cfg.timeoutMs ?? 30_000,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${base64Creds}`,
            },
        });
    }

    async verify(payload: ShuftiVerifyPayload): Promise<ShuftiResponse> {
        const requestBody: any = {
            reference: payload.reference,
            callback_url: payload.callback_url ?? this.cfg.defaultCallbackUrl,
        };

        if (payload.document) {
            requestBody.document = {
                proof: payload.document.proof,
                name: payload.document.name,
                dob: payload.document.dob,
                supported_types: payload.document.supported_types ?? ["id_card", "driving_license", "passport"],
            };
        }
        if (payload.face) {
            requestBody.face = {
                proof: payload.face.proof,
            };
        }
        if (payload.address) {
            requestBody.address = {
                full_address: payload.address.full_address,
                supported_types: payload.address.supported_types ?? ["id_card", "bank_statement", "driving_license", "utility_bill"],
            };
        }
        if (payload.consent) {
            requestBody.consent = {
                proof: payload.consent.proof,
                text: payload.consent.text,
                supported_types: payload.consent.supported_types ?? ["handwritten", "printed"],
            };
        }
        if (payload.background_checks) {
            requestBody.background_checks = payload.background_checks;
        }

        try {
            const { data } = await this.axios.post<ShuftiResponse>("/", requestBody);
            return data;
        } catch (err) {
            throw this.normalizeError(err);
        }
    }

    async getStatus(reference: string): Promise<ShuftiResponse> {
        const requestBody = {
            reference: reference,
        };

        try {
            const { data } = await this.axios.post<ShuftiResponse>("/status", requestBody);
            return data;
        } catch (err) {
            throw this.normalizeError(err);
        }
    }

    generateReference(len = 20): string {
        return crypto.randomBytes(15).toString("base64url").slice(0, len);
    }

    private normalizeError(err: unknown): Error {
        if (axios.isAxiosError(err)) {
            const axErr = err as AxiosError<ShuftiResponse>;
            const msg =
                axErr.response?.data?.error?.message ||
                axErr.response?.data?.declined_reason ||
                axErr.message ||
                "Request failed";
            return new Error(msg);
        }
        if (err instanceof Error) return err;
        return new Error("Unknown error");
    }
}

const shuftiPro = new ShuftiPro({
    clientId: process.env.SHUFTI_PRO_CLIENT_ID!,
    secretKey: process.env.SHUFTI_PRO_CLIENT_SECRET!,
    timeoutMs: 30_000 // 30 seconds
});

export default shuftiPro;