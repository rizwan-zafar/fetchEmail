
// speedy code

const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3000;

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const MAX_PAGES = 30;
const CONCURRENCY = 3;

app.get("/welcome", (req, res) => {
    res.json({
      message: "Welcome to the app",
      status: "running"
    });
  });

app.get("/extract-emails", async (req, res) => {
  const domain = req.query.domain;
  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  const startUrl = domain.startsWith("http")
    ? domain
    : `https://${domain}`;

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage"
        ]
      });

  const emails = new Set();
  const visited = new Set();
  const queue = [startUrl];

  // 🔥 Worker function
  async function worker() {
    const page = await browser.newPage();

    // 🚀 Speed optimizations
    await page.setRequestInterception(true);
    page.on("request", req => {
      const type = req.resourceType();
      if (["image", "font", "media", "stylesheet"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Capture emails from JS responses
    page.on("response", async response => {
      try {
        const text = await response.text();
        (text.match(EMAIL_REGEX) || []).forEach(e => emails.add(e));
      } catch {}
    });

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;

      visited.add(url);

      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 15000
        });

        // HTML
        const html = await page.content();
        (html.match(EMAIL_REGEX) || []).forEach(e => emails.add(e));

        // mailto
        const mailtos = await page.$$eval(
          "a[href^='mailto:']",
          as => as.map(a => a.href.replace("mailto:", ""))
        );
        mailtos.forEach(e => emails.add(e));

        // links
        const links = await page.$$eval("a[href]", as =>
          as.map(a => a.href)
        );

        for (const link of links) {
          if (
            link.startsWith(startUrl) &&
            !visited.has(link)
          ) {
            queue.push(link);
          }
        }
      } catch {}
    }

    await page.close();
  }

  // 🚀 Start workers
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  await browser.close();

  res.json({
    domain: startUrl,
    pagesCrawled: visited.size,
    totalEmails: emails.size,
    emails: [...emails],
    performance: {
      concurrency: CONCURRENCY,
      maxPages: MAX_PAGES
    }
  });
});

app.listen(PORT, () => {
  console.log(`⚡ Fast crawler running on port ${PORT}`);
});
