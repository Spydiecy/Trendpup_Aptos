import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { VertexAI } from '@google-cloud/vertexai';

dotenv.config({ path: path.resolve(__dirname, '/home/trendpup/trendpup-aptos/.env') });

const TWEETS_FILE = 'tweets.json';
export const OUTPUT_FILE = 'ai_analyzer.json';
export const APTOS_TOKENS = 'aptos_tokens.json';

// Vertex AI configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

// Track last modification time of aptos_tokens.json
let lastAptosTokensModified = 0;

// Function to check if aptos_tokens.json was updated
function checkAptosTokensUpdated(): boolean {
  try {
    if (!fs.existsSync(APTOS_TOKENS)) return false;
    const stats = fs.statSync(APTOS_TOKENS);
    const currentModified = stats.mtimeMs;
    if (currentModified > lastAptosTokensModified) {
      lastAptosTokensModified = currentModified;
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Helper to get token info from aptos_tokens.json
function getTokenInfo(symbol: string, aptosTokens: any): any {
  if (!aptosTokens?.tokens) return null;
  return aptosTokens.tokens.find((t: any) => t.symbol === symbol) || null;
}

async function analyzeTokenVertexAI(symbol: string, tweets: any[], tokenInfo: any): Promise<TokenAnalysis | null> {
  let tokenInfoStr = '';
  if (tokenInfo) {
    tokenInfoStr = `Token info: ${JSON.stringify(tokenInfo)}\n`;
  }
  // Use up to 20 tweets, and instruct the AI to use market data and name if tweets are insufficient
  const tweetsText = tweets.map(t => t.text).slice(0, 20).join(' | ');
  const prompt = `Determine if the following token is a memecoin. Use the recent tweets below if available. If there is not enough tweet data, use the token's market data and name to make your determination. If it is a memecoin, analyze it for risk (1-10, 10=highest risk), investment potential (1-10, 10=best potential), and an overall score (1-100, 100=best overall). Token symbol: ${symbol}\n${tokenInfoStr}Recent tweets: ${tweetsText}\nRespond ONLY with a single JSON object, no extra text, no code blocks, no explanations. The JSON object MUST have these exact keys: symbol, is_memecoin (boolean), risk, potential, overall, rationale. Example: { "symbol": "${symbol}", "is_memecoin": true, "risk": 5, "potential": 7, "overall": 65, "rationale": "..." }`;
  
  try {
    const generativeModel = vertexAI.preview.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.95,
      },
    });

    const result = await generativeModel.generateContent(prompt);
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let text = responseText.replace(/```json|```/g, '').trim();
    text = text.replace(/([\x00-\x08\x0B\x0C\x0E-\x1F])/g, ' ');
    const match = text.match(/\{[\s\S]*?\}/);
    let parsed;
    try {
      parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
    } catch (e) {
      console.error(`Error parsing extracted JSON for ${symbol}:`, e, '\nExtracted:', match ? match[0] : text);
      return null;
    }
    if (!parsed.is_memecoin) {
      console.log(`Token ${symbol} is not a memecoin. Skipping.`);
      return null;
    }
    
    // Helper function to parse price strings
    const parsePrice = (priceStr: string): number => {
      const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
      const price = parseFloat(cleaned);
      return isNaN(price) ? 0 : price;
    };
    
    // Helper function to parse percentage change
    const parseChange = (changeStr: string): number => {
      if (changeStr === 'N/A') return 0;
      const cleaned = changeStr.replace(/[^\d.-]/g, '');
      const change = parseFloat(cleaned);
      return isNaN(change) ? 0 : change;
    };
    
    return {
      symbol: parsed.symbol || symbol,
      risk: parsed.risk,
      investmentPotential: parsed.potential,
      overall: parsed.overall,
      rationale: parsed.rationale || '',
      // Include market data from tokenInfo if available
      price: tokenInfo?.price ? parsePrice(tokenInfo.price) : 0,
      volume: tokenInfo?.volume || 'N/A',
      marketCap: tokenInfo?.mcap || 'N/A',
      liquidity: tokenInfo?.liquidity || 'N/A',
      change24h: tokenInfo?.['change-24h'] ? parseChange(tokenInfo['change-24h']) : 0,
      age: tokenInfo?.age || 'N/A',
      href: tokenInfo?.href || '#'
    };
  } catch (e: any) {
    console.error(`Vertex AI error for ${symbol}:`, e);
    // Vertex AI has much higher rate limits, but still handle errors gracefully
    if (e.code === 429 || e.status === 429) {
      console.error(`Rate limit exceeded for ${symbol}. This is rare with Vertex AI - check your quota.`);
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    return null;
  }
}

interface TokenAnalysis {
  symbol: string;
  risk: number;
  investmentPotential: number;
  overall: number;
  rationale: string;
  // Market data fields
  price?: number;
  volume?: string;
  marketCap?: string;
  liquidity?: string;
  change24h?: number;
  age?: string;
  href?: string;
}

// Helper to write analysis results with best token on top
function writeResultsWithBestToken(results: TokenAnalysis[], outputFile: string) {
  if (!results.length) return;
  // Find the best token by highest overall score
  const best = results.reduce((a, b) => (b.overall > a.overall ? b : a));
  // Prepare output object
  const output = {
    best_token: {
      symbol: best.symbol,
      overall: best.overall,
      rationale: best.rationale
    },
    results
  };
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
}

// Helper function to update market data for existing analyses
function updateMarketData(analysisResults: TokenAnalysis[], aptosTokens: any): TokenAnalysis[] {
  console.log('Updating market data for existing analyses...');
  
  const parsePrice = (priceStr: string): number => {
    const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  };
  
  const parseChange = (changeStr: string): number => {
    if (changeStr === 'N/A') return 0;
    const cleaned = changeStr.replace(/[^\d.-]/g, '');
    const change = parseFloat(cleaned);
    return isNaN(change) ? 0 : change;
  };

  let updatedCount = 0;
  const updatedResults = analysisResults.map(analysis => {
    const tokenInfo = getTokenInfo(analysis.symbol, aptosTokens);
    if (tokenInfo) {
      console.log(`Updated market data for ${analysis.symbol}`);
      updatedCount++;
      return {
        ...analysis,
        price: tokenInfo.price ? parsePrice(tokenInfo.price) : analysis.price || 0,
        volume: tokenInfo.volume || analysis.volume || 'N/A',
        marketCap: tokenInfo.mcap || analysis.marketCap || 'N/A',
        liquidity: tokenInfo.liquidity || analysis.liquidity || 'N/A',
        change24h: tokenInfo['change-24h'] ? parseChange(tokenInfo['change-24h']) : analysis.change24h || 0,
        age: tokenInfo.age || analysis.age || 'N/A',
        href: tokenInfo.href || analysis.href || '#'
      };
    }
    // Return original analysis if token is not found in aptos_tokens.json
    return analysis;
  });

  console.log(`Updated market data for ${updatedCount} out of ${analysisResults.length} tokens`);
  return updatedResults;
}

async function main() {
  let tweetsObj: any = {};
  let aptosTokens: any = {};
  try {
    if (!fs.existsSync(TWEETS_FILE)) {
      console.log('tweets.json not found. Nothing to analyze.');
      return;
    }
    tweetsObj = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading or parsing tweets.json:', e);
    return;
  }
  try {
    if (fs.existsSync(APTOS_TOKENS)) {
      aptosTokens = JSON.parse(fs.readFileSync(APTOS_TOKENS, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading or parsing aptos_tokens.json:', e);
    aptosTokens = {};
  }

  let analysisResults: TokenAnalysis[] = [];
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      // Read only the results array if best_token is present
      const fileContent = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      if (Array.isArray(fileContent)) {
        analysisResults = fileContent;
      } else if (Array.isArray(fileContent.results)) {
        analysisResults = fileContent.results;
      }
    }
  } catch (e) {
    console.error('Error reading or parsing ai_analyzer.json:', e);
    analysisResults = [];
  }

  // Initialize last modified time for aptos_tokens.json
  try {
    if (fs.existsSync(APTOS_TOKENS)) {
      const stats = fs.statSync(APTOS_TOKENS);
      lastAptosTokensModified = stats.mtimeMs;
    }
  } catch (e) {
    console.error('Error getting aptos_tokens.json stats:', e);
  }

  // Update market data for existing analyses
  if (analysisResults.length > 0) {
    analysisResults = updateMarketData(analysisResults, aptosTokens);
    writeResultsWithBestToken(analysisResults, OUTPUT_FILE);
    console.log(`Updated market data for ${analysisResults.length} existing analyses`);
  }

  // Create a queue of tokens to analyze
  const tokenQueue = Object.keys(tweetsObj);
  const analyzedSymbols = new Set(analysisResults.map(a => a.symbol));
  
  // Filter out already analyzed tokens for initial run
  const tokensToAnalyze = tokenQueue.filter(symbol => !analyzedSymbols.has(symbol));
  
  console.log(`Found ${tokensToAnalyze.length} new tokens to analyze`);
  console.log(`Total tokens in queue: ${tokenQueue.length}`);
  
  // Process tokens in queue with 30-second intervals
  async function processTokenQueue(tokensToProcess: string[]) {
    let currentIndex = 0;
    while (currentIndex < tokensToProcess.length) {
      // Check if aptos_tokens.json was updated
      if (checkAptosTokensUpdated()) {
        console.log('Detected aptos_tokens.json update. Refreshing market data...');
        try {
          const updatedAptosTokens = JSON.parse(fs.readFileSync(APTOS_TOKENS, 'utf8'));
          analysisResults = updateMarketData(analysisResults, updatedAptosTokens);
          writeResultsWithBestToken(analysisResults, OUTPUT_FILE);
          console.log('Market data updated successfully');
        } catch (e) {
          console.error('Error updating market data:', e);
        }
      }

      const currentSymbol = tokensToProcess[currentIndex];
      try {
        console.log(`Processing token ${currentIndex + 1}/${tokensToProcess.length}: ${currentSymbol}`);
        const tweets = tweetsObj[currentSymbol]?.tweets || [];
        const tokenInfo = getTokenInfo(currentSymbol, aptosTokens);
        const analysis = await analyzeTokenVertexAI(currentSymbol, tweets, tokenInfo);
        if (analysis && analysis.rationale && analysis.rationale.trim() !== '' && analysis.risk !== -1) {
          const existingIndex = analysisResults.findIndex(a => a.symbol === currentSymbol);
          if (existingIndex >= 0) {
            analysisResults[existingIndex] = analysis;
            console.log(`Updated analysis for ${currentSymbol}`);
          } else {
            analysisResults.push(analysis);
            console.log(`Added new analysis for ${currentSymbol}`);
          }
          writeResultsWithBestToken(analysisResults, OUTPUT_FILE);
        } else if (!analysis) {
          console.warn(`Skipping ${currentSymbol}: Not a memecoin or no valid analysis returned.`);
        }
      } catch (e: any) {
        if (e.message === 'RATE_LIMIT_EXCEEDED') {
          console.log('Daily rate limit exceeded. Stopping analysis until quota resets.');
          console.log('The analyzer will resume automatically when you restart it after quota reset.');
          break;
        }
        console.error(`Error analyzing token ${currentSymbol}:`, e);
      }
      currentIndex++;
      console.log(`Waiting 30 seconds before next analysis...`);
      await new Promise(res => setTimeout(res, 30 * 1000));
    }
  }

  // Start initial processing queue for new tokens
  await processTokenQueue(tokensToAnalyze);

  // Set up daily full re-analysis of all tokens
  setInterval(async () => {
    try {
      console.log('Starting daily full re-analysis of all memecoins...');
      await processTokenQueue(tokenQueue);
      console.log('Daily full re-analysis complete.');
    } catch (e) {
      console.error('Error during daily full re-analysis:', e);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
}

main().catch(console.error);
