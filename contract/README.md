# Prophet Token Ecosystem

This project contains smart contracts for the Prophet token ecosystem, which allows artists to create tokens with intrinsic value tied to the Prophet token. The system features both primary bonding curve markets and secondary order-book trading.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ProphetToken  │◄───┤ ArtistTokenFactory │───►│  ArtistToken    │
│   (ERC20)       │    │   (Factory)        │    │   (ERC20)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                        │                       ▲
         │                        ▼                       │
         │              ┌──────────────────┐              │
         │              │  BondingCurve    │              │
         │              │ (Primary AMM)    │──────────────┘
         │              └──────────────────┘
         │
         │              ┌──────────────────┐
         └──────────────┤ProphetMarketplace│
                        │(Secondary Market)│
                        └──────────────────┘
```

## Smart Contracts

### Core Infrastructure

1. **ProphetToken.sol**: The main ERC20 reserve token
   - Sold for ETH to bootstrap the ecosystem
   - Used as collateral in bonding curves
   - Tradeable on secondary markets

2. **ArtistToken.sol**: Per-artist ERC20 tokens
   - Minted/burned via bonding curve
   - Tradeable on secondary markets
   - Role-based permissions for curve interactions

3. **ArtistTokenFactory.sol**: Factory for creating new artist tokens
   - Deploys ArtistToken instances
   - Initializes bonding curve parameters
   - Sets up permissions automatically

### Trading Infrastructure

4. **BondingCurve.sol**: Primary AMM for artist tokens
   - Implements cost function C(s) = c·s^k
   - Deterministic pricing based on supply
   - Holds Prophet token reserves per artist

5. **ProphetMarketplace.sol**: Secondary order-book market
   - Limit orders for Prophet ↔ Artist token trading
   - Order matching and partial fills
   - Independent of bonding curve pricing

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

2. **Deploy the BondingCurve contract**:

```bash
npx thirdweb deploy
```

- Select the `BondingCurve.sol` contract
- Fill in the constructor parameter:
  - ProphetTokenAddress: [Address of the deployed Prophet token]

3. **Deploy the Prophet Marketplace contract**:

```bash
npx thirdweb deploy
```

- Select the `ProphetMarketplace.sol` contract
- Fill in the constructor parameter:
  - ProphetTokenAddress: [Address of the deployed Prophet token]

4. **Deploy the Artist Token Factory contract**:

```bash
npx thirdweb deploy
```

- Select the `ArtistTokenFactory.sol` contract
- Fill in the constructor parameters:
  - ProphetTokenAddress: [Address of the deployed Prophet token]
  - BondingCurveAddress: [Address of the deployed BondingCurve contract]

5. **Set up permissions**:

After deployment, grant the factory admin rights on the bonding curve:
- Call `grantRole(DEFAULT_ADMIN_ROLE, factoryAddress)` on the BondingCurve contract

## Using the Contracts

### Creating a New Artist Token

1. Call the `createArtistToken` function on the ArtistTokenFactory contract with:
   - name: Token name (e.g., "Artist Name Token")
   - symbol: Token symbol (e.g., "ANT")
   - primarySaleRecipient: Address to receive token sales
   - artistName: Name of the artist
   - artistInfo: Additional information about the artist
   - initialProphetValue: Initial Prophet value for this artist (for marketplace)

2. For custom bonding curve parameters, use `createArtistTokenWithCurve`:
   - coefficient: Curve coefficient c (scaled by 1e18, e.g., 1e15 = 0.001)
   - exponent: Curve exponent k (scaled by 1e18, e.g., 2e18 = quadratic)

### Trading on Bonding Curve (Primary Market)

**Buying Artist Tokens:**
```solidity
// Get quote first
uint256 artistAmount = bondingCurve.getBuyQuote(artistTokenAddress, prophetAmount);

// Buy with slippage protection
bondingCurve.buyArtist(artistTokenAddress, prophetAmount, minArtistAmount);
```

**Selling Artist Tokens:**
```solidity
// Get quote first
uint256 prophetAmount = bondingCurve.getSellQuote(artistTokenAddress, artistAmount);

// Sell with slippage protection
bondingCurve.sellArtist(artistTokenAddress, artistAmount, minProphetAmount);
```

### Trading on Order Book (Secondary Market)

**Creating Orders:**
```solidity
// Create buy or sell order
marketplace.createOrder(
    artistTokenAddress,
    isBuyOrder,        // true for buy, false for sell
    prophetAmount,     // Prophet tokens involved
    artistTokenAmount  // Artist tokens involved
);
```

**Market Information:**
```solidity
// Get best prices
uint256 bestBuy = marketplace.getBestBuyPrice(artistTokenAddress);
uint256 bestSell = marketplace.getBestSellPrice(artistTokenAddress);

// Get market depth
(uint256 buyVol, uint256 sellVol, uint256 bestBuyPrice, uint256 bestSellPrice) = 
    marketplace.getMarketDepth(artistTokenAddress);
```

## Integrating New Artist Markets Step-by-Step

### For Platform Operators

1. **Deploy Core Infrastructure** (once per network):
   - Deploy ProphetToken, BondingCurve, Factory, and Marketplace
   - Set up admin permissions between contracts

2. **Configure Default Parameters**:
   ```solidity
   factory.setDefaultCurveParameters(
       1e15,  // coefficient: 0.001 Prophet per token initially
       2e18   // exponent: quadratic curve (k=2)
   );
   ```

### For Artists

1. **Create Artist Token**:
   ```solidity
   address artistToken = factory.createArtistToken(
       "My Art Token",
       "MYART", 
       msg.sender,
       "Artist Name",
       "Artist bio and information",
       1000e18  // 1000 Prophet tokens for marketplace value
   );
   ```

2. **Initial Liquidity** (optional):
   - Artists can buy first tokens from their own curve to establish price history
   - Or wait for organic discovery and purchases

3. **Marketing Integration**:
   - Use `getCurrentPrice(artistToken)` to display current bonding curve price
   - Show both bonding curve and marketplace prices for comparison

### For Traders/Users

1. **Buy Prophet Tokens**:
   ```solidity
   prophetToken.buyTokens{value: ethAmount}(desiredTokenAmount);
   ```

2. **Choose Trading Venue**:
   - **Bonding Curve**: Guaranteed execution, price based on curve mathematics
   - **Marketplace**: Better prices possible, but requires liquidity

3. **Price Discovery**:
   ```solidity
   // Compare venues
   uint256 curvePrice = bondingCurve.getCurrentPrice(artistToken);
   uint256 marketBestBuy = marketplace.getBestBuyPrice(artistToken);
   uint256 marketBestSell = marketplace.getBestSellPrice(artistToken);
   ```

## Economic Model

### Bonding Curve Mechanics
- **Formula**: Cost = ∫[0 to supply] c·s^k ds = c·s^(k+1)/(k+1)
- **Default**: c = 0.001, k = 2 (quadratic growth)
- **Price Discovery**: P(s) = c·k·s^(k-1)

### Dual Market Structure
- **Primary (Curve)**: Always available, predictable pricing
- **Secondary (Orders)**: Better pricing through trader competition
- **Arbitrage**: Keeps markets in sync through profit opportunities

## Gas Optimization Notes

- Binary search in curve calculations: ~200k gas for complex curves
- Order matching: ~150k gas per matched order
- Token creation: ~3M gas (includes curve setup)
- Simple buy/sell: ~100-150k gas

## Security Considerations

- See [SECURITY.md](./SECURITY.md) for detailed security analysis
- Slippage protection recommended for all trades
- Monitor for MEV attacks on large bonding curve trades
- Admin keys should use multi-sig for production deployments

## Troubleshooting

### Compilation Errors

**"Identifier already declared" Error:**
If you encounter compilation errors related to `IERC20` interface conflicts, this is due to conflicts between OpenZeppelin and Thirdweb contract imports. The contracts have been updated to use interface definitions instead of direct imports to resolve this.

**Fixed in Latest Version:**
- BondingCurve.sol uses `IProphetToken` interface instead of importing ProphetToken.sol
- ArtistTokenFactory.sol uses interfaces for both ProphetToken and BondingCurve
- This eliminates IERC20 naming conflicts between dependencies

**If Still Encountering Issues:**
1. Clear Hardhat cache: `npx hardhat clean`
2. Reinstall dependencies: `npm install`
3. Ensure you're using the latest contract versions

**Windows PowerShell Issues:**
If using Windows PowerShell, use individual commands instead of chained commands:
```powershell
cd Prophetv2/contract
npx hardhat compile
```

### Deployment Issues

**Permission Setup:**
After deploying all contracts, ensure proper permissions are set:
1. Factory needs admin rights on BondingCurve
2. BondingCurve needs BONDING_CURVE_ROLE on created ArtistTokens
3. These are set automatically if factory has proper permissions

**Gas Estimation Failures:**
- Ensure ProphetToken has sufficient supply before testing trades
- Check that curve parameters are reasonable (not too high exponents)
- Verify all contracts are deployed on the same network

## Integration with thirdweb Dashboard

After deployment, you can manage your contracts through the thirdweb dashboard:
- Monitor token metrics and trading activity
- Configure admin permissions and roles
- View transaction history and events
- Manage emergency functions if needed 