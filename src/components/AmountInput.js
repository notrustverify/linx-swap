import React from 'react';
import './AmountInput.css';

const AmountInput = ({ value, onChange, disabled, maxAmount }) => {
  const handleChange = (e) => {
    const newValue = e.target.value;
    if (newValue === '' || isNaN(newValue)) {
      onChange('');
      return;
    }
    
    const numValue = parseFloat(newValue);
    if (maxAmount && numValue > maxAmount) {
      onChange(maxAmount.toString());
    } else {
      onChange(newValue);
    }
  };

  return (
    <div className="amount-input">
      <input
        type="number"
        value={value}
        onChange={handleChange}
        placeholder="0.0"
        disabled={disabled}
        min="0"
        max={maxAmount || undefined}
        step="any"
      />
    </div>
  );
};

export default AmountInput; 