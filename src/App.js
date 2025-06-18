import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlephiumWalletProvider, AlephiumConnectButton, useWallet } from '@alephium/web3-react';
import { NodeProvider } from '@alephium/web3';
import TokenSelector from './components/TokenSelector';
import AmountInput from './components/AmountInput';
import { useBalance } from '@alephium/web3-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSliders } from '@fortawesome/free-solid-svg-icons';
import './App.css';

// Initialize global node provider
const nodeProvider = new NodeProvider('https://lb-fullnode-alephium.notrustverify.ch');

function SwapInterface() {
  const { account, connectionStatus, signer } = useWallet();
  const { balance } = useBalance();
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [amount, setAmount] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextUpdateIn, setNextUpdateIn] = useState(20);
  const [tokens, setTokens] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [txStatus, setTxStatus] = useState(null);
  const [pendingTxId, setPendingTxId] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [completedTx, setCompletedTx] = useState(null);
  const [slippage, setSlippage] = useState(1); // 1% default
  const [showSettings, setShowSettings] = useState(false);
  const tokensLoaded = useRef(false);
  const [isRefreshSpinning, setIsRefreshSpinning] = useState(false);

  // Debug logging for balance and connection status
  useEffect(() => {
    if (balance) {
      console.log('Balance:', balance);
    }
    if (connectionStatus) {
      console.log('Connection status:', connectionStatus);
    }
  }, [balance, connectionStatus]);


  // Log wallet connection status changes
  useEffect(() => {
    if (connectionStatus === 'connected' && account) {
      // Wallet connected, no need to log details
    } else if (connectionStatus === 'disconnected') {
      // Wallet disconnected
    } else if (connectionStatus === 'connecting') {
      // Connecting to wallet
    }
  }, [connectionStatus, account, nodeProvider]);

  // Replace example sender with actual wallet account when connected
  const getSenderInfo = () => {
    if (connectionStatus === 'connected' && account && signer) {
      return {
        address: account.address,
        publicKey: account.publicKey,
        recipient: account.address,
        group: account.group
      };
    }

  };

  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const fetchQuote = useCallback(async (isAutoRefresh = false) => {
    // Don't fetch quote if transaction is being validated
    if (isValidating || txStatus || isRefreshing) {
      return;
    }

    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    // Check if amount exceeds balance
    let userBalance = 0;
    if (fromToken.symbol === 'ALPH') {
      userBalance = parseFloat(balance?.balance || 0) / Math.pow(10, 18);
    } else {
      const tokenBalance = balance?.tokenBalances?.find(t => t.id === fromToken.id);
      userBalance = tokenBalance ? parseFloat(tokenBalance.amount) / Math.pow(10, fromToken.decimals) : 0;
    }

    if (!isAutoRefresh) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const senderInfo = getSenderInfo();
      const requestBody = {
        tokenIn: fromToken.id,
        tokenOut: toToken.id,
        amountIn: rawAmount,
        slippage: slippage*100,
        senderAddress: senderInfo.address,
        senderPublicKey: senderInfo.publicKey,
        recipient: senderInfo.recipient
      };
      const response = await fetch('https://api.linxlabs.org/v1/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });
      console.log(response);
      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || 'Failed to get quote');
      }

      setQuote(responseData.data);
    } catch (err) {
      console.error('Quote error:', err);
      setError(err.message || 'Failed to get quote. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fromToken, toToken, amount, rawAmount, account, signer, balance, slippage, isValidating, txStatus, isRefreshing]);

  // Auto-refresh effect
  useEffect(() => {
    if (!pendingTxId) return;

    const interval = setInterval(() => {
      if (!isRefreshing && !isValidating) {
        fetchQuote(true);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [pendingTxId, fetchQuote, isRefreshing, isValidating]);

  // Single effect for quote updates
  useEffect(() => {
    let isSubscribed = true;
    let timeoutId = null;

    const updateQuote = async () => {
      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || isValidating) {
        setQuote(null);
        setNextUpdateIn(30);
        return;
      }

      if (isSubscribed) {
        await fetchQuote(false);
        setNextUpdateIn(30);
      }
    };

    // Initial update
    updateQuote();

    // Timer for countdown display
    const interval = setInterval(() => {
      if (!isSubscribed) return;
      
      setNextUpdateIn(prev => {
        const next = prev - 1;
        if (next <= 0) {
          // Schedule the next update
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(updateQuote, 0);
          return 30;
        }
        return next;
      });
    }, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fromToken?.id, toToken?.id, amount, isValidating, fetchQuote, slippage]);

  const handleRefresh = () => {
    if (!isRefreshing && !isValidating) {
      setIsRefreshSpinning(true);
      setTimeout(() => setIsRefreshSpinning(false), 1000);
      fetchQuote(false);
      setNextUpdateIn(30);
    }
  };

  // Function to find token by ID or symbol
  const findToken = useCallback((idOrSymbol, tokenList) => {
    if (!idOrSymbol || !tokenList?.length) return null;
    const searchTerm = idOrSymbol.toLowerCase();
    return tokenList.find(token => 
      token.id.toLowerCase() === searchTerm || 
      token.symbol.toLowerCase() === searchTerm
    );
  }, []);

  // Fetch tokens and handle URL parameters
  useEffect(() => {
    const fetchTokensAndHandleParams = async () => {
      // Skip if tokens are already loaded
      if (tokensLoaded.current) return;
      tokensLoaded.current = true;

      setIsLoadingTokens(true);
      try {
        const response = await fetch('https://api.linxlabs.org/v1/tokens', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch tokens');
        }

        const data = await response.json();
        setTokens(data);

        // Handle URL parameters after tokens are loaded
        const urlParams = new URLSearchParams(window.location.search);
        const srcParam = urlParams.get('src');
        const dstParam = urlParams.get('dst');

        if (srcParam) {
          const sourceToken = findToken(srcParam, data);
          if (sourceToken) {
            setFromToken(sourceToken);
          }
        }

        if (dstParam) {
          const destToken = findToken(dstParam, data);
          if (destToken) {
            setToToken(destToken);
          }
        }
      } catch (err) {
        console.error('Error fetching tokens:', err);
        setError('Failed to load tokens. Please refresh the page.');
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchTokensAndHandleParams();
  }, []); // Only run once on mount

  // Update URL when tokens change
  useEffect(() => {
    if (isLoadingTokens) return; // Don't update URL while tokens are loading

    const params = new URLSearchParams();
    if (fromToken) {
      params.set('src', fromToken.symbol.toLowerCase());
    }
    if (toToken) {
      params.set('dst', toToken.symbol.toLowerCase());
    }
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
      
    window.history.replaceState({}, '', newUrl);
  }, [fromToken, toToken, isLoadingTokens]);

  // Check transaction status
  const checkTxStatus = async (txId) => {
    try {
      const response = await nodeProvider.transactions.getTransactionsStatus({ txId });
      return response;
    } catch (error) {
      console.error('Error checking transaction status:', error);
      return null;
    }
  };

  // Monitor transaction status
  useEffect(() => {
    let intervalId;

    const monitorTxStatus = async () => {
      if (!pendingTxId) return;

      try {
        const status = await checkTxStatus(pendingTxId);
        setTxStatus(status.type);

        if (status.type === 'Confirmed') {
          setTxStatus('Done');
          setCompletedTx(pendingTxId);
          setPendingTxId(null);

        }
      } catch (err) {
        if (err.message && err.message.includes('404')) {
          setTxStatus('Loading');
        } else {
          console.error('Error checking transaction status:', err);
        }
      }
    };

    if (pendingTxId) {
      monitorTxStatus();
      intervalId = setInterval(monitorTxStatus, 5000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [pendingTxId]);

  const validateTransaction = async (txId) => {
    setIsValidating(true);
    setTxStatus('Validating transaction...');

    try {
      let attempts = 0;
      const maxAttempts = 120; // 30 seconds max
      
      while (attempts < maxAttempts) {
        const status = await checkTxStatus(txId);
        
        if (!status) {
          setTxStatus('Checking transaction status...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          continue;
        }

        if (status.type === 'MemPool') {
          setTxStatus('Transaction in memory pool...');
          setPendingTxId(txId);
          setIsValidating(false);
          return true;
        }

        if (status.type === 'Confirmed') {
          setTxStatus('Transaction confirmed!');
          setCompletedTx(txId);
          setPendingTxId(null);
          setIsValidating(false);
          // Only clear quote
          setQuote(null);
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      setTxStatus('Transaction validation timeout. Please check explorer.');
      setIsValidating(false);
      return false;
    } catch (error) {
      console.error('Transaction validation error:', error);
      setTxStatus('Transaction validation failed. Please check explorer.');
      setIsValidating(false);
      return false;
    }
  };

  const handleSwap = async () => {
    if (!quote || !signer) return;

    try {
      setLoading(true);
      setError(null);
      setTxStatus('Preparing transaction...');
      
      setTxStatus('Waiting for wallet approval...');
      const signerAddress = (await signer.getSelectedAccount()).address;
      const txResult = await signer.signAndSubmitUnsignedTx({
        signerAddress: signerAddress,
        unsignedTx: quote.transaction.unsignedTx
      });
      
      if (txResult?.txId) {
        setTxStatus('Transaction submitted...');
        await validateTransaction(txResult.txId);
      } else {
        throw new Error('Failed to submit transaction');
      }
    } catch (err) {
      console.error('Swap error:', err);
      setError(err.message || 'Failed to execute swap. Please try again.');
      setTxStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setQuote(null);
    setAmount('');
    setRawAmount('');
  };

  const formatAmount = (value, decimals) => {
    if (!value) return '';
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue)) return '';
    return (parsedValue / Math.pow(10, decimals)).toFixed(6);
  };

  const calculateRate = () => {
    if (!quote?.quote?.totalOutput) return '0';
    const amountIn = parseFloat(amount);
    const amountOut = parseFloat(quote.quote.totalOutput) / Math.pow(10, toToken.decimals);
    return (amountOut / amountIn).toFixed(6);
  };

  const formatUsdValue = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatRoute = (route) => {
    return route.map(hop => hop.dex).join(' → ');
  };

  const getDexLink = (dex) => {
    const dexMap = {
      'elexium': 'https://elexium.finance',
      'ayin': 'https://ayin.app'
    };
    return dexMap[dex.toLowerCase()] || '#';
  };

  const formatDexName = (dex) => {
    return dex.charAt(0).toUpperCase() + dex.slice(1).toLowerCase();
  };

  const handleAmountChange = (value) => {
    setAmount(value);
    if (fromToken && value) {
      const raw = (parseFloat(value) * Math.pow(10, fromToken.decimals)).toLocaleString('fullwide', { useGrouping: false });
      setRawAmount(raw);
    } else {
      setRawAmount('');
    }
  };

  const handleFromTokenSelect = (token) => {
    setFromToken(token);
    setCompletedTx(null);
    setTxStatus(null);
  };

  const handleToTokenSelect = (token) => {
    setToToken(token);
    setCompletedTx(null);
    setTxStatus(null);
  };

  // Add effect to monitor balance changes
  useEffect(() => {
    console.log('Balance updated:', balance);
  }, [balance]);

  const calculatePriceImpact = (quote) => {
    if (!quote?.quote?.allocations?.[0]) return null;

  const allocation = quote.quote.allocations[0];
  const pool = allocation.route[0];

  // Convert reserves to numbers using token decimals
  const reserveA = parseFloat(pool.reserveA) / Math.pow(10, fromToken.decimals);
  const reserveB = parseFloat(pool.reserveB) / Math.pow(10, toToken.decimals);

  // Parse input amount (Token A) and output amount (Token B)
  const amountIn = parseFloat(amount);
  const amountOut = parseFloat(quote.quote.totalOutput) / Math.pow(10, toToken.decimals);

  // Market price before trade
  const marketPrice = reserveA / reserveB;

  // Effective price paid
  const effectivePrice = amountIn / amountOut;

  // Price impact
  const priceImpact = ((effectivePrice - marketPrice) / marketPrice) * 100;
  return Math.abs(priceImpact).toFixed(2);
  };

  const handleMaxAmount = async () => {
    if (!fromToken || fromToken.id === "0000000000000000000000000000000000000000000000000000000000000000" || !balance) return;
    
    const tokenBalance = balance.tokenBalances?.find(t => t.id === fromToken.id);
    if (tokenBalance) {
      const displayAmount = (parseFloat(tokenBalance.amount) / Math.pow(10, fromToken.decimals)).toLocaleString('fullwide', { useGrouping: false });
      setAmount(displayAmount);
      setRawAmount(tokenBalance.amount);
    }
  };

  const handleSlippageChange = (value) => {
    setSlippage(value);
  };

  return (
    <div className="App">
      <div className="wallet-header">
        <AlephiumConnectButton 
          displayAccount={(account) => `${account.address.slice(0, 4)}${account.address.slice(-4)}`}
        />

      </div>
      
      <div className="swap-container">
        <div className="swap-header">
          <h1>Swap</h1>
          <div className="swap-actions">
            {quote && (
              <div className="update-timer">
                Updates in {nextUpdateIn}s
              </div>
            )}
            <button className="icon-button" onClick={() => handleRefresh()}>
              <span className={`refresh-icon ${isRefreshSpinning ? 'spinning' : ''}`}>↻</span>
            </button>
            <button className="icon-button" onClick={() => setShowSettings(true)}>
              <FontAwesomeIcon icon={faSliders} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="settings-modal">
            <div className="settings-content">
              <div className="settings-header">
                <button className="back-button" onClick={() => setShowSettings(false)}>←</button>
                <h2>Swap settings</h2>
              </div>
              
              <div className="settings-section">
                <h3>Slippage tolerance</h3>
                <div className="slippage-options">
                  <button 
                    className={`slippage-button ${slippage === 0.1 ? 'active' : ''}`}
                    onClick={() => handleSlippageChange(0.1)}
                  >
                    0.1%
                  </button>
                  <button 
                    className={`slippage-button ${slippage === 0.5 ? 'active' : ''}`}
                    onClick={() => handleSlippageChange(0.5)}
                  >
                    0.5%
                  </button>
                  <button 
                    className={`slippage-button ${slippage === 1 ? 'active' : ''}`}
                    onClick={() => handleSlippageChange(1)}
                  >
                    1%
                  </button>
                </div>
              </div>

              {quote && (
                <div className="quote-row">
                  <span>Max slippage</span>
                  <span>{slippage}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="swap-box">
          {isLoadingTokens ? (
            <div className="loading-message">Loading tokens...</div>
          ) : (
            <>
              <div className="swap-section">
                <div className="swap-header">
                  <span>You pay</span>
                  {fromToken && fromToken.id !== "0000000000000000000000000000000000000000000000000000000000000000" && balance?.tokenBalances?.some(t => t.id === fromToken.id) && (
                    <button className="max-button" onClick={handleMaxAmount}>MAX</button>
                  )}
                </div>
                <div className="token-input-container">
                  <AmountInput
                    value={amount}
                    onChange={handleAmountChange}
                    disabled={!fromToken || !toToken}
                  />
                  <TokenSelector
                    selectedToken={fromToken}
                    onSelect={handleFromTokenSelect}
                    tokens={tokens.filter(token => {
                      if (token.id === "0000000000000000000000000000000000000000000000000000000000000000") {
                        return parseFloat(balance?.balance || 0) > 0;
                      }
                      return balance?.tokenBalances?.some(tb => tb.id === token.id && parseFloat(tb.amount) > 0);
                    })}
                  />
                </div>
                <div className="network-label">on Alephium</div>
              </div>
              
              <div className="swap-arrow-container">
                <button 
                  className="swap-arrow" 
                  onClick={switchTokens}
                  disabled={!fromToken || !toToken || connectionStatus !== 'connected'}
                >
                  ↓
                </button>
              </div>
              
              <div className="swap-input">
                <div className="swap-input-header">You receive</div>
                <div className="swap-input-row">
                  <AmountInput
                    value={quote ? formatAmount(quote.quote.totalOutput, toToken?.decimals || 18) : ''}
                    onChange={() => {}}
                    disabled={true}
                  />
                  <TokenSelector
                    selectedToken={toToken}
                    onSelect={handleToTokenSelect}
                    tokens={tokens.filter(token => {
                      // For the "to" token selector, we don't need to check balance
                      // Just exclude the "from" token
                      return token.id !== fromToken?.id;
                    })}
                  />
                </div>
                {toToken && quote && (
                  <div className="network-info">
                    on {toToken.network || 'Alephium'}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {txStatus && (
            <div className={`transaction-status ${completedTx ? 'success' : 'pending'}`}>
              {txStatus}
              {completedTx && (
                <a
                  href={`https://explorer.alephium.org/transactions/${completedTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                >
                  View in Explorer ↗
                </a>
              )}
            </div>
          )}
          
          {connectionStatus !== 'connected' ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <AlephiumConnectButton />
            </div>
          ) : (
            <button
              className="swap-button"
              onClick={handleSwap}
              disabled={!quote || loading || isValidating}
            >
              {loading ? 'Loading...' : 
               isValidating ? 'Validating...' : 
               !fromToken || !toToken ? 'Select tokens' :
               !amount ? 'Enter amount' :
               'Swap'}
            </button>
          )}

          {quote && quote.quote.allocations && quote.quote.allocations.length > 0 && (
            <div className="quote-info">
              <div className="quote-row">
                <span>Exchange rate</span>
                <span>1 {fromToken.symbol} = {calculateRate()} {toToken.symbol}</span>
              </div>

              <div className="quote-row">
                <span>Max slippage</span>
                <span>{slippage}%</span>
              </div>

              {quote.quote.allocations.length > 0 && (
                <div className="quote-row">
                  <span>DEX</span>
                  <span>
                    <a
                      href={getDexLink(quote.quote.allocations[0].route[0].dex)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dex-link"
                    >
                      {formatDexName(quote.quote.allocations[0].route[0].dex)} ↗
                    </a>
                  </span>
                </div>
              )}
              
              {quote.quote.allocations.length > 1 && (
                <div className="routes-section">
                  <div className="routes-header">Routes</div>
                  {quote.quote.allocations.map((allocation, index) => (
                    <div key={index} className="route-row">
                      <div className="route-percentage">
                        {((parseFloat(allocation.output) / parseFloat(quote.quote.totalOutput)) * 100).toFixed(1)}%
                      </div>
                      <div className="route-path">
                        {formatRoute(allocation.route)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="attribution-footer">
            API provided by <a href="https://linxlabs.org" target="_blank" rel="noopener noreferrer">Linx Labs</a> · 
            Infrastructure by <a href="https://notrustverify.ch" target="_blank" rel="noopener noreferrer">No Trust Verify</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AlephiumWalletProvider
      network="mainnet"
      addressGroup={0}
      nodeProvider={nodeProvider}
      theme="rounded"
      enableDebugLog={true}
    >
      <div className="App">
        <SwapInterface />
      </div>
    </AlephiumWalletProvider>
  );
}

export default App;




