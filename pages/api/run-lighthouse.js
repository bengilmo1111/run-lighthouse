// pages/api/run-lighthouse.js
import lighthouse from 'lighthouse';
import chromeLambda from 'chrome-aws-lambda';

export const config = {
  runtime: 'nodejs', // explicitly use nodejs runtime
};

async function runLighthouse(url) {
  const chrome = await chromeLambda.launch({
    args: [...chromeLambda.args, '--no-sandbox', '--disable-gpu'],
    executablePath: await chromeLambda.executablePath,
    headless: chromeLambda.headless,
  });

  const flags = {
    port: chrome.port,
    output: 'json',
    emulatedFormFactor: 'desktop',
    locale: 'en-US',
    maxWaitForLoad: 60000,
  };

  const result = await lighthouse(url, flags);
  await chrome.kill();
  return result.report;
}

function convertToCSV(data) {
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  data.forEach(row => {
    csvRows.push(headers.map(header => `"${row[header] ?? ''}"`).join(','));
  });
  return csvRows.join('\n');
}

export default async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Only GET requests are allowed.' });
    return;
  }

  const urls = [
    'https://central.xero.com/s/',
    // ... your other URLs here ...
  ];

  const csvData = [];
  for (const url of urls) {
    try {
      const report = await runLighthouse(url);
      const jsonData = JSON.parse(report);
      csvData.push({
        url,
        performance: jsonData.categories.performance.score,
        accessibility: jsonData.categories.accessibility.score,
        bestPractices: jsonData.categories['best-practices'].score,
        seo: jsonData.categories.seo.score,
        pwa: jsonData.categories.pwa.score,
      });
    } catch (error) {
      console.error(`Failed on ${url}: ${error.message}`);
      csvData.push({ url, error: error.message });
    }
  }

  const csvString = convertToCSV(csvData);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="lighthouse-results.csv"');
  res.status(200).send(csvString);
}