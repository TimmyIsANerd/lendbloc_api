import axios, { AxiosError, AxiosInstance } from "axios";
import crypto from "crypto";

export enum ShuftiType {
  DOCUMENT = "document",
  FACE = "face",
  ADDRESS = "address",
  CONSENT = "consent",
  BACKGROUND_CHECKS = "background_checks",
}

export type BaseParams = {
  reference?: string;
  callback_url?: string;
};

export type DocumentParams = BaseParams & {
  type: ShuftiType.DOCUMENT;
  imageBase64: string; // "data:image/jpeg;base64,...." or raw base64
  name: string;
  dob: string; // YYYY-MM-DD
  supportedTypes?: Array<"id_card" | "driving_license" | "passport">;
};

export type FaceParams = BaseParams & {
  type: ShuftiType.FACE;
  imageBase64: string;
};

export type AddressParams = BaseParams & {
  type: ShuftiType.ADDRESS;
  imageBase64: string;
  fullAddress: string;
  supportedTypes?: Array<"id_card" | "bank_statement" | "driving_license" | "utility_bill">;
};

export type ConsentParams = BaseParams & {
  type: ShuftiType.CONSENT;
  imageBase64: string;
  supportedTypes?: Array<"handwritten" | "printed">;
  text?: string; // consent text to match
};

export type BackgroundChecksParams = BaseParams & {
  type: ShuftiType.BACKGROUND_CHECKS;
  firstName: string;
  lastName: string;
  middleName?: string;
  dob: string; // YYYY-MM-DD
};

export type ShuftiVerifyParams =
  | DocumentParams
  | FaceParams
  | AddressParams
  | ConsentParams
  | BackgroundChecksParams;

// You can refine this to exact ShuftiPro schemas if you have them handy.
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
  timeoutMs?: number;      // default: 30_000
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

  /**
   * Public API: performs a verification for the specific type with a clean, typed interface.
   */
  async verify(params: ShuftiVerifyParams): Promise<ShuftiResponse> {
    const body = this.buildRequestBody(params);
    try {
      // Adjust path to match the specific Shufti endpoint you're using, e.g. "/"
      const { data } = await this.axios.post<ShuftiResponse>("/", body);

      if (data?.event === "verification.declined") {
        const reason = data.declined_reason || data?.error?.message || "Verification declined";
        throw new Error(reason);
      }

      return data;
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  // ---------- Internals ----------

  private buildRequestBody(params: ShuftiVerifyParams): Record<string, unknown> {
    const reference = params.reference ?? this.generateReference();
    const callback_url = params.callback_url ?? this.cfg.defaultCallbackUrl;

    const builders: Record<ShuftiType, (p: any) => Record<string, unknown>> = {
      [ShuftiType.DOCUMENT]: (p: DocumentParams) => ({
        document: {
          proof: p.imageBase64,
          supported_types: p.supportedTypes ?? ["id_card", "driving_license", "passport"],
          name: [p.name],
          dob: p.dob,
        },
      }),
      [ShuftiType.FACE]: (p: FaceParams) => ({
        face: {
          proof: p.imageBase64,
        },
      }),
      [ShuftiType.ADDRESS]: (p: AddressParams) => ({
        address: {
          proof: p.imageBase64,
          full_address: p.fullAddress,
          supported_types: p.supportedTypes ?? ["id_card", "bank_statement", "driving_license", "utility_bill"],
        },
      }),
      [ShuftiType.CONSENT]: (p: ConsentParams) => ({
        consent: {
          proof: p.imageBase64,
          supported_types: p.supportedTypes ?? ["handwritten", "printed"],
          text: p.text ?? "I consent to verification",
        },
      }),
      [ShuftiType.BACKGROUND_CHECKS]: (p: BackgroundChecksParams) => ({
        background_checks: {
          name: {
            first_name: p.firstName,
            middle_name: p.middleName ?? "",
            last_name: p.lastName,
          },
          dob: p.dob,
        },
      }),
    };

    const section = builders[params.type](params as any);

    return {
      reference,
      ...(callback_url ? { callback_url } : {}),
      ...section,
    };
  }

  private generateReference(len = 20): string {
    // 15 bytes -> 20 base64url chars approx; safer than Math.random
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
    defaultCallbackUrl: `${process.env.PORT_FORWARD_URL}/api/v1/webhooks/shufti/callback`
});

export default shuftiPro;
