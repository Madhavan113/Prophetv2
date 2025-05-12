# Prophet Token Ecosystem

This project contains smart contracts for the Prophet token ecosystem, which allows artists to create tokens with intrinsic value tied to the Prophet token.

## Contracts Overview

1. **ProphetToken.sol**: The main ERC20 token that connects the ecosystem. Each Prophet token can be used to buy artist tokens.

2. **ProphetMarketplace.sol**: Handles the exchange between Prophet tokens and artist tokens according to set exchange rates.

3. **ArtistToken.sol**: An ERC20 token template used to create new artist tokens whose value is tied to Prophet tokens.

4. **ArtistTokenFactory.sol**: A factory contract that simplifies the creation of new artist tokens.

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
  - Symbol: "PRPHT"
  - Primary sale recipient: [Your wallet address]

2. **Deploy the Prophet Marketplace contract**:

```bash
npx thirdweb deploy
```

- Select the `ProphetMarketplace.sol` contract
- Fill in the constructor parameter:
  - ProphetTokenAddress: [Address of the deployed Prophet token]

3. **Deploy the Artist Token Factory contract**:

```bash
npx thirdweb deploy
```

- Select the `ArtistTokenFactory.sol` contract
- Fill in the constructor parameter:
  - ProphetTokenAddress: [Address of the deployed Prophet token]

## Using the Contracts

### Creating a New Artist Token

1. Call the `createArtistToken` function on the ArtistTokenFactory contract with:
   - name: Token name (e.g., "Artist Name Token")
   - symbol: Token symbol (e.g., "ANT")
   - primarySaleRecipient: Address to receive token sales
   - artistName: Name of the artist
   - artistInfo: Additional information about the artist
   - initialProphetValue: Initial Prophet value for this artist

### Setting Exchange Rates

As a Prophet admin, call the `setExchangeRate` function on the ProphetMarketplace contract with:
- artistTokenAddress: Address of the artist token
- prophetAmount: Amount of Prophet tokens (e.g., 1000000000000000000 for 1 token with 18 decimals)
- artistTokenAmount: Amount of artist tokens to exchange (e.g., 5000000000000000000 for 5 tokens)

### Trading Tokens

1. Users can buy artist tokens by calling `buyArtistTokens` on the ProphetMarketplace contract
2. Users can sell artist tokens by calling `sellArtistTokens` on the ProphetMarketplace contract

## Important Notes

- Admin rights are required to manage the Prophet ecosystem (register artist tokens, set exchange rates)
- The marketplace needs liquidity (both Prophet and artist tokens) to enable trading
- You can add liquidity using the `addProphetLiquidity` and `addArtistTokenLiquidity` functions

## Integration with thirdweb Dashboard

After deployment, you can manage your contracts through the thirdweb dashboard:
- Mint tokens
- Configure permissions
- View statistics
- Set up NFT drops for artist tokens 