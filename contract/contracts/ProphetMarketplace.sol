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
 * @dev A decentralized marketplace for exchanging Prophet tokens for artist tokens using orderbook
 */
contract ProphetMarketplace is Permissions, ContractMetadata, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event OrderCreated(uint256 indexed orderId, address indexed creator, address indexed artistToken, bool isBuyOrder, uint256 prophetAmount, uint256 artistTokenAmount, uint256 pricePerToken);
    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(uint256 indexed orderId, address indexed filler, uint256 filledAmount, uint256 remainingAmount);
    event Trade(address indexed buyer, address indexed seller, address indexed artistToken, uint256 prophetAmount, uint256 artistTokenAmount, uint256 pricePerToken);

    // State variables
    ProphetTokenInterface public prophetToken;
    
    // Order struct for orderbook
    struct Order {
        uint256 id;
        address creator;
        address artistToken;
        bool isBuyOrder;         // true = buy artist tokens with Prophet, false = sell artist tokens for Prophet
        uint256 prophetAmount;   // Total Prophet tokens in the order
        uint256 artistTokenAmount; // Total artist tokens in the order
        uint256 filled;          // Amount already filled (in the same unit as the order type)
        uint256 pricePerToken;   // Price per artist token in Prophet tokens (scaled by 1e18)
        bool active;             // Whether the order is still active
        uint256 timestamp;       // When the order was created
    }
    
    // Orderbook storage
    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;
    mapping(address => mapping(bool => uint256[])) public artistTokenOrders; // artistToken => isBuyOrder => orderIds
    
    // Price scaling factor for precision
    uint256 public constant PRICE_SCALE = 1e18;
    
    /**
     * @dev Constructor for the marketplace
     * @param _prophetTokenAddress Address of the Prophet token contract
     */
    constructor(address _prophetTokenAddress) {
        prophetToken = ProphetTokenInterface(_prophetTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Create a new buy or sell order with automatic matching
     * @param artistTokenAddress The artist token address to trade
     * @param isBuyOrder Whether this is a buy order (true) or sell order (false)
     * @param prophetAmount Amount of Prophet tokens (for buy orders) or expected Prophet tokens (for sell orders)
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
        
        // Calculate price per token
        uint256 pricePerToken = (prophetAmount * PRICE_SCALE) / artistTokenAmount;
        
        // Try to match with existing orders first
        uint256 remainingProphetAmount = prophetAmount;
        uint256 remainingArtistAmount = artistTokenAmount;
        
        (remainingProphetAmount, remainingArtistAmount) = _matchOrder(
            artistTokenAddress,
            isBuyOrder,
            remainingProphetAmount,
            remainingArtistAmount,
            pricePerToken
        );
        
        // If there's remaining amount, create a new order
        if (remainingArtistAmount > 0 && remainingProphetAmount > 0) {
            uint256 orderId = nextOrderId++;
            
            orders[orderId] = Order({
                id: orderId,
                creator: msg.sender,
                artistToken: artistTokenAddress,
                isBuyOrder: isBuyOrder,
                prophetAmount: remainingProphetAmount,
                artistTokenAmount: remainingArtistAmount,
                filled: 0,
                pricePerToken: pricePerToken,
                active: true,
                timestamp: block.timestamp
            });
            
            // Add order to the artist token's order list
            artistTokenOrders[artistTokenAddress][isBuyOrder].push(orderId);
            
            // Handle token transfers based on order type
            if (isBuyOrder) {
                // If buying artist tokens with Prophet, lock the Prophet tokens
                prophetToken.transferFrom(msg.sender, address(this), remainingProphetAmount);
            } else {
                // If selling artist tokens for Prophet, lock the artist tokens
                IERC20(artistTokenAddress).safeTransferFrom(msg.sender, address(this), remainingArtistAmount);
            }
            
            emit OrderCreated(orderId, msg.sender, artistTokenAddress, isBuyOrder, remainingProphetAmount, remainingArtistAmount, pricePerToken);
        }
    }

    /**
     * @dev Internal function to match orders automatically
     */
    function _matchOrder(
        address artistTokenAddress,
        bool isBuyOrder,
        uint256 prophetAmount,
        uint256 artistTokenAmount,
        uint256 pricePerToken
    ) internal returns (uint256 remainingProphetAmount, uint256 remainingArtistAmount) {
        remainingProphetAmount = prophetAmount;
        remainingArtistAmount = artistTokenAmount;
        
        // Get opposite orders (if creating buy order, look for sell orders and vice versa)
        uint256[] memory oppositeOrders = artistTokenOrders[artistTokenAddress][!isBuyOrder];
        
        for (uint256 i = 0; i < oppositeOrders.length && remainingArtistAmount > 0; i++) {
            uint256 orderId = oppositeOrders[i];
            Order storage order = orders[orderId];
            
            if (!order.active) continue;
            
            // Check if prices match (buy order price >= sell order price)
            bool priceMatch = isBuyOrder ? 
                pricePerToken >= order.pricePerToken : 
                pricePerToken <= order.pricePerToken;
                
            if (!priceMatch) continue;
            
            // Calculate how much can be filled
            uint256 orderRemainingArtist = order.artistTokenAmount - order.filled;
            
            uint256 fillArtistAmount = remainingArtistAmount < orderRemainingArtist ? 
                remainingArtistAmount : orderRemainingArtist;
            uint256 fillProphetAmount = (fillArtistAmount * order.pricePerToken) / PRICE_SCALE;
            
            if (fillProphetAmount > remainingProphetAmount) {
                fillProphetAmount = remainingProphetAmount;
                fillArtistAmount = (fillProphetAmount * PRICE_SCALE) / order.pricePerToken;
            }
            
            // Execute the trade
            _executeTrade(order, fillArtistAmount, fillProphetAmount, isBuyOrder);
            
            // Update remaining amounts
            remainingArtistAmount -= fillArtistAmount;
            remainingProphetAmount -= fillProphetAmount;
        }
    }

    /**
     * @dev Execute a trade between two parties
     */
    function _executeTrade(
        Order storage order,
        uint256 fillArtistAmount,
        uint256 fillProphetAmount,
        bool takerIsBuyer
    ) internal {
        // Update order filled amount
        if (order.isBuyOrder) {
            order.filled += fillArtistAmount;
        } else {
            order.filled += fillProphetAmount;
        }
        
        // Transfer tokens based on who is buying/selling
        if (takerIsBuyer) {
            // Taker is buying, order creator is selling
            prophetToken.transferFrom(msg.sender, order.creator, fillProphetAmount);
            IERC20(order.artistToken).safeTransfer(msg.sender, fillArtistAmount);
        } else {
            // Taker is selling, order creator is buying
            IERC20(order.artistToken).safeTransferFrom(msg.sender, order.creator, fillArtistAmount);
            prophetToken.transfer(msg.sender, fillProphetAmount);
        }
        
        // Check if order is completely filled
        bool orderComplete = order.isBuyOrder ? 
            order.filled >= order.artistTokenAmount : 
            order.filled >= order.prophetAmount;
            
        if (orderComplete) {
            order.active = false;
        }
        
        emit Trade(
            takerIsBuyer ? msg.sender : order.creator,
            takerIsBuyer ? order.creator : msg.sender,
            order.artistToken,
            fillProphetAmount,
            fillArtistAmount,
            order.pricePerToken
        );
        
        emit OrderFilled(order.id, msg.sender, takerIsBuyer ? fillArtistAmount : fillProphetAmount, 
            orderComplete ? 0 : (order.isBuyOrder ? order.artistTokenAmount - order.filled : order.prophetAmount - order.filled));
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
            uint256 remainingProphetTokens = order.prophetAmount - order.filled;
            if (remainingProphetTokens > 0) {
                prophetToken.transfer(order.creator, remainingProphetTokens);
            }
        } else {
            // Return remaining artist tokens
            uint256 remainingArtistTokens = order.artistTokenAmount - order.filled;
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
     * @dev Get the best buy price for an artist token
     * @param artistTokenAddress The artist token to check
     * @return The highest buy order price (0 if no buy orders)
     */
    function getBestBuyPrice(address artistTokenAddress) external view returns (uint256) {
        uint256[] memory buyOrders = artistTokenOrders[artistTokenAddress][true];
        uint256 bestPrice = 0;
        
        for (uint256 i = 0; i < buyOrders.length; i++) {
            Order storage order = orders[buyOrders[i]];
            if (order.active && order.pricePerToken > bestPrice) {
                bestPrice = order.pricePerToken;
            }
        }
        
        return bestPrice;
    }
    
    /**
     * @dev Get the best sell price for an artist token
     * @param artistTokenAddress The artist token to check
     * @return The lowest sell order price (0 if no sell orders)
     */
    function getBestSellPrice(address artistTokenAddress) external view returns (uint256) {
        uint256[] memory sellOrders = artistTokenOrders[artistTokenAddress][false];
        uint256 bestPrice = type(uint256).max;
        bool found = false;
        
        for (uint256 i = 0; i < sellOrders.length; i++) {
            Order storage order = orders[sellOrders[i]];
            if (order.active && order.pricePerToken < bestPrice) {
                bestPrice = order.pricePerToken;
                found = true;
            }
        }
        
        return found ? bestPrice : 0;
    }
    
    /**
     * @dev Get market depth for an artist token
     * @param artistTokenAddress The artist token to check
     * @return buyVolume Total artist tokens available to buy
     * @return sellVolume Total artist tokens available to sell
     * @return bestBuyPrice Highest buy order price
     * @return bestSellPrice Lowest sell order price
     */
    function getMarketDepth(address artistTokenAddress) external view returns (
        uint256 buyVolume,
        uint256 sellVolume,
        uint256 bestBuyPrice,
        uint256 bestSellPrice
    ) {
        uint256[] memory buyOrders = artistTokenOrders[artistTokenAddress][true];
        uint256[] memory sellOrders = artistTokenOrders[artistTokenAddress][false];
        
        bestBuyPrice = 0;
        bestSellPrice = type(uint256).max;
        bool sellFound = false;
        
        // Calculate buy side
        for (uint256 i = 0; i < buyOrders.length; i++) {
            Order storage order = orders[buyOrders[i]];
            if (order.active) {
                buyVolume += order.artistTokenAmount - order.filled;
                if (order.pricePerToken > bestBuyPrice) {
                    bestBuyPrice = order.pricePerToken;
                }
            }
        }
        
        // Calculate sell side
        for (uint256 i = 0; i < sellOrders.length; i++) {
            Order storage order = orders[sellOrders[i]];
            if (order.active) {
                sellVolume += order.artistTokenAmount - order.filled;
                if (order.pricePerToken < bestSellPrice) {
                    bestSellPrice = order.pricePerToken;
                    sellFound = true;
                }
            }
        }
        
        if (!sellFound) {
            bestSellPrice = 0;
        }
    }
    
    /**
     * @dev Emergency function to remove stuck liquidity (admin only)
     * @param token The token address to withdraw
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(
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