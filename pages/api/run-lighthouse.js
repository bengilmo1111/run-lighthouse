// pages/api/run-lighthouse.js
import { IncomingForm } from 'formidable';
import fs from 'fs';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { parse } from 'csv-parse/sync'; // synchronous CSV parser

export const config = {
  api: {
    bodyParser: false, // Disables Next.js built-in body parser so formidable can handle it
  },
};

async function runLighthouse(url) {
  // Launch Chrome in headless mode
  const chrome = await launch({ chromeFlags: ['--headless'] });
  // Increase maxWaitForLoad to 60 seconds and set emulated form factor to desktop
  const flags = {
    port: chrome.port,
    output: 'json',
    maxWaitForLoad: 60000,
    emulatedFormFactor: 'desktop',
  };
  const result = await lighthouse(url, flags);
  await chrome.kill();
  return result.report;
}

async function runLighthouseWithRetry(url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await runLighthouse(url);
    } catch (error) {
      console.error(`Error processing ${url} on attempt ${attempt}: ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

function convertToCSV(data) {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));
  for (const row of data) {
    const values = headers.map(header => `"${row[header] != null ? row[header] : ''}"`);
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Parse the form using formidable
  const form = new IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ error: 'Error parsing form data' });
      return;
    }
    const csvFile = files.csv;
    if (!csvFile) {
      res.status(400).json({ error: 'CSV file is required' });
      return;
    }
    const csvContent = fs.readFileSync(csvFile.filepath, 'utf8');
    // Try to parse CSV assuming a header column "url". Otherwise, treat each line as a URL.
    let records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });
    let urls = [];
    if (records.length > 0 && records[0].url) {
      urls = records.map(rec => rec.url);
    } else {
      urls = csvContent.split('\n').filter(line => line.trim() !== '');
    }

    // Process URLs sequentially
    const csvData = [];
    for (const url of urls) {
      try {
        const report = await runLighthouseWithRetry(url);
        const jsonData = JSON.parse(report);
        const categories = jsonData.categories;
        csvData.push({
          url: jsonData.finalUrl || url,
          performance: categories.performance ? categories.performance.score : null,
          accessibility: categories.accessibility ? categories.accessibility.score : null,
          bestPractices: categories['best-practices'] ? categories['best-practices'].score : null,
          seo: categories.seo ? categories.seo.score : null,
          pwa: categories.pwa ? categories.pwa.score : null,
        });
      } catch (error) {
        csvData.push({
          url: url,
          error: error.message,
        });
      }
    }
    const csvString = convertToCSV(csvData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=lighthouse-results.csv');
    res.status(200).send(csvString);
  });
}