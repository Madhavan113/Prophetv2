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
} 