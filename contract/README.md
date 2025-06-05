# Prophet Token Ecosystem

This project contains smart contracts for the Prophet token ecosystem, which allows artists to create tokens with intrinsic value tied to the Prophet token. The system features Dutch auctions for initial price discovery and an orderbook-based marketplace for trading.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ProphetToken  │◄───┤ ArtistTokenFactory │───►│  ShareToken     │
│   (ERC20)       │    │   (Factory)        │    │   (ERC20)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                        │                       ▲
         │                        ▼                       │
         │              ┌──────────────────┐              │
         │              │  DutchAuction    │              │
         │              │ (Price Discovery)│──────────────┘
         │              └──────────────────┘
         │
         │              ┌──────────────────┐
         └──────────────┤ProphetMarketplace│
                        │(Orderbook Market)│
                        └──────────────────┘
```

## Smart Contracts

### Core Infrastructure

1. **ProphetToken.sol**: The main ERC20 reserve token
   - Sold for ETH to bootstrap the ecosystem
   - Used as currency for trading artist tokens
   - Tradeable on secondary markets

2. **ShareToken.sol**: Per-artist ERC20 tokens
   - Initially distributed via Dutch auction
   - Tradeable on the marketplace
   - Fixed supply

3. **ArtistTokenFactory.sol**: Factory for creating new artist tokens
   - Deploys ShareToken instances
   - Creates Dutch auctions for initial distribution
   - Sets up permissions automatically

### Trading Infrastructure

4. **DutchAuction.sol**: Initial price discovery for artist tokens
   - Linear descending price mechanism
   - Fair distribution to early supporters
   - ETH proceeds go to the artist

5. **ProphetMarketplace.sol**: Orderbook-based market
   - Limit orders for Prophet ↔ Artist token trading
   - Order matching and partial fills
   - Market-driven pricing based on supply and demand

## Deployment Instructions (using thirdweb)

### Prerequisites

- Install thirdweb CLI: `npm install -g thirdweb`
- Create a thirdweb account and set up a wallet

### Deployment Steps

1. **Deploy the Prophet Token contract first**:

```bash
npx thirdweb deploy
```

- Select the `ProphetToken.sol` contract
- Fill in the constructor parameters:
  - Name: "Prophet Token"
  - Symbol: "PROPHET"
  - Primary sale recipient: [Your wallet address]

2. **Deploy the ProphetMarketplace contract**:

```bash
npx thirdweb deploy
```

- Select the `ProphetMarketplace.sol` contract
- Fill in the constructor parameters:
  - ProphetTokenAddress: [Address of the deployed Prophet token]
  - Admin: [Your wallet address]

3. **Deploy the Artist Token Factory contract**:

```bash
npx thirdweb deploy
```

- Select the `ArtistTokenFactory.sol` contract
- No additional parameters needed as it inherits Ownable (owner is the deployer)

## Using the Contracts

### Creating a New Artist Token with Dutch Auction

1. Call the `createShareTokenAndAuction` function on the ArtistTokenFactory contract with:
   - name: Token name (e.g., "Artist Name Token")
   - symbol: Token symbol (e.g., "ANT")
   - totalSupply: Total supply of tokens
   - startPrice: Starting price for the auction (in wei)
   - floorPrice: Floor price for the auction (in wei)
   - duration: Duration of the auction in seconds

2. The Dutch auction will start immediately after creation and run for the specified duration.

### Participating in Dutch Auctions

**Bidding in an Auction:**
```solidity
// Send ETH to participate
dutchAuction.bid{value: ethAmount}();
```

**Finalizing the Auction:**
```solidity
// Anyone can finalize after the auction ends
dutchAuction.finalize();
```

**Claiming Refunds:**
```solidity
// If you bid too high, claim your refund
dutchAuction.claimRefund();
```

### Trading on the Marketplace

**Creating Orders:**
```solidity
// Create buy or sell order
marketplace.placeOrder(
    artistTokenAddress,
    isBuyOrder,        // true for buy, false for sell
    price,             // Prophet tokens per share
    amount             // Artist tokens amount
);
```

**Filling Orders:**
```solidity
// Take an existing order
marketplace.take(artistTokenAddress, orderId, amount);
```

**Market Information:**
```solidity
// Get all orders for a token
Order[] memory orders = marketplace.getOrders(artistTokenAddress);
```

## Integrating New Artist Markets Step-by-Step

### For Platform Operators

1. **Deploy Core Infrastructure** (once per network):
   - Deploy ProphetToken, ArtistTokenFactory, and ProphetMarketplace
   - Whitelist artist tokens on the marketplace: `marketplace.listToken(artistTokenAddress)`

### For Artists

1. **Create Artist Token and Auction**:
   ```solidity
   (address shareToken, address auction) = factory.createShareTokenAndAuction(
       "My Art Token",
       "MYART", 
       1000000e18,     // 1M tokens
       0.1 ether,      // Start price
       0.01 ether,     // Floor price
       86400           // 24 hours
   );
   ```

2. **After Auction**:
   - The artist receives ETH from the auction
   - Token holders can trade on the marketplace

### For Traders/Users

1. **Buy Prophet Tokens**:
   ```solidity
   prophetToken.buyTokens{value: ethAmount}(desiredTokenAmount);
   ```

2. **Participate in Auctions**:
   - Send ETH to `auction.bid{value: amount}()`
   - Receive tokens at the clearing price when auction ends

3. **Trade on Marketplace**:
   - Place buy orders with `marketplace.placeOrder(token, true, price, amount)`
   - Place sell orders with `marketplace.placeOrder(token, false, price, amount)`
   - Fill orders with `marketplace.take(token, orderId, amount)`

## Economic Model

### Dutch Auction Mechanics
- Starts at high price, descends linearly to floor price
- Everyone pays the same final clearing price
- Pro-rata distribution if oversubscribed
- Refunds processed automatically

### Orderbook Market Structure
- Pure supply and demand pricing
- Maker/taker model with fee incentives
- 10 bps maker fee + 20 bps taker fee

## Gas Optimization Notes

- Order creation: ~120k gas
- Order filling: ~150k gas per filled order
- Token creation + auction setup: ~3M gas
- Auction bidding: ~100k gas

## Security Considerations

- Slippage protection built into orderbook design
- Non-custodial trading system (escrow only during active orders)
- Admin keys should use multi-sig for production deployments
- All contracts use OpenZeppelin libraries for standard functionality

## Troubleshooting

### Compilation Errors

**"Identifier already declared" Error:**
If you encounter compilation errors related to `IERC20` interface conflicts, this is due to conflicts between OpenZeppelin and Thirdweb contract imports.

**If Encountering Issues:**
1. Clear Hardhat cache: `npx hardhat clean`
2. Reinstall dependencies: `npm install`
3. Ensure you're using the latest contract versions

**Windows PowerShell Issues:**
If using Windows PowerShell, use individual commands instead of chained commands:
```powershell
cd Prophetv2/contract
npx hardhat compile
``` 