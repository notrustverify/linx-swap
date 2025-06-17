# Linx Swap

Frontend implementation of a decentralized exchange (DEX) aggregator for the Alephium blockchain. This interface connects to the Linx Labs API to provide optimal token swaps across multiple DEXs.

## Overview

This repository contains the frontend code for Linx Swap. The backend API and routing engine are provided by [Linx Labs](https://linxlabs.org), which:
- Aggregates liquidity across multiple DEXs
- Calculates optimal swap routes
- Splits orders for best execution
- Provides real-time price quotes

## Features

- 🔄 Swap tokens on Alephium with the best rates
- 📊 Automatic route splitting across multiple DEXs
- 💰 Real-time price quotes and balance updates
- 🔒 Direct wallet integration with Alephium
- ⚡ Fast and efficient transactions
- 🌐 Infrastructure provided by [No Trust Verify](https://notrustverify.ch)

## Supported DEXs

- Ayin
- Elexium

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Yarn package manager
- An Alephium wallet

### Installation

1. Clone the repository:
```bash
git clone https://github.com/notrustverify/linx-swap.git
cd linx-swap
```

2. Install dependencies:
```bash
yarn install
```

3. Start the development server:
```bash
yarn start
```

The app will be available at `http://localhost:3000`.

### Building for Production

To create a production build:
```bash
yarn build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Swap API and routing engine provided by [Linx Labs](https://linxlabs.org)
- Infrastructure by [No Trust Verify](https://notrustverify.ch)
- Built for the Alephium blockchain community
