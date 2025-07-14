interface TokenCoin {
  name: string;
  symbol: string;
  symbol1: string;
  price: string;
  volume: string;
  liquidity: string;
  mcap: string;
  transactions: string;
  age: string;
  'change-5m': string;
  'change-1h': string;
  'change-6h': string;
  'change-24h': string;
  href: string;
}

interface TokenDataResponse {
  data: TokenCoin[];
}

export interface FormattedMemecoin {
  id: number;
  symbol: string;
  symbol1: string;
  price: number;
  volume: string;
  marketCap: string;
  change24h: number;
  age: string;
  favorite: boolean;
  potential: number;
  risk: number;
  href: string; // add href to interface
}

// Function to parse price strings, handling various formats
const parsePrice = (priceStr: string): number => {
  // Remove commas and any non-numeric characters except dots
  const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
  
  // Parse the cleaned string
  const price = parseFloat(cleaned);
  
  // If parsing fails or results in NaN, return 0
  return isNaN(price) ? 0 : price;
};

// Function to parse percentage change
const parseChange = (changeStr: string): number => {
  if (changeStr === 'N/A') return 0;
  
  // Extract the number and remove the % sign
  const cleaned = changeStr.replace(/[^\d.-]/g, '');
  
  // Parse the cleaned string
  const change = parseFloat(cleaned);
  
  // If parsing fails or results in NaN, return 0
  return isNaN(change) ? 0 : change;
};

// Function to determine risk score based on price volatility and other factors
const calculateRisk = (price: number, changeStr: string): number => {
  const change = parseChange(changeStr);
  // Higher volatility means higher risk
  const volatilityRisk = Math.min(Math.abs(change), 10);
  // Very low-priced coins are generally riskier
  const priceRisk = price < 0.001 ? 8 : price < 0.01 ? 6 : price < 0.1 ? 5 : 3;
  // Return weighted average
  return Math.min(Math.round((volatilityRisk * 0.6 + priceRisk * 0.4)), 10);
};

// Function to determine potential score
const calculatePotential = (price: number, changeStr: string): number => {
  const change = parseChange(changeStr);
  // Coins with positive recent changes have higher potential
  const changePotential = change > 5 ? 8 : change > 0 ? 6 : 4;
  // Low-priced coins have higher potential for big percentage moves
  const pricePotential = price < 0.001 ? 9 : price < 0.01 ? 7 : price < 0.1 ? 6 : 5;
  // Return weighted average
  return Math.min(Math.round((changePotential * 0.5 + pricePotential * 0.5)), 10);
};

// Helper function to parse price strings to numbers
const parseNumericValue = (valueStr: string | undefined): number => {
  if (!valueStr || valueStr === 'N/A') return 0;
  
  // Remove commas, currency symbols, and any non-numeric characters except dots
  const cleaned = valueStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
  
  // Parse the cleaned string
  const value = parseFloat(cleaned);
  
  // If parsing fails or results in NaN, return 0
  return isNaN(value) ? 0 : value;
};

const processTokenData = (data: any[]): FormattedMemecoin[] => {
  return data.map((item, index) => {
    // Helper function to ensure price is a number
    const ensureNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    
    // Helper function to ensure change is a number
    const ensureChangeNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    
    // Convert AI analysis format to memecoin format
    return {
      id: index + 1,
      symbol: item.symbol,
      symbol1: item.symbol1 || '',
      price: ensureNumber(item.price),
      volume: item.volume,
      marketCap: item.marketCap,
      change24h: ensureChangeNumber(item.change24h),
      age: item.age,
      favorite: false,
      potential: item.investmentPotential,
      risk: item.risk,
      href: item.href
    };
  });
};

export const fetchTokenData = async (): Promise<FormattedMemecoin[]> => {
  try {
    // Add cache-busting query param
    const response = await fetch(`/api/token-data?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      console.warn('API request failed, using fallback data');
      return [];
    }
    const raw = await response.json();
    // Support both { data: [...] } and { results: [...] } formats
    const tokens: any[] = Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.results)
        ? raw.results
        : [];
    if (!tokens.length) {
      console.warn('No token data found in API response');
      return [];
    }
    return processTokenData(tokens);
  } catch (error) {
    console.error('Error fetching Token data:', error);
    return [];
  }
};
