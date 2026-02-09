const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3000;

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const MAX_PAGES = 50;

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
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );

  const visited = new Set();
  const emails = new Set();

  // 🔥 Capture emails from network responses
  page.on("response", async response => {
    try {
      const text = await response.text();
      const found = text.match(EMAIL_REGEX) || [];
      found.forEach(e => emails.add(e));
    } catch {}
  });

  async function crawl(url) {
    if (visited.size >= MAX_PAGES) return;
    if (visited.has(url)) return;

    visited.add(url);

    try {
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000
      });

      // 1️⃣ HTML content
      const html = await page.content();
      (html.match(EMAIL_REGEX) || []).forEach(e => emails.add(e));

      // 2️⃣ mailto links
      const mailtos = await page.$$eval(
        "a[href^='mailto:']",
        as => as.map(a => a.href.replace("mailto:", ""))
      );
      mailtos.forEach(e => emails.add(e));

      // 3️⃣ discover internal links
      const links = await page.$$eval("a[href]", as =>
        as.map(a => a.href)
      );

      console.log("links : ", links)
      for (const link of links) {
        if (
          link.startsWith(startUrl) &&
          !visited.has(link)
        ) {
            console.log("links : ", link)
          await crawl(link);
        }
      }
    } catch {
      // ignore broken pages
    }
  }

  await crawl(startUrl);
  await browser.close();

  res.json({
    domain: startUrl,
    pagesCrawled: visited.size,
    totalEmails: emails.size,
    emails: [...emails],
    note:
      emails.size === 0
        ? "No publicly extractable emails found (likely hidden via JS or contact form)"
        : "Emails extracted from public pages"
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});




// const express = require("express");
// const puppeteer = require("puppeteer");

// const app = express();
// const PORT = 3000;

// const EMAIL_REGEX =
//   /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// const MAX_PAGES = 50;

// app.get("/extract-emails", async (req, res) => {
//   const domain = req.query.domain;
//   if (!domain) {
//     return res.status(400).json({ error: "Domain is required" });
//   }

//   const startUrl = domain.startsWith("http")
//     ? domain
//     : `https://${domain}`;

//   const browser = await puppeteer.launch({
//     headless: "new",
//     args: ["--no-sandbox", "--disable-setuid-sandbox"]
//   });

//   const page = await browser.newPage();

//   const visited = new Set();
//   const emails = new Set();

//   async function crawl(url) {
//     if (visited.size >= MAX_PAGES) return;
//     if (visited.has(url)) return;

//     visited.add(url);

//     try {
//       await page.goto(url, {
//         waitUntil: "networkidle2",
//         timeout: 30000
//       });

//       const html = await page.content();

//       const found = html.match(EMAIL_REGEX) || [];
//       found.forEach(e => emails.add(e));

//       const links = await page.$$eval("a[href]", as =>
//         as.map(a => a.href)
//       );

//       for (const link of links) {
//         if (
//           link.startsWith(startUrl) &&
//           !visited.has(link)
//         ) {
//           await crawl(link);
//         }
//       }
//     } catch (err) {
//       // silently ignore broken pages
//     }
//   }

//   await crawl(startUrl);
//   await browser.close();

//   res.json({
//     domain: startUrl,
//     pagesCrawled: visited.size,
//     totalEmails: emails.size,
//     emails: [...emails]
//   });
// });

// app.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });
