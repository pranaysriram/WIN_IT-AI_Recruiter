import { describe, expect, it } from "vitest";
import {
  computeTwilioSignature,
  twilioRequestUrl,
  verifyTwilioSignature,
} from "@/services/twilioSignature.server";

const AUTH_TOKEN = "12345678901234567890123456789012";

describe("computeTwilioSignature", () => {
  // Reference vector from Twilio's security documentation.
  it("matches Twilio's documented example", async () => {
    const params = new URLSearchParams({
      CallSid: "CA1234567890ABCDE",
      Caller: "+12349013030",
      Digits: "1234",
      From: "+12349013030",
      To: "+18005551212",
    });
    const sig = await computeTwilioSignature(
      AUTH_TOKEN,
      "https://mycompany.com/myapp.php?foo=1&bar=2",
      params,
    );
    expect(sig).toBe("ywaPmaw4i7u6NcKlNoz8UEm3vLY=");
  });
});

describe("verifyTwilioSignature", () => {
  const url = "https://example.com/api/calls/webhook";
  const params = new URLSearchParams({ CallSid: "CA123", CallStatus: "completed" });

  it("accepts a valid signature", async () => {
    const signature = await computeTwilioSignature(AUTH_TOKEN, url, params);
    await expect(verifyTwilioSignature({ authToken: AUTH_TOKEN, url, params, signature })).resolves.toBe(
      true,
    );
  });

  it("rejects an invalid signature", async () => {
    await expect(
      verifyTwilioSignature({ authToken: AUTH_TOKEN, url, params, signature: "bogus-signature=" }),
    ).resolves.toBe(false);
  });

  it("rejects a signature computed over different params", async () => {
    const other = new URLSearchParams({ CallSid: "CA123", CallStatus: "failed" });
    const signature = await computeTwilioSignature(AUTH_TOKEN, url, other);
    await expect(
      verifyTwilioSignature({ authToken: AUTH_TOKEN, url, params, signature }),
    ).resolves.toBe(false);
  });

  it("rejects a missing signature", async () => {
    await expect(
      verifyTwilioSignature({ authToken: AUTH_TOKEN, url, params, signature: null }),
    ).resolves.toBe(false);
  });

  it("rejects when the auth token is empty", async () => {
    const signature = await computeTwilioSignature(AUTH_TOKEN, url, params);
    await expect(verifyTwilioSignature({ authToken: "", url, params, signature })).resolves.toBe(
      false,
    );
  });
});

describe("twilioRequestUrl", () => {
  it("honours proxy forwarding headers", () => {
    const request = new Request("http://localhost:8080/api/calls/webhook?x=1", {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "app.example.com" },
    });
    expect(twilioRequestUrl(request)).toBe("https://app.example.com/api/calls/webhook?x=1");
  });
});
