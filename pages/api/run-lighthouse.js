// pages/api/run-lighthouse.js
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import os from 'os';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function runLighthouse(url) {
  const chrome = await launch({ chromeFlags: ['--headless'] });
  const flags = {
    port: chrome.port,
    output: 'json',
    maxWaitForLoad: 60000,
    emulatedFormFactor: 'desktop',
    locale: 'en-US',
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
      await new Promise(resolve => setTimeout(resolve, 2000));
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
  // For simplicity, we allow GET requests (instead of POST) when using a static list.
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Please use GET.' });
    return;
  }

  // Define a static list of URLs
  const urls = [
    'https://central.xero.com/s/',
    'https://central.xero.com/s/topiccatalog',
    'https://central.xero.com/s/session-log-out',
    'https://central.xero.com/s/contact-support-mfa',
    'https://central.xero.com/s/contact-support-login',
  ];

  console.log("Static URLs:", urls);
  
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
      });
      console.log(`Metrics for ${url} collected.`);
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
      csvData.push({ url: url, error: error.message });
    }
  }
  
  const csvString = convertToCSV(csvData);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=lighthouse-results.csv');
  res.status(200).send(csvString);
}