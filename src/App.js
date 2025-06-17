import React, { useState, useEffect, useCallback } from 'react';
import { AlephiumWalletProvider, AlephiumConnectButton, useWallet } from '@alephium/web3-react';
import { NodeProvider } from '@alephium/web3';
import TokenSelector from './components/TokenSelector';
import AmountInput from './components/AmountInput';
import { useBalance } from '@alephium/web3-react';
import './App.css';

// Initialize global node provider
const nodeProvider = new NodeProvider('https://lb-fullnode-alephium.notrustverify.ch');

function SwapInterface() {
  const { account, connectionStatus, signer } = useWallet();
  const { balance } = useBalance();
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBalanceRefreshing, setIsBalanceRefreshing] = useState(false);
  const [nextUpdateIn, setNextUpdateIn] = useState(30);
  const [tokens, setTokens] = useState([]);
  const [txStatus, setTxStatus] = useState(null);
  const [pendingTxId, setPendingTxId] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [completedTx, setCompletedTx] = useState(null);

  // Debug logging for balance and connection status
  useEffect(() => {
    console.log('=== Balance Debug ===');
    console.log('Connection Status:', connectionStatus);
    console.log('Account:', account);
    console.log('Balance:', balance);
    if (balance) {
      console.log('ALPH Balance:', balance.balance);
      console.log('Token Balances:', balance.tokenBalances);
    }
    console.log('==================');

    // Force UI update when wallet connects
    if (connectionStatus === 'connected' && account) {
      console.log('Wallet connected, updating UI...');
      handleRefreshBalance();
    }
  }, [connectionStatus, account, balance]);

  // Handle balance refresh
  const handleRefreshBalance = () => {
    if (isBalanceRefreshing) return;
    setIsBalanceRefreshing(true);
    
    // Force a re-render of token selectors
    setFromToken(prev => prev ? {...prev} : null);
    setToToken(prev => prev ? {...prev} : null);
    
    // Reset the refreshing state after a delay
    setTimeout(() => setIsBalanceRefreshing(false), 1000);
  };

  // Log wallet connection status changes
  useEffect(() => {
    console.log('Wallet connection status:', connectionStatus);
    if (connectionStatus === 'connected' && account) {
      console.log('=== Wallet Connected ===');
      console.log('Address:', account.address);
      console.log('Public Key:', account.publicKey);
      console.log('Group:', account.group);
      console.log('Network:', nodeProvider?.network);
      console.log('=====================');
    } else if (connectionStatus === 'disconnected') {
      console.log('Wallet disconnected');
    } else if (connectionStatus === 'connecting') {
      console.log('Connecting to wallet...');
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
    if (isValidating || txStatus) {
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

    if (parseFloat(amount) > userBalance) {
      setError(`Insufficient ${fromToken.symbol} balance`);
      setQuote(null);
      return;
    }

    if (!isAutoRefresh) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const amountInSmallestUnit = (parseFloat(amount) * Math.pow(10, fromToken.decimals)).toString();
      const senderInfo = getSenderInfo();

      const requestBody = {
        tokenIn: fromToken.id,
        tokenOut: toToken.id,
        amountIn: amountInSmallestUnit,
        slippage: 100,
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
  }, [fromToken, toToken, amount, account, signer, balance]);

  // Manual refresh
  const handleRefresh = () => {
    fetchQuote();
  };

  // Initial quote fetch when inputs change
  const debouncedFetchQuote = useCallback(
    debounce((isAutoRefresh) => fetchQuote(isAutoRefresh), 500),
    [fetchQuote]
  );

  // Effect for input changes
  useEffect(() => {
    debouncedFetchQuote(false);
  }, [fromToken?.id, toToken?.id, amount, debouncedFetchQuote]);

  // Auto-refresh effect
  useEffect(() => {
    let intervalId;
    
    // Don't set up auto-refresh if transaction is being validated
    if (isValidating || txStatus) {
      return;
    }
    
    if (fromToken && toToken && amount && parseFloat(amount) > 0) {
      intervalId = setInterval(() => {
        fetchQuote(true);
      }, 30000); // 30 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fromToken, toToken, amount, fetchQuote, isValidating, txStatus]);

  // Fetch tokens on mount
  useEffect(() => {
    const fetchTokens = async () => {
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
      } catch (err) {
        console.error('Error fetching tokens:', err);
      }
    };

    fetchTokens();
  }, []);

  // Check transaction status
  const checkTxStatus = async (txId) => {
    try {
      const response = await nodeProvider.transactions.getTransactionsStatus({ txId });
      console.log('Transaction status:', response);
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
          // Force UI update after transaction is confirmed
          handleRefreshBalance();
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
        console.log('Checking status:', status);
        
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
          // Force UI update after confirmation
          handleRefreshBalance();
          // Clear input state
          setAmount('');
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

      console.log('transaction id', txResult.txId);
      
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
  };

  const formatAmount = (value, decimals) => {
    if (!value) return '';
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue)) return '';
    return (parsedValue / Math.pow(10, decimals)).toFixed(6);
  };

  const calculateRate = () => {
    if (!quote || !amount || !fromToken || !toToken) return null;
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

  const handleAmountChange = (newAmount) => {
    setAmount(newAmount);
    setCompletedTx(null);
    setTxStatus(null);
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

  // Function to find token by ID or symbol
  const findToken = useCallback((idOrSymbol, tokenList) => {
    if (!idOrSymbol || !tokenList?.length) return null;
    const searchTerm = idOrSymbol.toLowerCase();
    return tokenList.find(token => 
      token.id.toLowerCase() === searchTerm || 
      token.symbol.toLowerCase() === searchTerm
    );
  }, []);

  // Handle URL parameters for token pre-selection
  useEffect(() => {
    const handleUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const srcParam = urlParams.get('src');
      const dstParam = urlParams.get('dst');

      if (!tokens.length) return;

      if (srcParam) {
        const sourceToken = findToken(srcParam, tokens);
        if (sourceToken) {
          setFromToken(sourceToken);
        }
      }

      if (dstParam) {
        const destToken = findToken(dstParam, tokens);
        if (destToken) {
          setToToken(destToken);
        }
      }
    };

    handleUrlParams();
  }, [tokens, findToken]);

  // Update URL when tokens change
  useEffect(() => {
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
  }, [fromToken, toToken]);

  // Effect for countdown timer
  useEffect(() => {
    let timerId;
    
    // Don't start countdown if transaction is being validated
    if (isValidating || txStatus) {
      return;
    }
    
    if (fromToken && toToken && amount && parseFloat(amount) > 0) {
      setNextUpdateIn(30);
      
      timerId = setInterval(() => {
        setNextUpdateIn(prev => {
          if (prev <= 1) {
            return 30; // Reset to 30 when it reaches 0
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [fromToken, toToken, amount, quote, isValidating, txStatus]);

  return (
    <div className="App">
      <div className="wallet-header">
        <AlephiumConnectButton 
          displayAccount={(account) => `${account.address.slice(0, 4)}${account.address.slice(-4)}`}
        />
        {connectionStatus === 'connected' && account && (
          <div className="wallet-info">
            <span>Group: {account.group}</span>
            <button 
              className={`refresh-balance-button ${isBalanceRefreshing ? 'refreshing' : ''}`}
              onClick={handleRefreshBalance}
              disabled={isBalanceRefreshing}
              title="Refresh balance"
            >
              ↻
            </button>
          </div>
        )}
      </div>
      
      <div className="swap-container">
        <div className="swap-header">
          <h1>Swap</h1>
          <div className="swap-actions">
            {connectionStatus === 'connecting' && <span>Connecting...</span>}
            {quote && (
              <div className="update-timer">
                Updates in {nextUpdateIn}s
              </div>
            )}
            <button 
              className={`action-button ${isRefreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={loading || isRefreshing || !quote}
            >
              ↻
            </button>
          </div>
        </div>

        <div className="swap-box">
          <div className="swap-input">
            <div className="swap-input-header">You pay</div>
            <div className="swap-input-row">
              <AmountInput
                value={amount}
                onChange={handleAmountChange}
                disabled={!fromToken || connectionStatus !== 'connected'}
                maxAmount={fromToken && balance ? (
                  fromToken.symbol === 'ALPH' 
                    ? parseFloat(balance?.balance || 0) / Math.pow(10, 18)
                    : parseFloat(balance?.tokens?.find(t => t.id === fromToken.id)?.amount || 0) / Math.pow(10, fromToken.decimals)
                ) : undefined}
              />
              <TokenSelector
                selectedToken={fromToken}
                onSelect={handleFromTokenSelect}
                showOnlyWithBalance={true}
                excludeToken={toToken}
              />
            </div>
            {fromToken && (
              <div className="network-info">
                on {fromToken.network || 'Alephium'}
              </div>
            )}
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
                showOnlyWithBalance={false}
                excludeToken={fromToken}
              />
            </div>
            {toToken && quote && (
              <div className="network-info">
                on {toToken.network || 'Alephium'}
              </div>
            )}
          </div>

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

