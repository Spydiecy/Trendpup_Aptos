import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());

// Serve ai_analyzer.json as token data with all market data included
app.get('/api/token-data', (req: Request, res: Response) => {
  const filePath = path.join(__dirname, '../ai_analyzer.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      let jsonData = JSON.parse(data);
      // Extract results array and filter out incomplete entries
      const allTokens = Array.isArray(jsonData.results) ? jsonData.results : [];
      // Filter out entries that don't have required fields (symbol, risk, investmentPotential)
      const completeTokens = allTokens.filter((token: any) => 
        token.symbol && 
        typeof token.risk === 'number' && 
        typeof token.investmentPotential === 'number' &&
        token.rationale && 
        token.rationale.trim() !== ''
      );
      console.log(`Filtered tokens: ${completeTokens.length} out of ${allTokens.length} total`);
      res.json({ data: completeTokens });
    } catch (err) {
      res.status(500).json({ error: 'Failed to parse token data', data: [] });
    }
  } else {
    res.status(404).json({ error: 'Token data file not found', data: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API server running on port ${PORT}`);
});
