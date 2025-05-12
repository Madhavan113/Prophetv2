// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@thirdweb-dev/contracts/extension/Permissions.sol";
import "@thirdweb-dev/contracts/extension/ContractMetadata.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for ProphetToken to avoid import conflicts
interface ProphetTokenInterface {
    function isArtistToken(address artistTokenAddress) external view returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title ProphetMarketplace
 * @dev A marketplace for exchanging Prophet tokens for artist tokens with orderbook functionality
 */
contract ProphetMarketplace is Permissions, ContractMetadata, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event ArtistTokenPurchased(address indexed buyer, address indexed artistToken, uint256 prophetAmount, uint256 artistTokenAmount);
    event ArtistTokenSold(address indexed seller, address indexed artistToken, uint256 artistTokenAmount, uint256 prophetAmount);
    event ExchangeRateSet(address indexed artistToken, uint256 prophetAmount, uint256 artistTokenAmount);
    event OrderCreated(uint256 indexed orderId, address indexed creator, address indexed artistToken, bool isBuyOrder, uint256 prophetAmount, uint256 artistTokenAmount);
    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(uint256 indexed orderId, address indexed filler, uint256 filledAmount);

    // State variables
    ProphetTokenInterface public prophetToken;
    
    // Exchange rate mapping for artist tokens (Prophet amount to Artist token amount)
    struct ExchangeRate {
        uint256 prophetAmount;    // How many Prophet tokens
        uint256 artistTokenAmount; // How many artist tokens you get
        bool exists;
    }
    
    mapping(address => ExchangeRate) public exchangeRates;
    
    // Order struct for orderbook
    struct Order {
        uint256 id;
        address creator;
        address artistToken;
        bool isBuyOrder;         // true = buy artist tokens with Prophet, false = sell artist tokens for Prophet
        uint256 prophetAmount;   // Total Prophet tokens in the order
        uint256 artistTokenAmount; // Total artist tokens in the order
        uint256 filled;          // Amount already filled
        bool active;             // Whether the order is still active
    }
    
    // Orderbook storage
    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;
    mapping(address => mapping(bool => uint256[])) public artistTokenOrders; // artistToken => isBuyOrder => orderIds
    
    /**
     * @dev Constructor for the marketplace
     * @param _prophetTokenAddress Address of the Prophet token contract
     */
    constructor(address _prophetTokenAddress) {
        prophetToken = ProphetTokenInterface(_prophetTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Set the exchange rate for an artist token
     * @param artistTokenAddress The address of the artist token
     * @param prophetAmount Amount of Prophet tokens
     * @param artistTokenAmount Amount of artist tokens
     */
    function setExchangeRate(
        address artistTokenAddress,
        uint256 prophetAmount,
        uint256 artistTokenAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(prophetToken.isArtistToken(artistTokenAddress), "Not a registered artist token");
        require(prophetAmount > 0, "Prophet amount must be greater than 0");
        require(artistTokenAmount > 0, "Artist token amount must be greater than 0");
        
        exchangeRates[artistTokenAddress] = ExchangeRate({
            prophetAmount: prophetAmount,
            artistTokenAmount: artistTokenAmount,
            exists: true
        });
        
        emit ExchangeRateSet(artistTokenAddress, prophetAmount, artistTokenAmount);
    }
    
    /**
     * @dev Buy artist tokens using Prophet tokens
     * @param artistTokenAddress The address of the artist token to buy
     * @param prophetAmount The amount of Prophet tokens to spend
     */
    function buyArtistTokens(
        address artistTokenAddress,
        uint256 prophetAmount
    ) external nonReentrant {
        require(prophetToken.isArtistToken(artistTokenAddress), "Not a registered artist token");
        require(exchangeRates[artistTokenAddress].exists, "Exchange rate not set");
        
        ExchangeRate memory rate = exchangeRates[artistTokenAddress];
        
        // Calculate how many artist tokens the user will receive
        uint256 artistTokenAmount = (prophetAmount * rate.artistTokenAmount) / rate.prophetAmount;
        require(artistTokenAmount > 0, "Artist token amount too small");
        
        // Check if the marketplace has enough artist tokens
        IERC20 artistToken = IERC20(artistTokenAddress);
        require(artistToken.balanceOf(address(this)) >= artistTokenAmount, "Insufficient artist token liquidity");
        
        // Transfer Prophet tokens from user to this contract
        prophetToken.transferFrom(msg.sender, address(this), prophetAmount);
        
        // Transfer artist tokens to the user
        artistToken.safeTransfer(msg.sender, artistTokenAmount);
        
        emit ArtistTokenPurchased(msg.sender, artistTokenAddress, prophetAmount, artistTokenAmount);
    }
    
    /**
     * @dev Sell artist tokens to get Prophet tokens
     * @param artistTokenAddress The address of the artist token to sell
     * @param artistTokenAmount The amount of artist tokens to sell
     */
    function sellArtistTokens(
        address artistTokenAddress,
        uint256 artistTokenAmount
    ) external nonReentrant {
        require(prophetToken.isArtistToken(artistTokenAddress), "Not a registered artist token");
        require(exchangeRates[artistTokenAddress].exists, "Exchange rate not set");
        
        ExchangeRate memory rate = exchangeRates[artistTokenAddress];
        
        // Calculate how many Prophet tokens the user will receive
        uint256 prophetAmount = (artistTokenAmount * rate.prophetAmount) / rate.artistTokenAmount;
        require(prophetAmount > 0, "Prophet amount too small");
        
        // Check if the marketplace has enough Prophet tokens
        require(prophetToken.balanceOf(address(this)) >= prophetAmount, "Insufficient Prophet token liquidity");
        
        // Transfer artist tokens from user to this contract
        IERC20 artistToken = IERC20(artistTokenAddress);
        artistToken.safeTransferFrom(msg.sender, address(this), artistTokenAmount);
        
        // Transfer Prophet tokens to the user
        prophetToken.transfer(msg.sender, prophetAmount);
        
        emit ArtistTokenSold(msg.sender, artistTokenAddress, artistTokenAmount, prophetAmount);
    }
    
    /**
     * @dev Create a new buy or sell order
     * @param artistTokenAddress The artist token address to trade
     * @param isBuyOrder Whether this is a buy order (true) or sell order (false)
     * @param prophetAmount Amount of Prophet tokens
     * @param artistTokenAmount Amount of artist tokens
     */
    function createOrder(
        address artistTokenAddress,
        bool isBuyOrder,
        uint256 prophetAmount,
        uint256 artistTokenAmount
    ) external nonReentrant {
        require(prophetToken.isArtistToken(artistTokenAddress), "Not a registered artist token");
        require(prophetAmount > 0, "Prophet amount must be greater than 0");
        require(artistTokenAmount > 0, "Artist token amount must be greater than 0");
        
        // Create the order
        uint256 orderId = nextOrderId++;
        
        orders[orderId] = Order({
            id: orderId,
            creator: msg.sender,
            artistToken: artistTokenAddress,
            isBuyOrder: isBuyOrder,
            prophetAmount: prophetAmount,
            artistTokenAmount: artistTokenAmount,
            filled: 0,
            active: true
        });
        
        // Add order to the artist token's order list
        artistTokenOrders[artistTokenAddress][isBuyOrder].push(orderId);
        
        // Handle token transfers based on order type
        if (isBuyOrder) {
            // If buying artist tokens with Prophet, lock the Prophet tokens
            prophetToken.transferFrom(msg.sender, address(this), prophetAmount);
        } else {
            // If selling artist tokens for Prophet, lock the artist tokens
            IERC20(artistTokenAddress).safeTransferFrom(msg.sender, address(this), artistTokenAmount);
        }
        
        emit OrderCreated(orderId, msg.sender, artistTokenAddress, isBuyOrder, prophetAmount, artistTokenAmount);
    }
    
    /**
     * @dev Fill an existing order (partial fills allowed)
     * @param orderId The ID of the order to fill
     * @param fillAmount The amount to fill (in artist tokens for buy orders, in Prophet tokens for sell orders)
     */
    function fillOrder(
        uint256 orderId,
        uint256 fillAmount
    ) external nonReentrant {
        require(orderId < nextOrderId, "Order does not exist");
        
        Order storage order = orders[orderId];
        require(order.active, "Order is not active");
        
        if (order.isBuyOrder) {
            // This is a buy order, so the filler is selling artist tokens
            uint256 artistTokensToTransfer = fillAmount;
            require(artistTokensToTransfer > 0, "Fill amount too small");
            
            // Calculate the corresponding Prophet tokens
            uint256 prophetTokensToReceive = (artistTokensToTransfer * order.prophetAmount) / order.artistTokenAmount;
            
            // Check if we have enough unfilled amount
            uint256 remainingArtistTokens = order.artistTokenAmount - order.filled;
            require(artistTokensToTransfer <= remainingArtistTokens, "Fill amount exceeds remaining order");
            
            // Update filled amount
            order.filled += artistTokensToTransfer;
            
            // Transfer tokens
            IERC20(order.artistToken).safeTransferFrom(msg.sender, order.creator, artistTokensToTransfer);
            prophetToken.transfer(msg.sender, prophetTokensToReceive);
            
            // Check if order is completely filled
            if (order.filled == order.artistTokenAmount) {
                order.active = false;
            }
        } else {
            // This is a sell order, so the filler is buying artist tokens with Prophet
            uint256 prophetTokensToTransfer = fillAmount;
            require(prophetTokensToTransfer > 0, "Fill amount too small");
            
            // Calculate the corresponding artist tokens
            uint256 artistTokensToReceive = (prophetTokensToTransfer * order.artistTokenAmount) / order.prophetAmount;
            
            // Check if we have enough unfilled amount
            uint256 remainingProphetTokens = order.prophetAmount - order.filled;
            require(prophetTokensToTransfer <= remainingProphetTokens, "Fill amount exceeds remaining order");
            
            // Update filled amount
            order.filled += prophetTokensToTransfer;
            
            // Transfer tokens
            prophetToken.transferFrom(msg.sender, order.creator, prophetTokensToTransfer);
            IERC20(order.artistToken).safeTransfer(msg.sender, artistTokensToReceive);
            
            // Check if order is completely filled
            if (order.filled == order.prophetAmount) {
                order.active = false;
            }
        }
        
        emit OrderFilled(orderId, msg.sender, fillAmount);
    }
    
    /**
     * @dev Cancel an existing order
     * @param orderId The ID of the order to cancel
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        require(orderId < nextOrderId, "Order does not exist");
        
        Order storage order = orders[orderId];
        require(order.active, "Order is not active");
        require(order.creator == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        
        order.active = false;
        
        // Return the remaining tokens to the creator
        if (order.isBuyOrder) {
            // Return remaining Prophet tokens
            uint256 remainingProphetTokens = order.prophetAmount * (order.artistTokenAmount - order.filled) / order.artistTokenAmount;
            if (remainingProphetTokens > 0) {
                prophetToken.transfer(order.creator, remainingProphetTokens);
            }
        } else {
            // Return remaining artist tokens
            uint256 remainingArtistTokens = order.artistTokenAmount * (order.prophetAmount - order.filled) / order.prophetAmount;
            if (remainingArtistTokens > 0) {
                IERC20(order.artistToken).safeTransfer(order.creator, remainingArtistTokens);
            }
        }
        
        emit OrderCancelled(orderId);
    }
    
    /**
     * @dev Get active orders for an artist token
     * @param artistTokenAddress The artist token to get orders for
     * @param isBuyOrder Whether to get buy orders (true) or sell orders (false)
     * @return Array of active order IDs
     */
    function getActiveOrders(address artistTokenAddress, bool isBuyOrder) external view returns (uint256[] memory) {
        uint256[] memory allOrders = artistTokenOrders[artistTokenAddress][isBuyOrder];
        uint256 activeCount = 0;
        
        // First, count active orders
        for (uint256 i = 0; i < allOrders.length; i++) {
            if (orders[allOrders[i]].active) {
                activeCount++;
            }
        }
        
        // Create result array with active orders
        uint256[] memory result = new uint256[](activeCount);
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < allOrders.length; i++) {
            if (orders[allOrders[i]].active) {
                result[resultIndex] = allOrders[i];
                resultIndex++;
            }
        }
        
        return result;
    }
    
    /**
     * @dev Get order details
     * @param orderId The order ID to get details for
     * @return creator The address of the order creator
     * @return artistToken The address of the artist token
     * @return isBuyOrder Whether it's a buy order
     * @return prophetAmount Total Prophet tokens in the order
     * @return artistTokenAmount Total artist tokens in the order
     * @return filled Amount already filled
     * @return active Whether the order is still active
     */
    function getOrderDetails(uint256 orderId) external view returns (
        address creator,
        address artistToken,
        bool isBuyOrder,
        uint256 prophetAmount,
        uint256 artistTokenAmount,
        uint256 filled,
        bool active
    ) {
        require(orderId < nextOrderId, "Order does not exist");
        Order storage order = orders[orderId];
        
        return (
            order.creator,
            order.artistToken,
            order.isBuyOrder,
            order.prophetAmount,
            order.artistTokenAmount,
            order.filled,
            order.active
        );
    }
    
    /**
     * @dev Add liquidity to the marketplace
     * @param artistTokenAddress The address of the artist token
     * @param artistTokenAmount The amount of artist tokens to add
     */
    function addArtistTokenLiquidity(
        address artistTokenAddress,
        uint256 artistTokenAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(prophetToken.isArtistToken(artistTokenAddress), "Not a registered artist token");
        
        // Transfer artist tokens from admin to this contract
        IERC20 artistToken = IERC20(artistTokenAddress);
        artistToken.safeTransferFrom(msg.sender, address(this), artistTokenAmount);
    }
    
    /**
     * @dev Add Prophet token liquidity to the marketplace
     * @param prophetAmount The amount of Prophet tokens to add
     */
    function addProphetLiquidity(uint256 prophetAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        prophetToken.transferFrom(msg.sender, address(this), prophetAmount);
    }
    
    /**
     * @dev Remove liquidity from the marketplace (admin only)
     * @param token The token address to withdraw
     * @param amount The amount to withdraw
     */
    function removeLiquidity(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
    
    /**
     * @dev Implementation of the ContractMetadata interface
     */
    function _canSetContractURI() internal view virtual override returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
} 