// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@thirdweb-dev/contracts/extension/Permissions.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for ProphetToken functions we need
interface IProphetToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function isArtistToken(address artistTokenAddress) external view returns (bool);
}

// Interface for ArtistToken with mint/burn capabilities
interface IArtistTokenBondable {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title BondingCurve
 * @dev Implements a deterministic bonding curve for minting/burning ArtistTokens against ProphetToken reserves
 * @notice Uses cost function C(s) = c * s^k where s is supply, c is coefficient, k is exponent
 */
contract BondingCurve is Permissions, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event ArtistTokenBought(address indexed buyer, address indexed artistToken, uint256 prophetAmount, uint256 artistAmount, uint256 newSupply);
    event ArtistTokenSold(address indexed seller, address indexed artistToken, uint256 artistAmount, uint256 prophetAmount, uint256 newSupply);
    event CurveParametersSet(address indexed artistToken, uint256 coefficient, uint256 exponent);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    // Constants
    uint256 public constant SCALE = 1e18;
    uint256 public constant MAX_EXPONENT = 10; // Prevent overflow
    uint256 public constant MIN_COEFFICIENT = 1e12; // Prevent zero-cost tokens

    // State variables
    IProphetToken public immutable prophetToken;
    
    // Per-artist curve parameters: artistToken => CurveParams
    struct CurveParams {
        uint256 coefficient; // c parameter (scaled by 1e18)
        uint256 exponent;    // k parameter (scaled by 1e18, so k=2 means 2e18)
        bool initialized;
    }
    
    mapping(address => CurveParams) public curveParams;
    mapping(address => uint256) public prophetReserves; // ProphetToken reserves per artist

    /**
     * @dev Constructor
     * @param _prophetTokenAddress Address of the ProphetToken contract
     */
    constructor(address _prophetTokenAddress) {
        prophetToken = IProphetToken(_prophetTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Initialize curve parameters for an artist token (only admin)
     * @param artistToken Address of the artist token
     * @param coefficient The c parameter (scaled by 1e18)
     * @param exponent The k parameter (scaled by 1e18)
     */
    function initializeCurve(
        address artistToken,
        uint256 coefficient,
        uint256 exponent
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!curveParams[artistToken].initialized, "Curve already initialized");
        require(coefficient >= MIN_COEFFICIENT, "Coefficient too small");
        require(exponent > 0 && exponent <= MAX_EXPONENT * SCALE, "Invalid exponent");
        require(prophetToken.isArtistToken(artistToken), "Not a registered artist token");

        curveParams[artistToken] = CurveParams({
            coefficient: coefficient,
            exponent: exponent,
            initialized: true
        });

        emit CurveParametersSet(artistToken, coefficient, exponent);
    }

    /**
     * @dev Buy artist tokens with Prophet tokens
     * @param artistToken Address of the artist token to buy
     * @param prophetAmount Amount of Prophet tokens to spend
     * @param minArtistAmount Minimum artist tokens expected (slippage protection)
     * @return artistAmount Amount of artist tokens minted
     */
    function buyArtist(
        address artistToken,
        uint256 prophetAmount,
        uint256 minArtistAmount
    ) external nonReentrant returns (uint256 artistAmount) {
        require(curveParams[artistToken].initialized, "Curve not initialized");
        require(prophetAmount > 0, "Amount must be greater than 0");

        uint256 currentSupply = IArtistTokenBondable(artistToken).totalSupply();
        artistAmount = _calculateBuyAmount(artistToken, currentSupply, prophetAmount);
        
        require(artistAmount >= minArtistAmount, "Slippage exceeded");
        require(artistAmount > 0, "No tokens to mint");

        // Transfer Prophet tokens from buyer to this contract
        prophetToken.transferFrom(msg.sender, address(this), prophetAmount);
        
        // Update reserves
        prophetReserves[artistToken] += prophetAmount;
        
        // Mint artist tokens to buyer
        IArtistTokenBondable(artistToken).mint(msg.sender, artistAmount);

        emit ArtistTokenBought(msg.sender, artistToken, prophetAmount, artistAmount, currentSupply + artistAmount);
    }

    /**
     * @dev Sell artist tokens for Prophet tokens
     * @param artistToken Address of the artist token to sell
     * @param artistAmount Amount of artist tokens to sell
     * @param minProphetAmount Minimum Prophet tokens expected (slippage protection)
     * @return prophetAmount Amount of Prophet tokens received
     */
    function sellArtist(
        address artistToken,
        uint256 artistAmount,
        uint256 minProphetAmount
    ) external nonReentrant returns (uint256 prophetAmount) {
        require(curveParams[artistToken].initialized, "Curve not initialized");
        require(artistAmount > 0, "Amount must be greater than 0");

        uint256 currentSupply = IArtistTokenBondable(artistToken).totalSupply();
        require(currentSupply >= artistAmount, "Insufficient supply");

        prophetAmount = _calculateSellAmount(artistToken, currentSupply, artistAmount);
        
        require(prophetAmount >= minProphetAmount, "Slippage exceeded");
        require(prophetAmount > 0, "No Prophet tokens to receive");
        require(prophetReserves[artistToken] >= prophetAmount, "Insufficient reserves");

        // Burn artist tokens from seller
        IArtistTokenBondable(artistToken).burnFrom(msg.sender, artistAmount);
        
        // Update reserves
        unchecked {
            prophetReserves[artistToken] -= prophetAmount;
        }
        
        // Transfer Prophet tokens to seller
        prophetToken.transfer(msg.sender, prophetAmount);

        emit ArtistTokenSold(msg.sender, artistToken, artistAmount, prophetAmount, currentSupply - artistAmount);
    }

    /**
     * @dev Calculate how many artist tokens can be bought with given Prophet amount
     * @param artistToken The artist token address
     * @param currentSupply Current supply of artist tokens
     * @param prophetAmount Amount of Prophet tokens to spend
     * @return artistAmount Amount of artist tokens that can be bought
     */
    function _calculateBuyAmount(
        address artistToken,
        uint256 currentSupply,
        uint256 prophetAmount
    ) internal view returns (uint256 artistAmount) {
        CurveParams memory params = curveParams[artistToken];
        
        // For C(s) = c * s^k, integral is c * s^(k+1) / (k+1)
        // We need to solve: integral(currentSupply, currentSupply + artistAmount) = prophetAmount
        
        uint256 kPlusOne = params.exponent + SCALE;
        uint256 currentIntegral = _calculateIntegral(params.coefficient, currentSupply, kPlusOne);
        uint256 targetIntegral = currentIntegral + (prophetAmount * SCALE) / params.coefficient;
        
        // Binary search to find the supply that gives us the target integral
        uint256 low = currentSupply;
        uint256 high = currentSupply + (prophetAmount * SCALE) / params.coefficient; // Upper bound estimate
        
        // Ensure high is reasonable to prevent overflow
        if (high > currentSupply + 1e12 * SCALE) {
            high = currentSupply + 1e12 * SCALE;
        }
        
        while (high > low + 1) {
            uint256 mid = (low + high) / 2;
            uint256 midIntegral = _calculateIntegral(params.coefficient, mid, kPlusOne);
            
            if (midIntegral <= targetIntegral) {
                low = mid;
            } else {
                high = mid;
            }
        }
        
        artistAmount = low > currentSupply ? low - currentSupply : 0;
    }

    /**
     * @dev Calculate how many Prophet tokens will be received for selling artist tokens
     * @param artistToken The artist token address
     * @param currentSupply Current supply of artist tokens
     * @param artistAmount Amount of artist tokens to sell
     * @return prophetAmount Amount of Prophet tokens that will be received
     */
    function _calculateSellAmount(
        address artistToken,
        uint256 currentSupply,
        uint256 artistAmount
    ) internal view returns (uint256 prophetAmount) {
        CurveParams memory params = curveParams[artistToken];
        
        uint256 kPlusOne = params.exponent + SCALE;
        uint256 newSupply = currentSupply - artistAmount;
        
        uint256 currentIntegral = _calculateIntegral(params.coefficient, currentSupply, kPlusOne);
        uint256 newIntegral = _calculateIntegral(params.coefficient, newSupply, kPlusOne);
        
        prophetAmount = ((currentIntegral - newIntegral) * params.coefficient) / SCALE;
    }

    /**
     * @dev Calculate integral of cost function from 0 to supply
     * @param coefficient The c parameter
     * @param supply The supply value
     * @param kPlusOne The (k+1) parameter
     * @return result The integral value
     */
    function _calculateIntegral(
        uint256 coefficient,
        uint256 supply,
        uint256 kPlusOne
    ) internal pure returns (uint256 result) {
        if (supply == 0) return 0;
        
        // Calculate supply^(k+1) / (k+1)
        uint256 supplyPower = _pow(supply, kPlusOne);
        result = (supplyPower * coefficient) / (kPlusOne * SCALE);
    }

    /**
     * @dev Calculate x^y with fixed point arithmetic (both scaled by 1e18)
     * @param x Base (scaled by 1e18)
     * @param y Exponent (scaled by 1e18)
     * @return result x^y (scaled by 1e18)
     */
    function _pow(uint256 x, uint256 y) internal pure returns (uint256 result) {
        if (y == 0) return SCALE;
        if (x == 0) return 0;
        if (y == SCALE) return x;
        
        // For y = 2e18 (k=2), this is just x^2
        if (y == 2 * SCALE) {
            return (x * x) / SCALE;
        }
        
        // For integer exponents, use repeated multiplication
        uint256 integerPart = y / SCALE;
        
        result = SCALE;
        uint256 base = x;
        
        while (integerPart > 0) {
            if (integerPart & 1 == 1) {
                result = (result * base) / SCALE;
            }
            base = (base * base) / SCALE;
            integerPart >>= 1;
        }
        
        // Note: This implementation handles only integer exponents
        // For fractional exponents, a more sophisticated approach would be needed
    }

    /**
     * @dev Get quote for buying artist tokens
     * @param artistToken Address of the artist token
     * @param prophetAmount Amount of Prophet tokens to spend
     * @return artistAmount Amount of artist tokens that would be received
     */
    function getBuyQuote(
        address artistToken,
        uint256 prophetAmount
    ) external view returns (uint256 artistAmount) {
        require(curveParams[artistToken].initialized, "Curve not initialized");
        uint256 currentSupply = IArtistTokenBondable(artistToken).totalSupply();
        return _calculateBuyAmount(artistToken, currentSupply, prophetAmount);
    }

    /**
     * @dev Get quote for selling artist tokens
     * @param artistToken Address of the artist token
     * @param artistAmount Amount of artist tokens to sell
     * @return prophetAmount Amount of Prophet tokens that would be received
     */
    function getSellQuote(
        address artistToken,
        uint256 artistAmount
    ) external view returns (uint256 prophetAmount) {
        require(curveParams[artistToken].initialized, "Curve not initialized");
        uint256 currentSupply = IArtistTokenBondable(artistToken).totalSupply();
        require(currentSupply >= artistAmount, "Insufficient supply");
        return _calculateSellAmount(artistToken, currentSupply, artistAmount);
    }

    /**
     * @dev Get current price for an artist token (marginal cost)
     * @param artistToken Address of the artist token
     * @return price Current price in Prophet tokens per artist token
     */
    function getCurrentPrice(address artistToken) external view returns (uint256 price) {
        require(curveParams[artistToken].initialized, "Curve not initialized");
        
        CurveParams memory params = curveParams[artistToken];
        uint256 currentSupply = IArtistTokenBondable(artistToken).totalSupply();
        
        // Price = C'(s) = c * k * s^(k-1)
        if (currentSupply == 0) {
            price = params.coefficient;
        } else {
            uint256 kMinusOne = params.exponent > SCALE ? params.exponent - SCALE : 0;
            uint256 supplyPower = kMinusOne > 0 ? _pow(currentSupply, kMinusOne) : SCALE;
            price = (params.coefficient * params.exponent * supplyPower) / (SCALE * SCALE);
        }
    }

    /**
     * @dev Emergency withdraw function (admin only)
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(token, amount);
    }

    /**
     * @dev Check if curve is initialized for an artist token
     * @param artistToken Address of the artist token
     * @return initialized Whether the curve is initialized
     */
    function isCurveInitialized(address artistToken) external view returns (bool initialized) {
        return curveParams[artistToken].initialized;
    }
} 