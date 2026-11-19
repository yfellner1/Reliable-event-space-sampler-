import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] }, testIgnore: /desktop\.spec\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /desktop\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    // Reminders go to a fake email and WhatsApp service run by the tests.
    env: {
      CRON_SECRET: "test-cron-secret",
      APP_URL: `http://127.0.0.1:${PORT}`,
      RESEND_API_KEY: "test-resend-key",
      REMINDER_EMAIL_FROM: "Parties <reminders@example.com>",
      RESEND_API_URL: "http://127.0.0.1:3199/emails",
      PERISKOPE_API_KEY: "test-periskope-key",
      PERISKOPE_PHONE: "17325550199",
      PERISKOPE_API_URL: "http://127.0.0.1:3199/periskope",
    },
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
