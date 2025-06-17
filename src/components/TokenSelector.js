import React, { useState, useRef, useEffect } from 'react';
import { useBalance } from '@alephium/web3-react';
import './TokenSelector.css';

function TokenSelector({ selectedToken, onSelect, showOnlyWithBalance = false, excludeToken = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const selectorRef = useRef(null);
  const { balance } = useBalance();
  const [tokens, setTokens] = useState([]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Log balance data
  useEffect(() => {
    console.log('=== Balance Data ===');
    console.log('Balance:', balance);
    if (balance) {
      console.log('ALPH Balance:', balance.alphs?.toString());
      console.log('Token Balances:', balance.tokenBalances);
    }
    console.log('==================');
  }, [balance]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Fetch tokens
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

  // Get token balance
  const getTokenBalance = (tokenId) => {
    if (!balance) return '0';
    
    // Handle ALPH token
    if (tokenId === 'ALPH') {
      const alphBalance = balance.balance;
      if (alphBalance) {
        return (parseFloat(alphBalance) / Math.pow(10, 18)).toFixed(4);
      }
      return '0';
    }
    
    // Handle other tokens
    const tokenBalances = balance.tokenBalances || [];
    const tokenData = tokenBalances.find(t => t.id === tokenId);
    if (!tokenData) return '0';
    
    const token = tokens.find(t => t.id === tokenId);
    const decimals = token?.decimals || 18;
    return (parseFloat(tokenData.amount) / Math.pow(10, decimals)).toFixed(4);
  };

  // Filter tokens to only show ones with balance
  const hasBalance = (token) => {
    const balance = getTokenBalance(token.symbol === 'ALPH' ? 'ALPH' : token.id);
    return parseFloat(balance) > 0;
  };

  const filteredTokens = tokens
    .filter(token => {
      // Exclude the token that's selected in the other selector
      if (excludeToken && token.id === excludeToken.id) {
        return false;
      }

      const matchesSearch = 
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!showOnlyWithBalance) {
        return matchesSearch;
      }

      return token.symbol === 'ALPH' || (matchesSearch && hasBalance(token));
    });

  // Log tokens when they're fetched
  useEffect(() => {
    console.log('Available tokens:', tokens);
  }, [tokens]);

  // Force re-render when balance changes
  useEffect(() => {
    if (selectedToken) {
      const currentBalance = getTokenBalance(selectedToken.symbol === 'ALPH' ? 'ALPH' : selectedToken.id);
      console.log(`Balance updated for ${selectedToken.symbol}:`, currentBalance);
    }
  }, [balance, selectedToken]);

  const handleTokenSelect = (token) => {
    onSelect(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="token-selector" ref={selectorRef}>
      <div 
        className="token-selector-button" 
        onClick={() => setIsOpen(true)}
      >
        {selectedToken ? (
          <>
            <img 
              src={selectedToken.logoURI} 
              alt={selectedToken.symbol}
              className="token-logo"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/30';
              }}
            />
            <div className="token-info-container">
              <div className="token-symbol">{selectedToken.symbol}</div>
              <div className="token-balance">
                {getTokenBalance(selectedToken.symbol === 'ALPH' ? 'ALPH' : selectedToken.id)}
              </div>
            </div>
            <span className="token-arrow">▼</span>
          </>
        ) : (
          <>
            <span>Select Token</span>
            <span className="token-arrow">▼</span>
          </>
        )}
      </div>

      {isOpen && (
        <div className="token-dropdown">
          <input
            ref={searchInputRef}
            type="text"
            className="token-search"
            placeholder="Search by name or paste address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="token-list">
            {filteredTokens.length === 0 ? (
              <div className="token-list-message">
                {showOnlyWithBalance ? 'No tokens found with balance' : 'No tokens found'}
              </div>
            ) : (
              filteredTokens.map(token => (
                <div
                  key={token.id}
                  className="token-item"
                  onClick={() => handleTokenSelect(token)}
                >
                  <img 
                    src={token.logoURI} 
                    alt={token.symbol}
                    className="token-logo"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/30';
                    }}
                  />
                  <div className="token-info">
                    <div className="token-symbol">{token.symbol}</div>
                    <div className="token-name">{token.name}</div>
                  </div>
                  <div className="token-balance">
                    {getTokenBalance(token.symbol === 'ALPH' ? 'ALPH' : token.id)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenSelector; 