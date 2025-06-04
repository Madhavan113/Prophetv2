// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@thirdweb-dev/contracts/base/ERC20Base.sol";
import "@thirdweb-dev/contracts/extension/Permissions.sol";

/**
 * @title ProphetToken
 * @dev ERC20 token for the Prophet ecosystem, with thirdweb integration
 */
contract ProphetToken is ERC20Base, Permissions {
    // Token sale configuration
    uint256 public tokenPrice = 0.000001 ether; // 1 gwei per token (very cheap!)
    bool public saleActive = true;

    /**
     * @dev Constructor that sets up the ERC20 token and permissions
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _primarySaleRecipient
    )
        ERC20Base(
            _primarySaleRecipient,
            _name,
            _symbol
        )
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Allow users to buy Prophet tokens with ETH
     * @param amount The amount of tokens to buy (in wei, 18 decimals)
     */
    function buyTokens(uint256 amount) external payable {
        require(saleActive, "Token sale is not active");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 cost = (amount * tokenPrice) / 1 ether; // Calculate cost in ETH
        require(msg.value >= cost, "Insufficient ETH sent");
        
        // Mint tokens to the buyer
        _mint(msg.sender, amount);
        
        // Refund excess ETH if any
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
    }

    /**
     * @dev Allow users to claim/buy a specific quantity of tokens
     * @param to The address to mint tokens to
     * @param quantity The quantity of tokens to mint
     */
    function claim(address to, uint256 quantity) external payable {
        require(saleActive, "Token sale is not active");
        require(quantity > 0, "Quantity must be greater than 0");
        
        uint256 cost = (quantity * tokenPrice) / 1 ether;
        require(msg.value >= cost, "Insufficient ETH sent");
        
        // Mint tokens to the specified address
        _mint(to, quantity);
        
        // Refund excess ETH if any
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
    }

    /**
     * @dev Set the token price (only admin)
     * @param newPrice New price per token in wei
     */
    function setTokenPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenPrice = newPrice;
    }

    /**
     * @dev Toggle sale status (only admin)
     */
    function toggleSale() external onlyRole(DEFAULT_ADMIN_ROLE) {
        saleActive = !saleActive;
    }

    /**
     * @dev Withdraw contract balance (only admin)
     */
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(msg.sender).transfer(balance);
    }

    /**
     * @dev Get current token price
     */
    function getTokenPrice() external view returns (uint256) {
        return tokenPrice;
    }

    /**
     * @dev Calculate cost for a given amount of tokens
     * @param tokenAmount Amount of tokens (in wei)
     * @return Cost in ETH (in wei)
     */
    function calculateCost(uint256 tokenAmount) external view returns (uint256) {
        return (tokenAmount * tokenPrice) / 1 ether;
    }
} 