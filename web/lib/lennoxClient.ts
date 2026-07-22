import https from "node:https";
import crypto from "node:crypto";

export interface LennoxMessage {
  MessageId?: number;
  SenderID?: string;
  TargetID?: string;
  MessageType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data?: Record<string, any>;
}

interface RawResponse {
  status: number;
  body: string;
}

export class LennoxClient {
  private agent: https.Agent;

  constructor(
    private ip: string,
    private appId: string
  ) {
    // The S30/E30 uses an old self-signed cert and cipher config that OpenSSL 3.x
    // rejects at its default security level - same relaxation curl/legacy clients need.
    this.agent = new https.Agent({
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.2",
      ciphers: "DEFAULT:@SECLEVEL=0",
      keepAlive: true,
    });
  }

  private request(method: "GET" | "POST", path: string, timeoutMs: number, body?: unknown): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const req = https.request(
        {
          hostname: this.ip,
          path,
          method,
          agent: this.agent,
          timeout: timeoutMs,
          headers: payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : { "Content-Length": 0 },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
        }
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error(`request timed out after ${timeoutMs}ms`)));
      if (payload) req.write(payload);
      req.end();
    });
  }

  async connect(): Promise<void> {
    const res = await this.request("POST", `/Endpoints/${this.appId}/Connect`, 15000);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Connect failed: HTTP ${res.status} ${res.body}`);
    }
  }

  async subscribe(jsonPath: string): Promise<void> {
    const body = {
      MessageType: "RequestData",
      SenderID: this.appId,
      MessageID: crypto.randomUUID(),
      TargetID: "LCC",
      AdditionalParameters: { JSONPath: jsonPath },
    };
    const res = await this.request("POST", "/Messages/RequestData", 15000, body);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`RequestData failed: HTTP ${res.status} ${res.body}`);
    }
  }

  async retrieveOnce(longPollSeconds: number): Promise<LennoxMessage[]> {
    const params = new URLSearchParams({
      Direction: "Oldest-to-Newest",
      MessageCount: "10",
      StartTime: "1",
      LongPollingTimeout: String(longPollSeconds),
    });
    const res = await this.request(
      "GET",
      `/Messages/${this.appId}/Retrieve?${params.toString()}`,
      (longPollSeconds + 15) * 1000
    );
    if (res.status === 204 || !res.body) return [];
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Retrieve failed: HTTP ${res.status} ${res.body}`);
    }
    const parsed = JSON.parse(res.body) as { messages?: LennoxMessage[] };
    return parsed.messages ?? [];
  }

  async reconnect(jsonPath: string): Promise<boolean> {
    try {
      await this.connect();
      await this.subscribe(jsonPath);
      return true;
    } catch {
      return false;
    }
  }
}
