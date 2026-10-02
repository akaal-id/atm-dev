import { expect, test } from "@playwright/test";

// Needs a real account: E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("project hub (authenticated)", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated tests.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("opens from the projects list and shows overview + files tabs", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("link", { name: "Project Dashboard" }).first().click();

    await expect(page).toHaveURL(/\/projects\/prj_/);
    await expect(page.getByRole("heading", { name: "Project brief" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Team · \d+/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Target KPI" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Digital marketing strategy" })).toBeVisible();

    await page.getByRole("tab", { name: "Files & SOP" }).click();
    await expect(page.getByRole("heading", { name: "Base files" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SOP", exact: true })).toBeVisible();
  });

  test("content matrix tab shows the agreed columns", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("link", { name: "Project Dashboard" }).first().click();
    await page.getByRole("tab", { name: "Content Matrix" }).click();

    await expect(page).toHaveURL(/tab=content/);
    for (const column of ["No.", "Task #", "Title", "Brand", "Month", "Create date", "Publication date", "Theme", "Funnel", "Pillar", "Channel", "Link brief", "Link drive", "Link publication"]) {
      await expect(page.getByRole("columnheader", { name: column, exact: true })).toBeVisible();
    }
  });

  test("office lists locations and requires one for new files", async ({ page }) => {
    await page.goto("/office");
    await expect(page.getByRole("button", { name: /Personal notes/ })).toBeVisible();
    await page.getByRole("button", { name: "New file" }).click();
    await expect(page.getByRole("dialog").or(page.getByText("Choose a project or personal notes"))).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  test("messages has a pinned personal notes room", async ({ page }) => {
    await page.goto("/chat");
    const notes = page.getByRole("link", { name: /My notes/ });
    await expect(notes.first()).toBeVisible();
    await notes.first().click();
    await expect(page.getByText("Only you can see these notes")).toBeVisible();
  });

  test("unknown project returns not found", async ({ page }) => {
    const response = await page.goto("/projects/prj_does_not_exist");
    expect(response?.status()).toBe(404);
  });
});
