export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  network?: string;
}

export interface Quote {
  quote: {
    allocations: Array<{
      route: Array<{
        id: string;
        address: string;
        dex: string;
      }>;
      amount: string;
      output: string;
    }>;
    totalOutput: string;
  };
  transaction: {
    unsignedTx: string;
    txId: string;
  };
  route: Array<{
    dex: string;
    amountOut: string;
  }>;
}

export interface Route {
  dex: string;
  path: string[];
  amountIn: string;
  amountOut: string;
}

export interface TokenBalance {
  id: string;
  amount: string;
}

export interface Balance {
  balance: string;
  tokenBalances: TokenBalance[];
}

export interface SenderInfo {
  address: string;
  publicKey: string;
  recipient: string;
  group: number;
}

export interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number;
  senderAddress: string;
  senderPublicKey: string;
  recipient: string;
}

export interface QuoteResponse {
  success: boolean;
  data: Quote;
  message?: string;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | null; 