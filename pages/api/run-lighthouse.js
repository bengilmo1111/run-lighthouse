// pages/api/run-lighthouse.js
import { IncomingForm } from 'formidable';
import fs from 'fs';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { parse } from 'csv-parse/sync';
import os from 'os';

// Force Lighthouse to use US English
process.env.LIGHTHOUSE_LOCALE = 'en-US';

export const config = {
  api: {
    bodyParser: false, // Disable Next.js' default body parser
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
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Use the system temporary directory
  const form = new IncomingForm({ uploadDir: os.tmpdir(), keepExtensions: true });
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      res.status(500).json({ error: 'Error parsing form data' });
      return;
    }
    
    console.log('Uploaded files:', files);
    
    // Handle the case where files.csv is an array
    const csvFiles = files.csv;
    const csvFile = Array.isArray(csvFiles) ? csvFiles[0] : csvFiles;
    
    if (!csvFile) {
      res.status(400).json({ error: 'CSV file is required' });
      return;
    }
    
    let csvContent;
    try {
      const filePath = csvFile.filepath || csvFile.path;
      if (!filePath) {
        console.error('File path is undefined in the uploaded file:', csvFile);
        res.status(500).json({ error: 'File path is undefined in the uploaded file.' });
        return;
      }
      console.log('Attempting to read file at:', filePath);
      csvContent = fs.readFileSync(filePath, 'utf8');
      console.log('CSV content read successfully.');
    } catch (error) {
      console.error('Error reading CSV file:', error);
      res.status(500).json({ error: 'Error reading CSV file' });
      return;
    }
    
    let records;
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      });
    } catch (error) {
      console.error('Error parsing CSV content with header:', error);
      records = [];
    }
    
    let urls = [];
    if (records.length > 0 && records[0].url) {
      urls = records.map(rec => rec.url);
    } else {
      urls = csvContent.split('\n').filter(line => line.trim() !== '');
    }

    console.log("Parsed URLs:", urls);
    
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
  });
}