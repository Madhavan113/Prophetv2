// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@thirdweb-dev/contracts/base/ERC20Base.sol";
import "@thirdweb-dev/contracts/extension/Permissions.sol";

/**
 * @title ProphetToken
 * @dev ERC20 token that can be used to buy artist tokens, with thirdweb integration
 */
contract ProphetToken is ERC20Base, Permissions {
    // Events
    event ArtistTokenCreated(address indexed artistTokenAddress, string artistName, uint256 initialProphetValue);

    // Storage for artist tokens linked to Prophet
    mapping(address => bool) public registeredArtistTokens;
    mapping(address => uint256) public artistTokenProphetValue;
    
    // Token sale configuration - MUCH CHEAPER!
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
     * @dev Register a new artist token with Prophet value
     * @param artistTokenAddress The address of the artist token contract
     * @param artistName Name of the artist
     * @param initialProphetValue The Prophet token value associated with the artist token
     */
    function registerArtistToken(
        address artistTokenAddress, 
        string memory artistName,
        uint256 initialProphetValue
    ) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(!registeredArtistTokens[artistTokenAddress], "Artist token already registered");
        require(initialProphetValue > 0, "Prophet value must be greater than 0");
        
        registeredArtistTokens[artistTokenAddress] = true;
        artistTokenProphetValue[artistTokenAddress] = initialProphetValue;
        
        emit ArtistTokenCreated(artistTokenAddress, artistName, initialProphetValue);
    }

    /**
     * @dev Update the Prophet value for an artist token
     * @param artistTokenAddress The address of the artist token
     * @param newProphetValue The new Prophet value
     */
    function updateArtistTokenValue(
        address artistTokenAddress, 
        uint256 newProphetValue
    ) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(registeredArtistTokens[artistTokenAddress], "Artist token not registered");
        require(newProphetValue > 0, "Prophet value must be greater than 0");
        
        artistTokenProphetValue[artistTokenAddress] = newProphetValue;
    }

    /**
     * @dev Check if an artist token is registered
     * @param artistTokenAddress The address to check
     * @return True if the address is a registered artist token
     */
    function isArtistToken(address artistTokenAddress) external view returns (bool) {
        return registeredArtistTokens[artistTokenAddress];
    }

    /**
     * @dev Get the Prophet value of an artist token
     * @param artistTokenAddress The artist token address
     * @return The Prophet value associated with the artist token
     */
    function getArtistTokenProphetValue(address artistTokenAddress) external view returns (uint256) {
        require(registeredArtistTokens[artistTokenAddress], "Artist token not registered");
        return artistTokenProphetValue[artistTokenAddress];
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