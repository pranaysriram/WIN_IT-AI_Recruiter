import { describe, expect, it } from "vitest";
import {
  getCalendarProvider,
  getCalendarProviderName,
  getConfiguredCalendarProvider,
} from "@/services/calendarProvider.server";
import { getAtsProvider, getConfiguredAtsProvider } from "@/services/atsProvider.server";

describe("calendar provider registry", () => {
  it("supports Google and Microsoft Graph providers", () => {
    expect(getCalendarProviderName("google")).toBe("google");
    expect(getCalendarProviderName("microsoft")).toBe("microsoft");
    expect(getCalendarProvider("google")).toBeTruthy();
    expect(getCalendarProvider("microsoft")).toBeTruthy();
  });

  it("falls back to Google when no provider is configured", () => {
    expect(getConfiguredCalendarProvider()).toBe("google");
  });
});

describe("ATS provider registry", () => {
  it("supports Greenhouse, Lever and Zoho Recruit", () => {
    expect(getConfiguredAtsProvider()).toBe("greenhouse");
    expect(getAtsProvider("lever")).toBeTruthy();
    expect(getAtsProvider("zoho_recruit")).toBeTruthy();
  });
});
