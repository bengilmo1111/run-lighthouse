// pages/api/run-lighthouse.js
import lighthouse from 'lighthouse';
import chromeLambda from 'chrome-aws-lambda';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function runLighthouse(url) {
  // Use chrome-aws-lambda's executablePath and args to launch Chrome
  const executablePath = await chromeLambda.executablePath;
  const chrome = await chromeLambda.launch({
    args: chromeLambda.args,
    executablePath,
    headless: chromeLambda.headless,
  });
  
  // Set Lighthouse flags
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
  // For simplicity, we allow GET requests when using a static list.
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Please use GET.' });
    return;
  }
  
  // Define your static list of URLs
  const urls = [
    'https://central.xero.com/s/',
    'https://central.xero.com/s/topiccatalog',
    'https://central.xero.com/s/session-log-out',
    'https://central.xero.com/s/contact-support-mfa',
    'https://central.xero.com/s/contact-support-login',
    'https://central.xero.com/s/learning'
  ];

  console.log("Static URLs:", urls);
  
  const csvData = [];
  for (const url of urls) {
    try {
      const report = await runLighthouse(url);
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