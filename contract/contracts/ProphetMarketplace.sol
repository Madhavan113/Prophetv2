// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ProphetMarketplace
 * @notice Simple maker/taker order-book: trade any whitelisted Artist ShareToken
 *         against ProphetToken.  All prices quoted in PROPHET-per-share (1e18 fp).
 *
 *  - Maker posts limit order (buy or sell) -> tokens/PROPHET escrowed.
 *  - Taker chooses an order id & amount -> partial/complete fill.
 *  - Maker can cancel unfilled remainder at any time.
 *  - 10 bps maker fee + 20 bps taker fee (changeable by admin).
 *
 *  Gas-light: orders stored in an array per token; front-end sorts by price.
 */
contract ProphetMarketplace is AccessControl, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // =============== ROLES ===============
    bytes32 public constant LIST_MANAGER_ROLE = keccak256("LIST_MANAGER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE  = keccak256("FEE_MANAGER_ROLE");

    // =============== DATA ===============
    struct Order {
        address maker;
        bool    isBuy;      // true = wants to buy shareTokens, pays Prophet
        uint256 price;      // PROPHET per share (1e18 fixed-point)
        uint256 amount;     // remaining shares
    }

    IERC20 public immutable prophet;
    uint256 public makerFeeBps = 10;   // 0.10 %
    uint256 public takerFeeBps = 20;   // 0.20 %
    address public feeRecipient;

    // artistToken => orders[]
    mapping(address => Order[]) public orderBook;
    // artistToken whitelist
    EnumerableSet.AddressSet private listedTokens;

    // =============== EVENTS ===============
    event TokenListed(address indexed token);
    event OrderPlaced(address indexed token, uint256 indexed id, address maker,
                      bool isBuy, uint256 price, uint256 amount);
    event OrderFilled(address indexed token, uint256 indexed id, address maker,
                      address taker, uint256 amount, uint256 price);
    event OrderCancelled(address indexed token, uint256 indexed id, address maker, uint256 amountLeft);
    event FeesUpdated(uint256 makerBps, uint256 takerBps, address recipient);

    // =============== CONSTRUCTOR ===============
    constructor(address prophetToken, address admin) {
        require(prophetToken != address(0), "prophet 0");
        prophet = IERC20(prophetToken);

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(LIST_MANAGER_ROLE, admin);
        _setupRole(FEE_MANAGER_ROLE,  admin);

        feeRecipient = admin;
    }

    // =============== LIST MANAGEMENT ===============
    function listToken(address artistToken) external onlyRole(LIST_MANAGER_ROLE) {
        require(listedTokens.add(artistToken), "already listed");
        emit TokenListed(artistToken);
    }

    function isListed(address token) public view returns (bool) {
        return listedTokens.contains(token);
    }

    // =============== FEE CONFIG ===============
    function setFees(uint256 makerBps, uint256 takerBps, address recipient)
        external onlyRole(FEE_MANAGER_ROLE)
    {
        require(makerBps <= 100 && takerBps <= 100, "fee too high"); // <=1 %
        makerFeeBps = makerBps;
        takerFeeBps = takerBps;
        feeRecipient = recipient;
        emit FeesUpdated(makerBps, takerBps, recipient);
    }

    // =============== ORDER ENTRY ===============
    /**
     * @param isBuy   true  = bid  (deposit PROPHET, receive shares later)
     *                false = ask  (deposit shares, receive PROPHET later)
     * @param price   PROPHET per share (1e18 fp)
     * @param amount  # shares to trade (shares use shareToken.decimals)
     */
    function placeOrder(address artistToken, bool isBuy, uint256 price, uint256 amount)
        external nonReentrant returns (uint256 id)
    {
        require(isListed(artistToken), "not listed");
        require(price > 0 && amount > 0, "bad params");

        if (isBuy) {
            uint256 cost = (price * amount) / 1e18;           // PROPHET needed
            uint256 fee  = (cost * makerFeeBps) / 10_000;
            prophet.transferFrom(msg.sender, address(this), cost + fee);
            if (fee > 0) prophet.transfer(feeRecipient, fee);
        } else {
            IERC20(artistToken).transferFrom(msg.sender, address(this), amount);
            uint256 fee = (amount * makerFeeBps) / 10_000;
            if (fee > 0) IERC20(artistToken).transfer(feeRecipient, fee);
            amount -= fee; // only non-fee portion stays on book
        }

        orderBook[artistToken].push(Order(msg.sender, isBuy, price, amount));
        id = orderBook[artistToken].length - 1;
        emit OrderPlaced(artistToken, id, msg.sender, isBuy, price, amount);
    }

    // =============== TAKING / MATCHING ===============
    /**
     * @notice Fill up to `amount` from an existing order
     */
    function take(address artistToken, uint256 id, uint256 amount)
        external nonReentrant
    {
        Order storage o = orderBook[artistToken][id];
        require(o.amount >= amount && amount > 0, "bad amt");
        bool isBuy = o.isBuy;

        if (isBuy) {
            // taker sells shares, receives PROPHET
            IERC20(artistToken).transferFrom(msg.sender, o.maker, amount);

            uint256 gross = (o.price * amount) / 1e18;
            uint256 fee   = (gross * takerFeeBps) / 10_000;
            prophet.transfer(msg.sender, gross - fee);
            if (fee > 0) prophet.transfer(feeRecipient, fee);
        } else {
            // taker buys shares, pays PROPHET
            uint256 cost = (o.price * amount) / 1e18;
            uint256 fee  = (cost * takerFeeBps) / 10_000;
            prophet.transferFrom(msg.sender, o.maker, cost);
            if (fee > 0) prophet.transferFrom(msg.sender, feeRecipient, fee);

            IERC20(artistToken).transfer(msg.sender, amount);
        }

        o.amount -= amount;
        emit OrderFilled(artistToken, id, o.maker, msg.sender, amount, o.price);
    }

    // =============== CANCEL ===============
    function cancel(address artistToken, uint256 id) external nonReentrant {
        Order storage o = orderBook[artistToken][id];
        require(o.maker == msg.sender, "not maker");
        uint256 remaining = o.amount;
        require(remaining > 0, "already filled");

        o.amount = 0; // close

        if (o.isBuy) {
            uint256 refund = (o.price * remaining) / 1e18;
            prophet.transfer(o.maker, refund);
        } else {
            IERC20(artistToken).transfer(o.maker, remaining);
        }

        emit OrderCancelled(artistToken, id, msg.sender, remaining);
    }

    // =============== VIEW HELPERS ===============
    function getOrders(address artistToken) external view returns (Order[] memory) {
        return orderBook[artistToken];
    }
} 