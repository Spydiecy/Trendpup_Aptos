const { chromium } = require('playwright');
const fs = require('fs');
const net = require('net');
const { execSync } = require('child_process');

// Tor control port config
const TOR_CONTROL_PORT = 9051;
const TOR_CONTROL_PASSWORD = "trendpup"

async function sendTorNewnym(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Tor control connection timeout'));
    }, 5000); // 5 second timeout
    
    const socket = net.connect(TOR_CONTROL_PORT, '127.0.0.1', () => {
      clearTimeout(timeout);
      socket.write(`AUTHENTICATE \"${TOR_CONTROL_PASSWORD}\"\r\n`);
    });
    
    let authenticated = false;
    
    socket.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log('Tor response:', msg.trim());
      
      if (!authenticated && msg.indexOf('250 OK') !== -1) {
        authenticated = true;
        socket.write('SIGNAL NEWNYM\r\n');
      } else if (authenticated && msg.indexOf('250 OK') !== -1) {
        socket.end();
        clearTimeout(timeout);
        resolve();
      } else if (msg.indexOf('515') !== -1) {
        socket.end();
        clearTimeout(timeout);
        reject(new Error('Tor authentication failed - invalid password'));
      } else if (msg.indexOf('551') !== -1) {
        socket.end();
        clearTimeout(timeout);
        console.log('Tor NEWNYM too soon, waiting 10 seconds...');
        reject(new Error('Tor NEWNYM command failed - too soon (will retry later)'));
      }
    });
    
    socket.on('end', () => {
      clearTimeout(timeout);
      resolve();
    });
    
    socket.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

const userAgentStrings = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.2227.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.3497.92 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
];

let consecutiveFailures = 0;
let lastUserAgentIndex = -1;
let totalAttempts = 0;
let lastSuccessfulScrape = Date.now();

async function scrapePage(pageNum: number, userAgent: string): Promise<any[]> {
  let browser, context, page;
  try {
    browser = await chromium.launch({
      headless: true,
      proxy: { server: 'socks5://127.0.0.1:9050', username: '', password: '' },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1280,720',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=site-per-process,TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-dev-shm-usage',
        '--proxy-server=socks5://127.0.0.1:9050'
      ]
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent,
      ignoreHTTPSErrors: true,
      deviceScaleFactor: 1
    });
    page = await context.newPage();
    const url = `https://dexscreener.com/aptos/page-${pageNum}?order=asc&rankBy=pairAge`;
    console.log(`Navigating to DexScreener page ${pageNum}...`);
    try {
      await page.goto(url, {
        timeout: 30000,
        waitUntil: 'networkidle'
      });
    } catch (err) {
      console.log('Network idle failed, trying with domcontentloaded...');
      await page.goto(url, {
        timeout: 45000,
        waitUntil: 'domcontentloaded'
      });
    }
    // Wait for Cloudflare or page to settle
    console.log('Waiting for page to settle...');
    await page.waitForTimeout(8000);
    // Check if we're blocked by checking for specific elements
    const isBlocked = await page.locator('text=Access denied').count() > 0 ||
      await page.locator('text=Cloudflare').count() > 0 ||
      await page.locator('text=Just a moment').count() > 0;
    if (isBlocked) {
      throw new Error('Access denied or Cloudflare challenge detected');
    }
    // Wait for the table to load
    console.log('Waiting for token table to load...');
    await page.waitForSelector('.ds-dex-table-row-base-token-name', { timeout: 15000 });
    console.log('Scraping token data...');
    // Token names
    const names = await page.locator('.ds-dex-table-row-base-token-name').allTextContents();
    // Token Symbol
    const symbol = await page.locator('.ds-dex-table-row-base-token-symbol').allTextContents();
    const symbol1 = await page.locator('.ds-dex-table-row-quote-token-symbol').allTextContents();
    // Token price (handle sub-elements by joining innerText)
    const priceHandles = await page.locator('.ds-dex-table-row-col-price').elementHandles();
    const prices: string[] = [];
    for (const handle of priceHandles) {
      const text = await handle.evaluate((el: Element) => el.textContent || '');
      prices.push(text.replace(/\s+/g, '').trim());
    }
    // Token volume
    const volume = await page.locator('.ds-dex-table-row-col-volume').allTextContents();
    // Token mcap
    const mcap = await page.locator('.ds-dex-table-row-col-market-cap').allTextContents();
    // Token Liquidity
    const liquidity = await page.locator('.ds-dex-table-row-col-liquidity').allTextContents();
    // Token transactions
    const txns = await page.locator('.ds-dex-table-row-col-txns').allTextContents();
    // Token age
    const age = await page.locator('.ds-dex-table-row-col-pair-age').allTextContents();
    // Token change (5m)
    const fivem = await page.locator('.ds-dex-table-row-col-price-change-m5').allTextContents();
    // Token change (1h)
    const oneh = await page.locator('.ds-dex-table-row-col-price-change-h1').allTextContents();
    // Token change (6h)
    const sixh = await page.locator('.ds-dex-table-row-col-price-change-h6').allTextContents();
    // Token change (24h)
    const oned = await page.locator('.ds-dex-table-row-col-price-change-h24').allTextContents();
    // Scrape href links for each token row (target <a> elements)
    const hrefs = await page.$$eval('a.ds-dex-table-row.ds-dex-table-row-new', (rows: Element[]) => rows.map((row: Element) => (row as HTMLAnchorElement).getAttribute('href')));
    const tokens = names.map((name: string, i: number) => ({
      name: name,
      symbol: symbol[i],
      symbol1: symbol1[i],
      price: prices[i],
      volume: volume[i],
      liquidity: liquidity[i],
      mcap: mcap[i],
      transactions: txns[i],
      age: age[i],
      'change-5m': fivem[i],
      'change-1h': oneh[i],
      'change-6h': sixh[i],
      'change-24h': oned[i],
      href: hrefs[i] ? `https://dexscreener.com${hrefs[i]}` : null
    }));
    return tokens;
  } catch (err) {
    console.error(`❌ Error scraping page ${pageNum}:`, err);
    return [];
  } finally {
    try { if (page) await page.close(); } catch (err) { console.error('❌ Error closing page:', err); }
    try { if (context) await context.close(); } catch (err) { console.error('❌ Error closing context:', err); }
    try { if (browser) await browser.close(); } catch (err) { console.error('❌ Error closing browser:', err); }
    // Safeguard: kill any leftover Chromium processes
    try { execSync('pkill -9 chromium || true'); } catch (err) { /* ignore */ }
    try { execSync('pkill -9 chrome || true'); } catch (err) { /* ignore */ }
  }
}

async function scrapePageWithRetry(pageNum: number, userAgent: string, maxRetries: number = 3): Promise<any[]> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    console.log(`Scraping page ${pageNum} (attempt ${attempt}/${maxRetries})...`);
    
    const tokens = await scrapePage(pageNum, userAgent);
    
    if (tokens.length > 0) {
      console.log(`✅ Page ${pageNum} scraped successfully: ${tokens.length} tokens`);
      return tokens;
    }
    
    console.log(`❌ Page ${pageNum} failed (attempt ${attempt}/${maxRetries}), retrying...`);
    
    // Wait before retry (exponential backoff)
    const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
    console.log(`⏳ Waiting ${waitTime}ms before retry...`);
    await new Promise(res => setTimeout(res, waitTime));
    
    // Rotate IP after failed attempt
    try {
      await sendTorNewnym();
      console.log('✅ Tor IP rotated for retry');
    } catch (torErr) {
      console.error('❌ Failed to rotate Tor IP:', torErr);
    }
  }
  
  console.error(`❌ Page ${pageNum} failed after ${maxRetries} attempts`);
  return [];
}

async function scraper() {
  if (isBrowserActive) {
    console.log('⏭️ Chromium session already active, skipping this run.');
    return false;
  }
  isBrowserActive = true;
  totalAttempts++;
  const attemptStartTime = Date.now();
  console.log(`\n=== Scraper Attempt #${totalAttempts} ===`);
  console.log(`Consecutive failures: ${consecutiveFailures}`);
  console.log(`Time since last success: ${Math.round((Date.now() - lastSuccessfulScrape) / 1000)}s`);
  try {
    // Check if we've been failing for too long
    if (Date.now() - lastSuccessfulScrape > 30 * 60 * 1000) { // 30 minutes
      console.log('No successful scrapes in 30 minutes. Taking extended break...');
      await new Promise(res => setTimeout(res, 10 * 60 * 1000)); // 10 minute break
      consecutiveFailures = 0;
      lastSuccessfulScrape = Date.now();
      return false; // Return false to indicate we should retry
    }
    
    // Pick a new user agent each time
    let uaIndex;
    do {
      uaIndex = Math.floor(Math.random() * userAgentStrings.length);
    } while (uaIndex === lastUserAgentIndex && userAgentStrings.length > 1);
    lastUserAgentIndex = uaIndex;
    const userAgent = userAgentStrings[uaIndex];
    console.log(`Using user agent: ${userAgent.substring(0, 50)}...`);
    // Queue: scrape each page sequentially with retry logic
    let allTokens: any[] = [];
    for (let pageNum = 1; pageNum <= 7; pageNum++) {
      const tokens = await scrapePageWithRetry(pageNum, userAgent);
      allTokens = allTokens.concat(tokens);
      
      // Add delay between pages to avoid rate limiting
      if (pageNum < 7) {
        console.log(`⏳ Waiting 2 seconds before next page...`);
        await new Promise(res => setTimeout(res, 2000));
      }
    }
    const jsonData = {
      timestamp: new Date().toISOString(),
      totalTokens: allTokens.length,
      tokens: allTokens
    };
    fs.writeFileSync('aptos_tokens.json', JSON.stringify(jsonData, null, 2));
    consecutiveFailures = 0; // Reset on success
    lastSuccessfulScrape = Date.now();
    const scrapeDuration = Date.now() - attemptStartTime;
    console.log(`✅ Scrape successful! Found ${allTokens.length} tokens in ${scrapeDuration}ms`);
    return true; // Return to indicate success
    
  } catch (err) {
    consecutiveFailures++;
    const scrapeDuration = Date.now() - attemptStartTime;
    
    console.error(`❌ Scrape failed after ${scrapeDuration}ms (Attempt #${totalAttempts}, Failure #${consecutiveFailures}):`, err);
    
    // Handle timeout errors
    if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'TimeoutError') {
      console.warn('🔄 Timeout error detected, rotating Tor IP...');
      
      try {
        await sendTorNewnym();
        console.log('✅ Tor IP rotated successfully');
      } catch (torErr) {
        console.error('❌ Failed to rotate Tor IP:', torErr);
      }
    } else {
      // Non-timeout error
      console.error('❌ Non-timeout error occurred');
    }
    
    return false; // Return false to indicate failure
  } finally {
    isBrowserActive = false; // Allow next Chromium session
  }
}

// Global flag to prevent multiple scrapers running simultaneously
let isScrapingInProgress = false;
let isBrowserActive = false; // Prevent multiple Chromium sessions
let scraperInterval: NodeJS.Timeout | null = null;

async function runSingleScrape(): Promise<boolean> {
  if (isScrapingInProgress) {
    console.log('⏭️ Scrape already in progress, skipping...');
    return false;
  }
  
  isScrapingInProgress = true;
  
  try {
    const success = await scraper();
    return success;
  } catch (error) {
    console.error(`🚨 Unexpected error in scraper:`, error);
    return false;
  } finally {
    isScrapingInProgress = false;
  }
}

async function scraperWithRetry(): Promise<void> {
  const MAX_CONSECUTIVE_FAILURES = 10;
  let attemptCount = 0;
  
  while (consecutiveFailures < MAX_CONSECUTIVE_FAILURES && attemptCount < 5) {
    attemptCount++;
    
    const success = await runSingleScrape();
    
    if (success) {
      console.log('✅ Scrape successful, resetting failure count');
      consecutiveFailures = 0;
      return; // Exit on success
    }
    
    // Calculate wait time based on consecutive failures
    let waitTime;
    if (consecutiveFailures >= 6) {
      const cooldownMinutes = Math.min(consecutiveFailures - 5, 5); // Cap at 5 minutes
      waitTime = cooldownMinutes * 60 * 1000;
      console.log(`🛑 ${consecutiveFailures} consecutive failures. Cooling down for ${cooldownMinutes} minutes...`);
    } else {
      waitTime = Math.pow(2, consecutiveFailures) * 1000; // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
    }
    
    await new Promise(res => setTimeout(res, waitTime));
  }
  
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.log('🚨 Too many consecutive failures. Taking a 10-minute break...');
    consecutiveFailures = 0; // Reset after long break
    await new Promise(res => setTimeout(res, 600000)); // 10 minutes
  }
}

// Add a health check function
async function healthCheck(): Promise<boolean> {
  try {
    const socket = net.connect(TOR_CONTROL_PORT, '127.0.0.1');
    socket.end();
    return true;
  } catch (err) {
    console.error('❌ Tor control port not accessible:', err);
    return false;
  }
}

// Enhanced startup
async function startScraper(): Promise<void> {
  console.log('🚀 Starting Token Scraper...');
  
  // Clear any existing interval
  if (scraperInterval) {
    clearInterval(scraperInterval);
    scraperInterval = null;
  }
  
  // Check Tor connection
  if (await healthCheck()) {
    console.log('✅ Tor control port is accessible');
  } else {
    console.log('❌ Tor control port is not accessible. Continuing anyway...');
  }
  
  // Initial scrape with retry logic
  await scraperWithRetry();
  
  // Set up interval with retry logic (only if not already running)
  if (!scraperInterval) {
    console.log('⏰ Setting up 5 minute interval...');
    scraperInterval = setInterval(async () => {
      try {
        await scraperWithRetry();
      } catch (err) {
        console.error('❌ Interval scraper error:', err);
      }
    }, 300000); // 5 minutes
  }
}

startScraper().catch(console.error);