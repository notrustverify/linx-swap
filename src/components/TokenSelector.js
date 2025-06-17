import React, { useState, useRef, useEffect } from 'react';
import { useBalance, useWallet } from '@alephium/web3-react';
import './TokenSelector.css';

function TokenSelector({ selectedToken, onSelect, showOnlyWithBalance = false, excludeToken = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const selectorRef = useRef(null);
  const { connectionStatus } = useWallet();
  const { balance } = useBalance();
  const [tokens, setTokens] = useState([]);

  // Debug logging for balance
  useEffect(() => {
    console.log('=== TokenSelector Balance Debug ===');
    console.log('Connection Status:', connectionStatus);
    console.log('Balance:', balance);
    if (balance) {
      console.log('ALPH Balance:', balance.alphs);
      console.log('Token Balances:', balance.tokens);
    }
    console.log('Selected Token:', selectedToken);
    console.log('================================');
  }, [connectionStatus, balance, selectedToken]);

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

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Get token balance
  const getTokenBalance = (tokenId) => {
    if (!balance || connectionStatus !== 'connected') {
      console.log('No balance or not connected, returning 0');
      return '0';
    }
    
    try {
      // Handle ALPH token
      if (tokenId === 'ALPH') {
        const alphBalance = balance?.balance;
        console.log('ALPH balance:', alphBalance);
        if (alphBalance) {
          const formatted = (parseFloat(alphBalance) / Math.pow(10, 18)).toFixed(4);
          console.log('Formatted ALPH balance:', formatted);
          return formatted;
        }
        return '0';
      }
      
      // Handle other tokens
      const tokenBalances = balance?.tokenBalances || [];
      console.log('Token balances:', tokenBalances);
      const tokenData = tokenBalances.find(t => t.id === tokenId);
      console.log('Token data for', tokenId, ':', tokenData);
      if (tokenData) {
        const token = tokens.find(t => t.id === tokenId);
        const decimals = token?.decimals || 18;
        const formatted = (parseFloat(tokenData.amount) / Math.pow(10, decimals)).toFixed(4);
        console.log('Formatted token balance:', formatted);
        return formatted;
      }
      return '0';
    } catch (error) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  };

  // Filter tokens to only show ones with balance
  const hasBalance = (token) => {
    if (!balance || connectionStatus !== 'connected') return true;
    const tokenBalance = getTokenBalance(token.symbol === 'ALPH' ? 'ALPH' : token.id);
    return parseFloat(tokenBalance) > 0;
  };

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

      if (!showOnlyWithBalance || !balance || connectionStatus !== 'connected') {
        return matchesSearch;
      }

      return token.symbol === 'ALPH' || (matchesSearch && hasBalance(token));
    });

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
              {connectionStatus === 'connected' && (
                <div className="token-balance">
                  {getTokenBalance(selectedToken.symbol === 'ALPH' ? 'ALPH' : selectedToken.id)}
                </div>
              )}
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
                  {connectionStatus === 'connected' && (
                    <div className="token-balance">
                      {getTokenBalance(token.symbol === 'ALPH' ? 'ALPH' : token.id)}
                    </div>
                  )}
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